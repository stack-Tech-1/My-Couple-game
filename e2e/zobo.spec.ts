import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, onboardedUser, signInPath } from "./helpers";
import { readFileSync } from "node:fs";

const solutions = JSON.parse(readFileSync("src/lib/solo/games/zobo-levels.solutions.json", "utf8")) as [number, number][][];

/** Play a level through with its known solution, waiting for each pour to finish. */
async function solve(page: Page, level: number) {
  const bottles = page.locator('[data-tour="zobo-shelf"] svg g[role="button"]');
  await expect(bottles.first()).toBeVisible({ timeout: 30_000 });
  const restart = page.getByRole("button", { name: "Restart", exact: true });
  for (const [from, to] of solutions[level - 1]!) {
    // Restart is switched off while a pour is running, and taps are ignored until it ends.
    await expect(restart).toBeEnabled();
    await bottles.nth(from).click({ timeout: 8000 });
    await bottles.nth(to).click({ timeout: 8000 });
    await expect(restart).toBeDisabled();
  }
  await expect(page.getByRole("heading", { name: "All sorted!" })).toBeVisible({ timeout: 15_000 });
}

test("zobo sort: a free player gets one level a day, can retry it, and pays for helpers from takings", async ({ browser }) => {
  test.setTimeout(180_000);
  const free = await onboardedUser("Zed", "fig", { plus: false });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage();
    await page.goto(await signInPath(free.email, "/solo/zobo-sort"));
    await expect(page.getByRole("heading", { name: "Zobo Sort", level: 1 })).toBeVisible();
    await expect(page.getByText("One free level a day.")).toBeVisible();
    await page.getByRole("link", { name: "Play level 1" }).click();

    await solve(page, 1);
    await expect(page.getByText("Your next free level opens at midnight.")).toBeVisible();
    await expect.poll(async () => (await admin.from("solo_scores").select("score, mode").eq("user_id", free.id).eq("game_id", "zobo-sort")).data).toEqual([{ score: 440, mode: "lvl-1" }]);

    // The next level waits for tomorrow.
    await page.goto("/solo/zobo-sort?mode=lvl-2");
    await expect(page.getByText("That's today's free level of Zobo Sort")).toBeVisible();

    // The same level can be tried again, and a hint comes out of the savings.
    await page.goto("/solo/zobo-sort?mode=lvl-1");
    await page.getByRole("button", { name: /^Hint/ }).click();
    await expect(page.getByText("Pour from the first glowing bottle into the second.")).toBeVisible();
    await expect.poll(async () => (await admin.from("solo_shop").select("price").eq("user_id", free.id).eq("game_id", "zobo-sort")).data).toEqual([{ price: 200 }]);

    await page.goto("/solo/zobo-sort");
    await expect(page.getByText("₦240")).toBeVisible();
    await expect(page.getByText("Your next free level opens at midnight.")).toBeVisible();
  } finally {
    await cleanup([free.id]);
    await ctx.close();
  }
});

test("zobo sort: Plus plays on to the next level, and levels can't be skipped", async ({ browser }) => {
  test.setTimeout(180_000);
  const plus = await onboardedUser("Pia");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage();
    await page.goto(await signInPath(plus.email, "/solo/zobo-sort?mode=lvl-3"));
    await expect(page).toHaveURL(/\/solo\/zobo-sort$/);

    await page.goto("/solo/zobo-sort?mode=lvl-1");
    await solve(page, 1);
    await page.getByRole("link", { name: "Next level" }).click();
    await expect(page.getByRole("heading", { name: "Level 2" })).toBeVisible();
    await expect(page.locator('[data-tour="zobo-shelf"] svg g[role="button"]').first()).toBeVisible();
  } finally {
    await cleanup([plus.id]);
    await ctx.close();
  }
});
