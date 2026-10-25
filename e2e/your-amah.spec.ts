import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

test("your Amah: wins, win rate, streak, favourites and head to head, with pet names", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(await signInPath(a.email, `/room/${roomId}/you`));
    await expect(page.getByText(/No finished games yet/)).toBeVisible();

    // Five finished games: Ada wins three in a row, loses one, ties one; plus a co-op win.
    const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 12, m)).toISOString();
    const base = { room_id: roomId, players: [a.id, b.id], status: "finished" };
    await admin.from("game_sessions").insert([
      { ...base, game_id: "whot", outcome: "win", winner: a.id, finished_at: at(1) },
      { ...base, game_id: "whot", outcome: "win", winner: a.id, finished_at: at(2) },
      { ...base, game_id: "ludo", outcome: "win", winner: a.id, finished_at: at(3) },
      { ...base, game_id: "whot", outcome: "win", winner: b.id, finished_at: at(4) },
      { ...base, game_id: "ayo", outcome: "tie", finished_at: at(5) },
      { ...base, game_id: "memory-match", outcome: "coop_win", finished_at: at(6) },
    ]);
    await admin.from("nicknames").insert({ owner_id: a.id, target_id: b.id, nickname: "Baby" });

    await page.reload();
    const card = (label: string) => page.locator("dl > div").filter({ hasText: label });
    await expect(card("Games played")).toContainText("6");
    await expect(card("Wins")).toContainText("3");
    await expect(card("Wins")).toContainText("1 lost · 1 tied");
    await expect(card("Win rate")).toContainText("60%");
    await expect(card("Best win streak")).toContainText("3");
    await expect(page.getByText("won together out of 1")).toBeVisible();
    await expect(page.getByRole("region", { name: "Your favourites" }).getByRole("listitem").first()).toContainText("Whot");
    const vs = page.getByRole("region", { name: "Head to head" });
    await expect(vs.getByText("You vs Baby")).toBeVisible();
    await expect(vs.getByText("You're ahead")).toBeVisible();

    // Reachable from Settings.
    await page.goto(`/room/${roomId}/settings`);
    await page.getByRole("link", { name: "See your stats" }).click();
    await expect(page.getByRole("heading", { name: "Your Amah" })).toBeVisible();
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});
