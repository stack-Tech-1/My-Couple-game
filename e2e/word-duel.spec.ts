import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

/**
 * Simultaneous moves against the real backend: both players guess at the same instant.
 * Every guess must land (server retries on version conflicts) and exactly one player wins.
 * Also covers house rules saved from the settings screen.
 */
test("simultaneous Word Duel guesses all land and there is exactly one winner", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}/settings`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));

    // House rules: Ada turns on Whot stacking from settings; it's stored on the room.
    await pa.getByRole("switch", { name: "Stack picks" }).click();
    await expect(pa.getByText("House rules updated.")).toBeVisible();
    const { data: room } = await admin.from("rooms").select("settings").eq("id", roomId).single();
    expect((room!.settings as { houseRules: { whot: { stackPicks: boolean } } }).houseRules.whot.stackPicks).toBe(true);

    // Start Word Duel; Bo joins from the toast.
    await pa.goto(`/room/${roomId}/games/word-duel`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const sessionId = pa.url().split("/play/")[1]!;
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(new RegExp(sessionId));

    const { data: secret } = await admin.from("game_secrets").select("state").eq("session_id", sessionId).single();
    const target = (secret!.state as { target: string }).target;
    const wrong = target === "crane" ? "slate" : "crane";

    const typeWord = async (page: typeof pa, w: string) => {
      for (const ch of w) await page.keyboard.press(ch);
    };
    await typeWord(pa, wrong);
    await typeWord(pb, wrong);
    await Promise.all([pa.keyboard.press("Enter"), pb.keyboard.press("Enter")]);

    // Both guesses recorded, each sees the other's colours (not letters).
    await expect(pa.getByText("1/6 guesses")).toBeVisible();
    await expect(pb.getByText("1/6 guesses")).toBeVisible();

    await typeWord(pa, target);
    await typeWord(pb, target);
    await Promise.all([pa.keyboard.press("Enter"), pb.keyboard.press("Enter")]);

    await expect(pa.locator("#result-title")).toBeVisible();
    await expect(pb.locator("#result-title")).toBeVisible();
    const { data: s } = await admin.from("game_sessions").select("status, outcome, winner").eq("id", sessionId).single();
    expect(s).toMatchObject({ status: "finished", outcome: "win" });
    expect([a.id, b.id]).toContain(s!.winner);
    const winnerPage = s!.winner === a.id ? pa : pb;
    const loserPage = s!.winner === a.id ? pb : pa;
    await expect(winnerPage.locator("#result-title")).toHaveText("You won.");
    await expect(loserPage.locator("#result-title")).toHaveText(/won\.$/);

    const { data: moves } = await admin.from("game_moves").select("by_user").eq("session_id", sessionId);
    expect(moves!.length).toBeGreaterThanOrEqual(3); // both wrong guesses + at least the winning one
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});