import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, onboardedUser, signInPath } from "./helpers";

/** Whot for three and Ludo for four, in a friend room: everyone's in, turns go round, boards render. */
test("group boards: Whot for three, Ludo for four", async ({ browser }) => {
  test.setTimeout(300_000);
  const people = await Promise.all([onboardedUser("Ada"), onboardedUser("Bo", "moon"), onboardedUser("Cy", "sun"), onboardedUser("Di", "fig")]);
  const [ada, bo, cy, di] = people;
  const crew = await friendRoom({ c: await clientAs(ada.email) }, [bo, cy, di]);
  const ctx = await Promise.all(people.map(() => browser.newContext({ viewport: { width: 390, height: 844 } })));
  const pages = (await Promise.all(ctx.map((c) => c.newPage()))) as [Page, Page, Page, Page];
  const [pa, pb, pc, pd] = pages;
  const errors: string[] = [];
  for (const p of pages) p.on("pageerror", (e) => errors.push(e.message));
  const shots = process.env.SHOTS_DIR;

  try {
    for (const [i, p] of pages.entries()) await p.goto(await signInPath(people[i]!.email, `/room/${crew.id}`));

    // Whot for three.
    await pa.goto(`/room/${crew.id}/games/whot`);
    await pa.getByRole("checkbox", { name: "Bo" }).click();
    await pa.getByRole("checkbox", { name: "Cy" }).click();
    // Whot takes four at most: picking a third friend still works, a fourth would not be offered.
    await pa.getByRole("button", { name: "Invite 2 friends" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const whotId = pa.url().split("/play/")[1]!;
    for (const p of [pb, pc]) {
      await p.getByRole("button", { name: "Join" }).click();
      await expect(p).toHaveURL(new RegExp(whotId));
    }
    await expect(pd.getByRole("button", { name: "Join" })).toHaveCount(0);
    const { data: w } = await admin.from("game_sessions").select("players").eq("id", whotId).single();
    expect(w!.players).toHaveLength(3);
    const others = pa.getByRole("list", { name: "Other players" });
    await expect(others.getByText("Bo")).toBeVisible();
    await expect(others.getByText("Cy")).toBeVisible();
    // Di isn't playing: the room home lists the game to watch, and the watch view hides every hand.
    await pd.goto(`/room/${crew.id}`);
    await pd.getByRole("link", { name: /Whot.*Watch/ }).click();
    await expect(pd).toHaveURL(new RegExp(`/watch/${whotId}`));
    await expect(pd.getByText(/^Live: /)).toBeVisible();
    await expect(pd.getByText(/'s turn…$/)).toBeVisible();

    // Whoever's turn it is draws from the market; the turn moves to the next seat.
    const { data: ws } = await admin.from("game_secrets").select("state").eq("session_id", whotId).single();
    const turn = (ws!.state as { turn: number }).turn;
    const order = w!.players as string[];
    const turnPage = pages[people.findIndex((x) => x.id === order[turn])]!;
    await turnPage.getByRole("button", { name: /Go to market/ }).click();
    const nextName = people.find((x) => x.id === order[(turn + 1) % 3])!;
    const nextLabel = ["Ada", "Bo", "Cy", "Di"][people.indexOf(nextName)]!;
    await expect(turnPage.getByText(`${nextLabel}'s turn…`)).toBeVisible();
    // The watcher sees the move land, live.
    await expect(pd.getByText(`${nextLabel}'s turn…`)).toBeVisible();
    if (shots) await pa.screenshot({ path: `${shots}/whot3.png`, fullPage: true });
    if (shots) await pd.screenshot({ path: `${shots}/watch.png`, fullPage: true });
    // Players get sent to play, not watch.
    await pa.goto(`/room/${crew.id}/watch/${whotId}`);
    await expect(pa).toHaveURL(new RegExp(`/play/${whotId}`));

    // Ludo for four.
    await pa.goto(`/room/${crew.id}/games/ludo`);
    for (const n of ["Bo", "Cy", "Di"]) await pa.getByRole("checkbox", { name: n }).click();
    await pa.getByRole("button", { name: "Invite 3 friends" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const ludoId = pa.url().split("/play/")[1]!;
    for (const p of [pb, pc, pd]) {
      await p.getByRole("button", { name: "Join" }).click();
      await expect(p).toHaveURL(new RegExp(ludoId));
    }
    for (const n of ["You", "Bo", "Cy", "Di"]) await expect(pa.getByText(new RegExp(`^${n} · 0/4 home$`))).toBeVisible();
    const { data: ls } = await admin.from("game_secrets").select("state").eq("session_id", ludoId).single();
    const st = ls!.state as { colours: number[]; turn: number; players: string[]; rules: { twoDice?: boolean } };
    expect(st.colours).toEqual([0, 1, 2, 3]);
    // Two dice is the default mode: whoever's turn it is rolls a pair.
    expect(st.rules.twoDice).toBe(true);
    const roller = pages[people.findIndex((x) => x.id === st.players[st.turn])]!;
    await expect(roller.getByText("Roll the dice.")).toBeVisible();
    await roller.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(roller.getByText(/^You rolled \d and \d\./)).toBeVisible();
    if (shots) await roller.screenshot({ path: `${shots}/ludo4.png`, fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await cleanup(people.map((p) => p.id));
    await Promise.all(ctx.map((c) => c.close()));
  }
});
