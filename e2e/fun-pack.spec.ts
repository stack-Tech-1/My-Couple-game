import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

async function start(pa: Page, pb: Page, roomId: string, game: string) {
  await pa.goto(`/room/${roomId}/games/${game}`);
  await pa.getByRole("button", { name: "Invite Bo" }).click();
  await expect(pa).toHaveURL(/\/play\//);
  const sessionId = pa.url().split("/play/")[1]!;
  await pb.getByRole("button", { name: "Join" }).click();
  await expect(pb).toHaveURL(new RegExp(sessionId));
  return sessionId;
}

test("Don't Laugh keeps the prompt to the performer; Love Styles reveals both profiles", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));

    // Don't Laugh: six turns, the watcher always answers.
    const dl = await start(pa, pb, roomId, "dont-laugh");
    for (let turn = 0; turn < 6; turn++) {
      const { data } = await admin.from("game_secrets").select("state").eq("session_id", dl).single();
      const st = data!.state as { players: string[]; first: number; history: unknown[]; deck: string[]; cursor: number };
      const performerIsA = st.players[(st.first + st.history.length) % 2] === a.id;
      const [perf, watch] = performerIsA ? [pa, pb] : [pb, pa];
      const prompt = st.deck[st.cursor]!;
      await expect(perf.getByRole("heading", { name: prompt })).toBeVisible();
      await expect(watch.getByText(prompt)).toHaveCount(0);
      await watch.getByRole("button", { name: performerIsA ? "I laughed" : "Straight face" }).click();
      if (turn < 5) await expect(watch.getByText(`Turn ${turn + 2} of 6`)).toBeVisible();
    }
    await expect(pa.locator("#result-title")).toHaveText("You won.");
    const { data: s1 } = await admin.from("game_sessions").select("outcome, winner").eq("id", dl).single();
    expect(s1).toMatchObject({ outcome: "win", winner: a.id });

    // Love Styles: both answer ten and guess; the reveal shows both.
    await pa.goto(`/room/${roomId}`);
    await pb.goto(`/room/${roomId}`);
    await start(pa, pb, roomId, "love-styles");
    for (const p of [pa, pb]) {
      for (let i = 0; i < 10; i++) {
        await expect(p.getByText(`${i + 1} of 10`)).toBeVisible();
        await p.locator("main button.min-h-16").first().click();
      }
      await p.getByRole("button", { name: "Time together" }).click();
    }
    for (const p of [pa, pb]) await expect(p.getByText(/^To love (Ada|Bo) well$/)).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});
