import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, loadEnv, onboardedUser, pairedRoom, signInPath } from "./helpers";

/**
 * Couple and Gang of the Week, end to end: Thursday asks the best weeks, nobody is shown without
 * a yes, a no passes it to the next room, Friday's winners show to everyone in the ticker and on
 * /spotlight, and people can send them love.
 */
const lagosDay = (at: number) => new Date(at + 3600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

test("Couple and Gang of the Week: asked first, decided on Friday, shown to everyone", async ({ browser, request }) => {
  // The most recent Friday that's already here (Lagos), and the Thursday before it.
  let friday = lagosDay(Date.now());
  while (new Date(`${friday}T12:00:00Z`).getUTCDay() !== 5) friday = addDays(friday, -1);
  const thursday = addDays(friday, -1);
  const inWindow = (back: number) => `${addDays(friday, -2 - back)}T12:00:00Z`; // Wednesday, Tuesday, ... of the scored week

  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const [o1, f1, o2, f2, eve] = await Promise.all(["Chidi", "Funke", "Musa", "Femi", "Eve"].map((n) => onboardedUser(n)));
  const gang1 = await friendRoom(o1, [f1], "The Crew");
  const gang2 = await friendRoom(o2, [f2], "The Lekki Lot");
  const cron = (at: string) => request.get(`/api/cron/birthdays?at=${encodeURIComponent(at)}`, { headers: { authorization: `Bearer ${loadEnv().CRON_SECRET}` } });

  try {
    // A big week for Ada and Bo: every day together, plenty of games.
    const daily = [];
    for (let i = 0; i < 7; i++) for (const u of [a.id, b.id]) daily.push({ room_id: roomId, day: inWindow(i).slice(0, 10), user_id: u, question: "Q", answer: "A" });
    await admin.from("daily_answers").insert(daily);
    const game = (room: string, players: string[], i: number) => ({ room_id: room, game_id: "whot", players, status: "finished", outcome: "win", winner: players[0], finished_at: inWindow(i % 7), created_at: inWindow(i % 7) });
    await admin.from("game_sessions").insert(Array.from({ length: 20 }, (_, i) => game(roomId, [a.id, b.id], i)));
    // Two busy friend rooms; The Crew is busier.
    await admin.from("game_sessions").insert([...Array.from({ length: 30 }, (_, i) => game(gang1.id, [o1.id, f1.id], i)), ...Array.from({ length: 12 }, (_, i) => game(gang2.id, [o2.id, f2.id], i))]);

    // Thursday: the best weeks are asked.
    expect((await cron(`${thursday}T07:00:00Z`)).status()).toBe(200);
    const { data: asked } = await admin.from("spotlights").select("room_id, kind, rank, grade, status").eq("week", friday);
    const couple = asked!.find((s) => s.room_id === roomId)!;
    expect(couple).toMatchObject({ kind: "couple", rank: 1, status: "asking", grade: "A+" });
    expect(asked!.find((s) => s.room_id === gang1.id)?.rank).toBeLessThan(asked!.find((s) => s.room_id === gang2.id)!.rank);

    // Ada is asked in the app and says yes; Bo says yes from his phone.
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(await signInPath(a.email, `/room/${roomId}`));
    const sheet = page.getByRole("dialog", { name: /in the running for Couple of the Week/ });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("7 of 7 days");
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/spotlight-ask.png`, await page.screenshot());
    await sheet.getByRole("button", { name: "Yes, show us" }).click();
    await expect(sheet).toBeHidden();
    const { data: s1 } = await admin.from("spotlights").select("id").eq("week", friday).eq("room_id", roomId).single();
    expect((await (await clientAs(b.email)).rpc("spotlight_answer", { p_spotlight: s1!.id, p_yes: true })).error).toBeNull();
    // The Crew's owner says no, so it falls to The Lekki Lot, whose owner says yes.
    const { data: g1 } = await admin.from("spotlights").select("id").eq("week", friday).eq("room_id", gang1.id).single();
    const { data: g2 } = await admin.from("spotlights").select("id").eq("week", friday).eq("room_id", gang2.id).single();
    expect((await o1.c.rpc("spotlight_answer", { p_spotlight: g1!.id, p_yes: false })).error).toBeNull();
    expect((await o2.c.rpc("spotlight_answer", { p_spotlight: g2!.id, p_yes: true })).error).toBeNull();
    // Someone outside can't answer for them.
    expect((await eve.c.rpc("spotlight_answer", { p_spotlight: s1!.id, p_yes: false })).error).not.toBeNull();

    // Friday: decided.
    expect((await cron(`${friday}T07:00:00Z`)).status()).toBe(200);
    const { data: decided } = await admin.from("spotlights").select("room_id, status").eq("week", friday).in("room_id", [roomId, gang1.id, gang2.id]);
    expect(Object.fromEntries(decided!.map((d) => [d.room_id, d.status]))).toEqual({ [roomId]: "won", [gang1.id]: "passed", [gang2.id]: "won" });

    // Everyone sees them: the ticker on Solo, and /spotlight with a heart to send.
    const ctxE = await browser.newContext({ viewport: { width: 400, height: 860 } });
    const pe = await ctxE.newPage();
    await pe.goto(await signInPath(eve.email, "/solo"));
    const ticker = pe.getByRole("link", { name: /This week on Amah/ });
    await expect(ticker).toBeVisible();
    await expect(ticker).toHaveAccessibleName(/Couple of the Week: Ada & Bo/);
    await expect(ticker).toHaveAccessibleName(/Gang of the Week: The Lekki Lot/);
    await expect(ticker).not.toHaveAccessibleName(/The Crew/);
    await ticker.click();
    await expect(pe.getByText("Ada & Bo", { exact: true })).toBeVisible();
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/spotlight.png`, await pe.screenshot({ fullPage: true }));
    await pe.getByRole("button", { name: "Send them love" }).first().click();
    await expect(pe.getByRole("button", { name: /Love sent. 1 so far/ })).toBeVisible();

    // Ada can take her yes back, and they come down for everyone.
    await page.goto("/spotlight");
    await expect(page.getByRole("button", { name: "Share your poster" }).first()).toBeVisible();
    expect((await (await clientAs(a.email)).rpc("spotlight_answer", { p_spotlight: s1!.id, p_yes: false })).error).toBeNull();
    await pe.goto("/solo");
    await expect(pe.getByRole("link", { name: /This week on Amah/ })).not.toHaveAccessibleName(/Ada & Bo/);
    await ctx.close();
    await ctxE.close();
  } finally {
    await cleanup([a.id, b.id, o1.id, f1.id, o2.id, f2.id, eve.id]);
  }
});
