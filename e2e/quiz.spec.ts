import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

/** The shared quiz engine end to end (Naija Trivia): answers stay hidden until both pick, then the score adds up. */
test("quiz: in-step questions, reveal after both answer, and a winner", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}/games/naija-trivia`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const sessionId = pa.url().split("/play/")[1]!;
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(new RegExp(sessionId));

    const { data: secret } = await admin.from("game_secrets").select("state").eq("session_id", sessionId).single();
    const items = (secret!.state as { items: { q: string; options: string[]; answer: number }[] }).items;

    for (const [i, it] of items.entries()) {
      const right = it.options[it.answer]!;
      const wrong = it.options[(it.answer + 1) % 4]!;
      await expect(pa.getByRole("heading", { name: it.q })).toBeVisible();
      await pa.getByRole("button", { name: right, exact: true }).click();
      // Ada waits; nothing about the answer reaches Bo's screen before Bo picks.
      await expect(pa.getByText("Waiting for Bo to answer…")).toBeVisible();
      await expect(pb.getByText("Ada has answered")).toBeVisible();
      await pb.getByRole("button", { name: i === 0 ? wrong : right, exact: true }).click();

      await expect(pa.getByText("You got it.")).toBeVisible();
      await expect(pb.getByText(i === 0 ? "Not this time." : "You got it.")).toBeVisible();
      if (i < items.length - 1) {
        for (const p of [pa, pb]) await p.getByRole("button", { name: "Next question" }).click();
      }
    }

    await expect(pa.locator("#result-title")).toHaveText("You won.");
    const { data: s } = await admin.from("game_sessions").select("status, outcome, winner").eq("id", sessionId).single();
    expect(s).toMatchObject({ status: "finished", outcome: "win", winner: a.id });
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});
