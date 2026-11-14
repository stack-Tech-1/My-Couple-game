import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";
import { freeGameOfWeek, todaysGame } from "../src/lib/engage/rotation";
import { soloGame } from "../src/lib/solo/catalog";
import { gameMeta } from "../src/games/catalog";

test("the Today card: the week's streak, today's game against each other, one go each, the free game of the week", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const t = todaysGame();
  const game = soloGame(t.gameId)!;
  const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
  const page = await ctx.newPage();
  try {
    // Bo has already played today's game.
    const { data: run } = await admin.from("solo_runs").insert({ user_id: b.id, game_id: t.gameId, mode: t.mode, seed: t.seed, finished_at: new Date().toISOString() }).select("id").single();
    await admin.from("solo_scores").insert({ run_id: run!.id, user_id: b.id, game_id: t.gameId, mode: t.mode, seed: t.seed, score: 1234, duration_ms: 60_000 });

    await page.goto(await signInPath(a.email, `/room/${roomId}`));
    const today = page.getByRole("region", { name: "Today", exact: true });
    await expect(today).toBeVisible();
    await expect(today.getByRole("list", { name: "This week" }).getByRole("listitem")).toHaveCount(7);
    const card = today.getByRole("link", { name: new RegExp(game.name) }).first();
    await expect(card).toContainText("Your turn");
    await expect(card).toContainText("Bo");
    // The free game of the week, named.
    await expect(today.getByRole("link", { name: new RegExp(gameMeta(freeGameOfWeek().gameId)!.name) })).toContainText("FREE THIS WEEK");
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/today.png`, await today.screenshot());

    // Into today's game: the shared level, labelled as today's.
    await card.click();
    await expect(page.getByRole("heading", { name: `Today's game: ${game.name}` })).toBeVisible();

    // One go: once Ada has played, coming back says so instead of starting again.
    await admin.from("solo_runs").insert({ user_id: a.id, game_id: t.gameId, mode: t.mode, seed: t.seed });
    // Her one go is saved on the phone to carry on; starting it again isn't allowed.
    await page.goto(`/solo/${t.gameId}?daily=1`);
    const blocked = page.getByText("You've had your go at today's game.", { exact: false });
    const fresh = page.getByRole("button", { name: "Start fresh" });
    await expect(blocked.or(fresh)).toBeVisible();
    if (await fresh.isVisible()) await fresh.click();
    await expect(blocked).toBeVisible();
    // ...and it never used up one of today's free plays of that game.
    const { count } = await admin.from("solo_runs").select("id", { count: "exact", head: true }).eq("user_id", a.id).eq("game_id", t.gameId).not("mode", "like", "d-%");
    expect(count).toBe(0);
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});
