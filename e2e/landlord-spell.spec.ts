import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, pairedRoom, signInPath } from "./helpers";

async function open(browser: import("@playwright/test").Browser, game: string, mode?: string) {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  await pa.goto(await signInPath(a.email, `/room/${roomId}`));
  await pb.goto(await signInPath(b.email, `/room/${roomId}`));
  await pa.goto(`/room/${roomId}/games/${game}`);
  if (mode) await pa.getByRole("radio", { name: new RegExp(mode) }).click();
  await pa.getByRole("button", { name: "Invite Bo" }).click();
  await expect(pa).toHaveURL(/\/play\//);
  await pb.getByRole("button", { name: "Join" }).click();
  await expect(pb).toHaveURL(pa.url());
  const done = async () => {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  };
  return { pa, pb, errors, done };
}

const shots = async (name: string, ...pages: Page[]) => {
  if (!process.env.SHOTS_DIR) return;
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${process.env.SHOTS_DIR}/${name}-${i}.png`, fullPage: true });
};

test("naija landlord: rolling, buying and the feed in two browsers", async ({ browser }) => {
  const { pa, pb, errors, done } = await open(browser, "naija-landlord");
  try {
    await expect(pa.getByRole("grid", { name: /Naija Landlord board/ })).toBeVisible();
    // Each player starts with one free street, and ₦1.5M.
    await expect(pa.getByText("₦1.5M", { exact: true })).toHaveCount(2);

    // Play six actions: roll when it's your turn, buy whatever is offered, accept every choice.
    const action = (p: Page) => p.getByRole("button", { name: /^(Roll|Buy for|Buy out|Host big|Pay ₦50k)/ }).first();
    for (let i = 0; i < 6; i++) {
      let p: Page | null = null;
      await expect(async () => {
        p = (await action(pa).isVisible()) ? pa : (await action(pb).isVisible()) ? pb : null;
        expect(p).not.toBeNull();
      }).toPass({ timeout: 20_000 });
      const who = p as unknown as Page;
      await Promise.all([who.waitForResponse((r) => r.url().includes("/move") && r.ok()), action(who).click()]);
    }
    // Both browsers see the same feed.
    // Names differ ("You" on your own screen), so compare what happened, not who did it.
    const feed = async (p: Page) => (await p.getByRole("list", { name: "What happened" }).locator("li").allInnerTexts()).map((t) => t.split(" ").slice(1).join(" "));
    await expect(async () => expect(await feed(pb)).toEqual(await feed(pa))).toPass({ timeout: 15_000 });
    await shots("landlord", pa, pb);
    expect(errors).toEqual([]);
  } finally {
    await done();
  }
});

const DICT = new Set(fs.readFileSync("assets/words/spell-am.txt", "utf8").split("\n"));

test("spell am: a bad word is refused by name, a good one scores", async ({ browser }) => {
  const { pa, pb, errors, done } = await open(browser, "spell-am", "Full game");
  try {
    const grid = (p: Page) => p.getByRole("grid", { name: /Spell Am board/ });
    await expect(grid(pa)).toBeVisible();
    const starter = /You start/.test((await grid(pa).getAttribute("aria-label")) ?? "") ? pa : pb;
    await expect(grid(starter)).toHaveAttribute("aria-label", /You start/);

    // Read the rack: "A, 1 points".
    const tiles = starter.locator('[data-tour="sa-rack"] button');
    await expect(starter.getByRole("button", { name: /points$|^Blank tile$/ })).toHaveCount(7);
    const labels = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    // Blanks ("Blank tile") are left out of the search by giving them a letter no word uses.
    const letters = labels.map((l) => (l.startsWith("Blank") ? "#" : l[0]!.toLowerCase()));
    const pairs: [number, number][] = [];
    for (let i = 0; i < letters.length; i++) for (let j = 0; j < letters.length; j++) if (i !== j) pairs.push([i, j]);
    const good = pairs.find(([i, j]) => DICT.has(letters[i]! + letters[j]!));
    const bad = pairs.find(([i, j]) => !(letters[i]! + letters[j]!).includes("#") && !DICT.has(letters[i]! + letters[j]!));
    test.skip(!good || !bad, `rack ${letters.join("")} has no usable pair`);

    const place = async ([i, j]: [number, number]) => {
      await tiles.nth(i).click();
      await starter.getByRole("gridcell", { name: /^Row 6, column 6,/ }).click();
      await tiles.nth(j).click();
      await starter.getByRole("gridcell", { name: /^Row 6, column 7/ }).click();
    };

    await place(bad!);
    const word = (letters[bad![0]]! + letters[bad![1]]!).toUpperCase();
    const [refused] = await Promise.all([starter.waitForResponse((r) => r.url().includes("/move")), starter.getByRole("button", { name: /^Play for/ }).click()]);
    expect(refused.status()).toBe(422);
    await expect(starter.getByText(`${word} isn't in our dictionary.`)).toBeVisible();
    await starter.getByRole("button", { name: "Take back" }).click();

    await place(good!);
    const playBtn = starter.getByRole("button", { name: /^Play for \d+/ });
    const score = Number((await playBtn.innerText()).match(/\d+/)![0]);
    await Promise.all([starter.waitForResponse((r) => r.url().includes("/move") && r.ok()), playBtn.click()]);
    const other = starter === pa ? pb : pa;
    await expect(other.getByRole("list", { name: "Plays so far" })).toContainText(`for ${score}`);
    await expect(grid(other)).toHaveAttribute("aria-label", /Your turn/);
    await shots("spell", starter, other);
    expect(errors).toEqual([]);
  } finally {
    await done();
  }
});
