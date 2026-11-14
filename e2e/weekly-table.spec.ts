import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { admin, cleanup, friendRoom, onboardedUser, signInPath } from "./helpers";

test("friend rooms: this week's table, 3 a win and 1 a game", async ({ browser }) => {
  const [o, f1, f2] = await Promise.all([onboardedUser("Chidi"), onboardedUser("Funke"), onboardedUser("Musa")]);
  const room = await friendRoom(o, [f1, f2]);
  const now = new Date().toISOString();
  const g = (players: string[], winner: string | null, game_id = "whot") => ({ room_id: room.id, game_id, players, status: "finished", outcome: winner ? "win" : "draw", winner, finished_at: now });
  await admin.from("game_sessions").insert([g([o.id, f1.id], f1.id), g([o.id, f1.id, f2.id], f1.id, "ludo"), g([f1.id, f2.id], f2.id)]);
  const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(await signInPath(o.email, `/room/${room.id}`));
    const table = page.getByRole("list", { name: "This week's table" });
    await expect(table.getByRole("listitem")).toHaveCount(3);
    // Funke: 2 wins in 3 games = 4 + 4 + 1 = 9. Musa: 1 win in 2 = 5. Chidi (you): 0 wins in 2 = 2.
    await expect(table.getByRole("listitem").nth(0)).toContainText("Funke");
    await expect(table.getByRole("listitem").nth(0)).toHaveText(/9$/);
    await expect(table.getByRole("listitem").nth(1)).toContainText("Musa");
    await expect(table.getByRole("listitem").nth(1)).toHaveText(/5$/);
    await expect(table.getByRole("listitem").nth(2)).toHaveText(/2$/);
    await expect(table.getByRole("listitem").nth(2)).toContainText("You");
    await expect(table.getByRole("listitem").nth(2)).toContainText("0 wins in 2 games");
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/weekly.png`, await page.getByRole("region", { name: "This week" }).screenshot());
  } finally {
    await cleanup([o.id, f1.id, f2.id]);
    await ctx.close();
  }
});
