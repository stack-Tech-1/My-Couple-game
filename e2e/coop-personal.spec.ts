import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

/** Daily Question through the real dashboard UI, and a co-op win that stays off the head-to-head. */
test("daily question reveal and a co-op win, in two browsers", async ({ browser }) => {
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

    // Ada answers today's question; it's sealed for her, and Bo's card updates live.
    await pa.getByLabel("Your answer").fill("Rain on a tin roof");
    await pa.getByRole("button", { name: "Seal it" }).click();
    await expect(pa.getByText(/^Sealed\./)).toBeVisible();
    await expect(pb.getByText("Ada has answered. Your turn.")).toBeVisible();
    await expect(pb.getByText("Rain on a tin roof")).toHaveCount(0);

    // Bo answers; both now see both.
    await pb.getByLabel("Your answer").fill("Fresh bread");
    await pb.getByRole("button", { name: "Seal it" }).click();
    await expect(pb.getByText("Rain on a tin roof")).toBeVisible();
    await expect(pa.getByText("Fresh bread")).toBeVisible();

    // Co-op: In Sync, both say the same word.
    await pa.goto(`/room/${roomId}/games/in-sync`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const sessionId = pa.url().split("/play/")[1]!;
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(new RegExp(sessionId));

    await pa.getByLabel("Your word").fill("ocean");
    await pa.getByRole("button", { name: "Lock in" }).click();
    await expect(pb.getByText("?").first()).toBeVisible();
    await pb.getByLabel("Your word").fill("Ocean");
    await pb.getByRole("button", { name: "Lock in" }).click();

    await expect(pa.locator("#result-title")).toHaveText("You did it. Together.");
    await expect(pb.locator("#result-title")).toHaveText("You did it. Together.");
    const { data: s } = await admin.from("game_sessions").select("outcome").eq("id", sessionId).single();
    expect(s!.outcome).toBe("coop_win");

    // Co-op wins don't move the competitive scoreboard.
    await pa.goto(`/room/${roomId}`);
    await expect(pa.getByLabel("Ada: 0 wins")).toBeVisible();
    await expect(pa.getByText("You cleared In Sync together.")).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});