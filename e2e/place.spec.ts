import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

test("Our place: things arrive as a couple does things together, and the next one shows its progress", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
  const page = await ctx.newPage();
  try {
    // 12 games together earns the rug (10); the Whot table needs 25.
    const now = new Date().toISOString();
    await admin.from("game_sessions").insert(Array.from({ length: 12 }, () => ({ room_id: roomId, game_id: "whot", players: [a.id, b.id], status: "finished", outcome: "win", winner: a.id, finished_at: now })));
    await page.goto(await signInPath(a.email, `/room/${roomId}`));
    const card = page.getByRole("link", { name: /Our place: \d+ of 26 things/ });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole("heading", { name: "Our place", level: 1 })).toBeVisible();
    const have = page.getByRole("region", { name: "In your place" });
    await expect(have).toContainText("A woven rug");
    await expect(have).not.toContainText("A table for Whot");
    const todo = page.getByRole("region", { name: "Still to earn" });
    await expect(todo.getByRole("listitem").filter({ hasText: "A table for Whot" })).toContainText("12 of 25");
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/place.png`, await page.screenshot({ fullPage: true }));
    // Only couples have a place.
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});
