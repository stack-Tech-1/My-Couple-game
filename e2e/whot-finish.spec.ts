import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";
import { whot, type WhotState } from "../src/games/whot/logic";

/** Whot market finish mode: chosen at the start, warns near the end, counts hands, and survives a rematch. */
test("whot market finish: warning, face-value count, and the mode carries into a rematch", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}/games/whot`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pa.getByRole("radio", { name: /Market finish/ }).click();
    await expect(pa.getByRole("radio", { name: /Market finish/ })).toHaveAttribute("aria-checked", "true");
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const sessionId = pa.url().split("/play/")[1]!;
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(new RegExp(sessionId));

    const { data: sess } = await admin.from("game_sessions").select("config, players").eq("id", sessionId).single();
    expect((sess!.config as { marketFinish: boolean }).marketFinish).toBe(true);
    await expect(pa.getByText("Market finish · first market")).toBeVisible();

    // Fast-forward: the second market is down to its last card and it's Ada's turn.
    const { data: secret } = await admin.from("game_secrets").select("state").eq("session_id", sessionId).single();
    const st = secret!.state as Record<string, unknown> & { players: string[] };
    const card = (id: number, shape: string, n: number) => ({ id, shape, n });
    const rigged = {
      ...st,
      turn: st.players.indexOf(a.id),
      pendingPick: 0,
      pendingKind: null,
      requested: null,
      pile: [card(0, "circle", 1)],
      market: [card(40, "star", 8)],
      hands: { [a.id]: [card(1, "triangle", 3)], [b.id]: [card(2, "star", 5), card(3, "cross", 1)] },
      finish: { on: true, reshuffles: 1 },
    };
    await admin.from("game_secrets").update({ state: rigged }).eq("session_id", sessionId);
    // Views are stored per player; write the rigged ones too, as a real move would.
    for (const uid of [a.id, b.id]) await admin.from("game_views").update({ view: whot.viewFor(rigged as unknown as WhotState, uid) }).eq("session_id", sessionId).eq("user_id", uid);
    await pa.reload();
    await pb.reload();
    await expect(pb.getByRole("alert").filter({ hasText: "Last market: 1 card left" })).toBeVisible();

    // Ada can't match (triangle 3 on circle 1), so she draws the last card: the game ends on a count.
    await pa.getByRole("button", { name: /Go to market/ }).click();
    await expect(pb.getByText("Market's finished. Your hand is lighter: you win.")).toBeVisible();
    const tally = pa.getByRole("region", { name: "Final count" });
    await expect(tally).toContainText("Counted at face value");
    await expect(tally).toContainText("11 points"); // Ada: 3 + 8
    await expect(tally).toContainText("6 points"); // Bo: 5 + 1 (stars not doubled)
    const { data: done } = await admin.from("game_sessions").select("status, winner").eq("id", sessionId).single();
    expect(done).toMatchObject({ status: "finished", winner: b.id });

    // Rematch keeps market finish mode.
    await pa.getByRole("button", { name: "Rematch" }).click();
    await expect(pa).not.toHaveURL(new RegExp(sessionId));
    const nextId = pa.url().split("/play/")[1]!;
    const { data: next } = await admin.from("game_sessions").select("config, rematch_of").eq("id", nextId).single();
    expect(next).toMatchObject({ rematch_of: sessionId, config: { marketFinish: true } });
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});
