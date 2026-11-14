import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

test("healthy by design: a gentle goodnight after a long day of games (once), and rare finds in moments", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(await signInPath(a.email, `/room/${roomId}/games`));
    // 1 hour 45 minutes on game screens today.
    await page.evaluate(() => localStorage.setItem(`amah:playtime:${new Date(Date.now() + 3600_000).toISOString().slice(0, 10)}`, String(105 * 60_000)));
    await page.goto(`/room/${roomId}`);
    const night = page.getByRole("dialog", { name: /Good game/ });
    await expect(night).toBeVisible();
    await expect(night).toContainText("You and Bo have played for 1 hour and 45 minutes today");
    await night.getByRole("button", { name: "Goodnight" }).click();
    await expect(night).toBeHidden();
    // Once a day only.
    await page.reload();
    await expect(page.getByRole("heading", { name: /Good game/ })).toHaveCount(0);

    // A rare find shows up in Recent moments.
    await admin.from("moments").insert({ room_id: roomId, kind: "surprise", payload: { name: "Whot General", gameId: "whot", session: "x" } });
    await page.reload();
    await expect(page.getByRole("region", { name: "Recent moments" })).toContainText("A rare find: the “Whot General” card turned up after Whot.");
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});
