import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, onboardedUser, pairedRoom, signInPath } from "./helpers";

/** Reflex Training: five rounds of "wait for gold, then tap". Returns once the result shows. */
async function playReflex(page: Page) {
  const pad = page.locator('[data-tour="reflex-pad"]');
  for (let round = 0; round < 5; round++) {
    await pad.click(); // the striker runs in
    await expect(page.getByRole("button", { name: "Dive!" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Dive!" }).click();
  }
  await expect(page.locator("#solo-result-h")).toContainText("ms");
}

test("solo: just me for now, Reflex Training saves a score, and a challenge to your partner", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const solo = await onboardedUser("Sola", "fig");
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxS = await browser.newContext();
  try {
    // Someone with no room picks "Just me for now" and lands on Solo.
    const ps = await ctxS.newPage();
    await ps.goto(await signInPath(solo.email, "/room"));
    await expect(ps).toHaveURL(/onboarding/);
    await ps.getByRole("button", { name: "Just me for now" }).click();
    await expect(ps).toHaveURL(/\/solo$/);
    await expect(ps.getByRole("heading", { name: "On your own", level: 1 })).toBeVisible();
    // From then on, Amah opens on Solo.
    await ps.goto("/room");
    await expect(ps).toHaveURL(/\/solo$/);

    // Ada's Games tab starts with the Solo shelf.
    const pa = await ctxA.newPage();
    await pa.goto(await signInPath(a.email, `/room/${roomId}/games`));
    await expect(pa.getByRole("heading", { name: "On your own" })).toBeVisible();

    // A full game of Reflex Training, saved on the server.
    await pa.goto("/solo/reflex");
    await playReflex(pa);
    await expect.poll(async () => (await admin.from("solo_scores").select("id", { count: "exact", head: true }).eq("user_id", a.id).eq("game_id", "reflex")).count).toBe(1);

    // Challenge Bo to beat it.
    await pa.getByRole("button", { name: "Challenge" }).click();
    await pa.getByRole("dialog").getByRole("button", { name: "Bo" }).click();
    await expect(pa.getByText("Challenge sent to Bo.")).toBeVisible();

    // Bo sees it on the Solo home and plays it.
    const pb = await ctxB.newPage();
    await pb.goto(await signInPath(b.email, "/solo"));
    await pb.getByRole("link", { name: /Ada challenged you/ }).click();
    await expect(pb.getByText(/Challenge: beat \d+ ms/)).toBeVisible();
    await playReflex(pb);
    await expect(pb.getByText(/You beat Ada's|still stands/)).toBeVisible();
    const { data: ch } = await admin.from("solo_challenges").select("status, accepted_by").eq("from_user", a.id).single();
    expect(["won", "lost"]).toContain(ch!.status);
    expect(ch!.accepted_by).toBe(b.id);
  } finally {
    await cleanup([a.id, b.id, solo.id]);
    await ctxA.close();
    await ctxB.close();
    await ctxS.close();
  }
});

test("solo: a challenge link brings someone new into a friend room, never the couple room", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const cy = await onboardedUser("Cy", "moon");
  const ctx = await browser.newContext();
  try {
    // Ada makes a challenge link with a new friend room (the share sheet itself can't run headless).
    const pa = await ctx.newPage();
    await pa.goto(await signInPath(a.email, "/solo/reflex"));
    await playReflex(pa);
    await pa.getByRole("button", { name: "Challenge" }).click();
    const dialog = pa.getByRole("dialog");
    await dialog.getByRole("button", { name: "Someone not on Amah yet" }).click();
    await dialog.getByRole("radio", { name: /Start a new friend room/ }).click();
    await dialog.getByRole("button", { name: "Share the challenge" }).click();
    await expect.poll(async () => (await admin.from("solo_challenges").select("id", { count: "exact", head: true }).eq("from_user", a.id)).count).toBe(1);
    const { data: c } = await admin.from("solo_challenges").select("token, room_id").eq("from_user", a.id).single();
    const { data: room } = await admin.from("rooms").select("kind").eq("id", c!.room_id).single();
    expect(room!.kind).toBe("friends");

    // Cy opens the link, plays, and is now in that friend room (not Ada and Bo's couple room).
    const cctx = await browser.newContext();
    const pc = await cctx.newPage();
    await pc.goto(await signInPath(cy.email, `/c/${c!.token}`));
    await expect(pc.getByRole("heading", { name: /Beat \d+ ms/ })).toBeVisible();
    await pc.getByRole("button", { name: "Play now" }).click();
    await expect(pc).toHaveURL(new RegExp(`/solo/reflex\\?challenge=${c!.token}`));
    await expect(pc.getByText(/Challenge: beat/)).toBeVisible();
    const { data: rooms } = await admin.from("room_members").select("room_id").eq("user_id", cy.id);
    expect(rooms!.map((r) => r.room_id)).toEqual([c!.room_id]);
    expect(rooms!.map((r) => r.room_id)).not.toContain(roomId);
    await cctx.close();
  } finally {
    await cleanup([a.id, b.id, cy.id]);
    await ctx.close();
  }
});

test("solo: today's word, a bot game, and Fix Am with a picture from the admin", async ({ browser }) => {
  const { a, b } = await pairedRoom(["Ada", "Bo"]);
  // A tiny picture, as if added in the admin.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8Dw/z8DAwMDA8N/AAAj/gL+HWU8AAAAAElFTkSuQmCC", "base64");
  const path = `e2e-${Date.now()}.png`;
  await admin.storage.from("fixam").upload(path, png, { contentType: "image/png" });
  const { data: pic } = await admin.from("fixam_pictures").insert({ name: "Test Rock", place: "Somewhere", path, own_photo: true, live: true, sort: -1, feature_on: new Date(Date.now() + 3600_000).toISOString().slice(0, 10) }).select("id").single();
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    // Today's word: six guesses (or fewer, if one is right) and the day is done.
    await page.goto(await signInPath(a.email, "/solo/oro"));
    await expect(page.getByRole("heading", { name: "Ọ̀rọ̀ of the Day" })).toBeVisible();
    // A word that isn't in the list is refused by name.
    await page.keyboard.type("qzxwv");
    await page.keyboard.press("Enter");
    await expect(page.getByText("QZXWV isn't in our word list.")).toBeVisible();
    for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
    for (const w of ["crane", "pilot", "dough", "shame", "kitty", "bluff"]) {
      if (await page.getByText(/The word was/).isVisible()) break;
      await page.keyboard.type(w);
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.keyboard.press("Enter")]);
    }
    await expect(page.getByText(/The word was/)).toBeVisible();

    // X and O against the easy bot: you play, it answers.
    await page.goto("/solo/bot-tic-tac-toe");
    await page.getByRole("radio", { name: /Small pikin/ }).click();
    const board = page.getByRole("grid", { name: /Noughts and crosses board/ });
    await expect(board).toBeVisible();
    // Whoever starts, keep tapping an empty square until both sides have played.
    await expect(async () => {
      const empty = board.getByRole("gridcell", { name: /, empty$/ }).first();
      if (await empty.isEnabled()) await empty.click();
      expect(await board.getByRole("gridcell", { name: /, (X|O)$/ }).count()).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 20_000 });

    // Fix Am: today's picture, 3×3.
    await page.goto("/solo/fix-am");
    await expect(page.getByText("Test Rock", { exact: true }).first()).toBeVisible();
    await page.getByRole("radio", { name: /3×3/ }).click();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("grid", { name: "Test Rock, cut into 3 by 3 tiles" }).getByRole("gridcell")).toHaveCount(9);
  } finally {
    if (pic) await admin.from("fixam_pictures").delete().eq("id", pic.id);
    await admin.storage.from("fixam").remove([path]);
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});

test("solo: the how-to-play tour shows once, waits for you, and comes back on request", async ({ browser }) => {
  const u = await onboardedUser("Tolu", "fig");
  await admin.from("profiles").update({ toured_games: [] }).eq("id", u.id);
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(await signInPath(u.email, "/solo/ajo"));
    await expect(page.getByText(/How to play Ajo/)).toBeVisible();
    await expect(page.getByText("Slide the notes")).toBeVisible();
    await page.getByRole("button", { name: "Skip tour" }).click();
    await expect(page.getByText(/How to play Ajo/)).toHaveCount(0);
    // Seen: it doesn't open by itself again, but the button brings it back.
    await expect.poll(async () => (await admin.from("profiles").select("toured_games").eq("id", u.id).single()).data?.toured_games).toContain("ajo");
    await page.reload();
    // The game in progress was saved on the phone: carry on with it.
    const carry = page.getByRole("button", { name: "Carry on" });
    await expect(carry.or(page.getByRole("button", { name: "How to play" }))).toBeVisible();
    if (await carry.isVisible()) await carry.click();
    await expect(page.getByRole("button", { name: "How to play" })).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.getByText(/How to play Ajo/)).toHaveCount(0);
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(page.getByText("Slide the notes")).toBeVisible();
  } finally {
    await cleanup([u.id]);
    await ctx.close();
  }
});
