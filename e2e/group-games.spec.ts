import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, onboardedUser, signInPath } from "./helpers";

/** Group games in a three-person friend room: Most Likely To end to end, and a three-way riddle round. */
test("group games: three friends play Most Likely To and Riddles together", async ({ browser }) => {
  test.setTimeout(300_000);
  const ada = await onboardedUser("Ada");
  const bo = await onboardedUser("Bo", "moon");
  const cy = await onboardedUser("Cy", "sun");
  const crew = await friendRoom({ c: await clientAs(ada.email) }, [bo, cy]);
  const ctx = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const pages = (await Promise.all(ctx.map((c) => c.newPage()))) as [Page, Page, Page];
  const [pa, pb, pc] = pages;
  const errors: string[] = [];
  for (const p of pages) p.on("pageerror", (e) => errors.push(e.message));

  async function startWithEveryone(game: string) {
    await pa.goto(`/room/${crew.id}/games/${game}`);
    await pa.getByRole("checkbox", { name: "Bo" }).click();
    await pa.getByRole("checkbox", { name: "Cy" }).click();
    await pa.getByRole("button", { name: "Invite 2 friends" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const sessionId = pa.url().split("/play/")[1]!;
    for (const p of [pb, pc]) {
      await p.getByRole("button", { name: "Join" }).click();
      await expect(p).toHaveURL(new RegExp(sessionId));
    }
    return sessionId;
  }

  try {
    await pa.goto(await signInPath(ada.email, `/room/${crew.id}`));
    await pb.goto(await signInPath(bo.email, `/room/${crew.id}`));
    await pc.goto(await signInPath(cy.email, `/room/${crew.id}`));

    // Most Likely To: everyone votes for Bo every time.
    const ml = await startWithEveryone("most-likely");
    const { data: s1 } = await admin.from("game_sessions").select("players").eq("id", ml).single();
    expect(s1!.players).toHaveLength(3);
    for (let i = 0; i < 8; i++) {
      for (const p of pages) {
        await expect(p.getByText(`${i + 1} of 8`).first()).toBeVisible();
        const bob = p.getByRole("button", { name: p === pb ? "You" : "Bo", exact: true });
        await bob.click();
      }
      for (const p of pages) await p.getByRole("button", { name: i === 7 ? "See the verdict" : "Next one" }).click();
    }
    await expect(pa.getByText("Most likely to everything: Bo.")).toBeVisible();
    await expect(pb.getByText("Most likely to everything: you.")).toBeVisible();
    const { data: done1 } = await admin.from("game_sessions").select("status, outcome").eq("id", ml).single();
    expect(done1).toMatchObject({ status: "finished", outcome: "complete" });

    // Word Duel for three: Bo guesses wrong, Ada cracks it; everyone sees who won.
    await pa.goto(`/room/${crew.id}`);
    const wd = await startWithEveryone("word-duel");
    const { data: wsec } = await admin.from("game_secrets").select("state").eq("session_id", wd).single();
    const target = (wsec!.state as { target: string }).target;
    for (const p of pages) {
      await p.waitForLoadState("networkidle");
      await expect(p.getByRole("button", { name: "Enter" })).toBeEnabled();
    }
    const typeWord = async (page: Page, w: string) => {
      for (const ch of w) await page.keyboard.press(ch);
      await page.keyboard.press("Enter");
    };
    await typeWord(pb, target === "crane" ? "slate" : "crane");
    await expect(pa.getByText("1/6 guesses")).toBeVisible();
    await typeWord(pa, target);
    await expect(pa.locator("#result-title")).toHaveText("You won.");
    await expect(pc.getByText("Ada got there first.")).toBeVisible();

    // Riddles for three: the answer waits until all three have picked.
    await pa.goto(`/room/${crew.id}`);
    const rid = await startWithEveryone("riddles");
    const { data: secret } = await admin.from("game_secrets").select("state").eq("session_id", rid).single();
    const first = (secret!.state as { items: { q: string; options: string[]; answer: number }[] }).items[0]!;
    const right = first.options[first.answer]!;
    await pa.getByRole("button", { name: right, exact: true }).click();
    await pb.getByRole("button", { name: right, exact: true }).click();
    await expect(pa.getByText("Waiting for Cy to answer…")).toBeVisible();
    await expect(pc.getByText("2 of 2 have answered")).toBeVisible();
    await expect(pa.getByText("You got it.")).toHaveCount(0);
    await pc.getByRole("button", { name: first.options[(first.answer + 1) % 4]!, exact: true }).click();
    await expect(pa.getByText("You got it.")).toBeVisible();
    await expect(pc.getByText("Not this time.")).toBeVisible();
    await expect(pa.getByText("Cy said")).toBeVisible();

    // Leaving a group game ends it for everyone, with no winner.
    await pa.getByRole("button", { name: "Resign" }).click();
    await expect(pa.getByText("The game ends for everyone, with no winner.")).toBeVisible();
    await pa.getByRole("dialog").getByRole("button", { name: "Resign" }).click();
    await expect.poll(async () => (await admin.from("game_sessions").select("status, outcome, winner").eq("id", rid).single()).data).toMatchObject({ status: "finished", outcome: "complete", winner: null });
    expect(errors).toEqual([]);
  } finally {
    await cleanup([ada.id, bo.id, cy.id]);
    await Promise.all(ctx.map((c) => c.close()));
  }
});
