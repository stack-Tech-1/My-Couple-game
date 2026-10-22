import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

const toured = async (id: string) => ((await admin.from("profiles").select("toured_games").eq("id", id).single()).data?.toured_games ?? []) as string[];
const forget = async (id: string, gameId: string) => admin.from("profiles").update({ toured_games: (await toured(id)).filter((g) => g !== gameId) }).eq("id", id);

test("game tours: shown once per game, the partner sees you reading, How to play replays it", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  await forget(a.id, "word-duel");
  const [ca, cb] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([ca.newPage(), cb.newPage()]);
  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pa.goto(`/room/${roomId}/games/word-duel`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(/\/play\//);

    // Ada has never played Word Duel: the tour walks her round the real board.
    const first = pa.getByRole("dialog", { name: "Your board" });
    await expect(first).toBeVisible();
    await expect(first.getByText(/How to play Word Duel · 1 of 4/)).toBeVisible();
    // Bo has played before: no tour, and he can see why Ada hasn't moved.
    await expect(pb.getByRole("dialog", { name: "Your board" })).toHaveCount(0);
    await expect(pb.getByText("Ada is reading how to play…")).toBeVisible();

    await first.getByRole("button", { name: "Next" }).click();
    await pa.getByRole("dialog", { name: "Make a guess" }).getByRole("button", { name: "Next" }).click();
    await pa.getByRole("dialog", { name: "Read the colours" }).getByRole("button", { name: "Back" }).click();
    await pa.getByRole("dialog", { name: "Make a guess" }).getByRole("button", { name: "Next" }).click();
    await pa.getByRole("dialog", { name: "Read the colours" }).getByRole("button", { name: "Next" }).click();
    await pa.getByRole("dialog", { name: "The race" }).getByRole("button", { name: "Done" }).click();
    await expect(pb.getByText("Ada is reading how to play…")).toHaveCount(0);
    await expect.poll(() => toured(a.id)).toContain("word-duel");

    // Once is enough, on any device.
    await pa.reload();
    await pa.waitForTimeout(1500);
    await expect(pa.getByRole("dialog", { name: "Your board" })).toHaveCount(0);

    // How to play: the full rules any time, and the tour again on request.
    await pa.getByRole("button", { name: "How to play" }).click();
    const sheet = pa.getByRole("dialog", { name: "How to play Word Duel" });
    await expect(sheet.getByText(/Same secret five-letter word/)).toBeVisible();
    await sheet.getByRole("button", { name: "Show me around" }).click();
    await expect(pa.getByRole("dialog", { name: "Your board" })).toBeVisible();
    await pa.keyboard.press("Escape");
    await expect(pa.getByRole("dialog", { name: "Your board" })).toHaveCount(0);
    expect((await toured(a.id)).filter((g) => g === "word-duel")).toHaveLength(1);
  } finally {
    await cleanup([a.id, b.id]);
    await Promise.all([ca.close(), cb.close()]);
  }
});

test("timed games: the tour comes before the clock, when you join or start", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  await forget(b.id, "reflex-duel");
  await forget(a.id, "draw-guess");
  const [ca, cb] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([ca.newPage(), cb.newPage()]);
  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));

    // Joining: Bo reads how to play on the room page, then goes in. Ada sees him reading.
    await pa.goto(`/room/${roomId}/games/reflex-duel`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb.getByRole("dialog", { name: "Wait for it" })).toBeVisible();
    expect(pb.url()).not.toContain("/play/");
    await expect(pa.getByText("Bo is reading how to play…")).toBeVisible();
    await pb.getByRole("button", { name: "Skip tour" }).click();
    await expect(pb).toHaveURL(pa.url());
    await expect.poll(() => toured(b.id)).toContain("reflex-duel");
    await pa.getByRole("button", { name: "Resign" }).click();
    await pa.getByRole("dialog", { name: /Throw in the towel/ }).getByRole("button", { name: "Resign" }).click();

    // Starting: Ada reads first, then the game is created.
    await pa.goto(`/room/${roomId}/games/draw-guess`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa.getByRole("dialog", { name: "Take turns drawing" })).toBeVisible();
    expect(pa.url()).not.toContain("/play/");
    for (const t of ["Take turns drawing", "Guess"]) await pa.getByRole("dialog", { name: t }).getByRole("button", { name: "Next" }).click();
    await pa.getByRole("dialog", { name: "Points" }).getByRole("button", { name: "Done" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    await expect.poll(() => toured(a.id)).toContain("draw-guess");
  } finally {
    await cleanup([a.id, b.id]);
    await Promise.all([ca.close(), cb.close()]);
  }
});
