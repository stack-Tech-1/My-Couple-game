import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, givePlus, onboardedUser, pairedRoom, signInPath } from "./helpers";

/**
 * Free plays: without Plus, each game twice a day (rooms count together, Solo per person), free
 * friend rooms play two at a time, and the Amah team (with their couple partner) has Plus free.
 */
const today = () => new Date().toISOString();
const startGame = (page: Page, body: Record<string, unknown>) =>
  page.evaluate(async (b) => {
    const r = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    return { status: r.status, text: await r.text() };
  }, body);

test("couple room: two free games of Whot a day, then the waiting screen; Plus lifts it", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"], { plus: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(await signInPath(a.email, `/room/${roomId}/games/whot`));
    await expect(page.getByText("2 free games of this left today.")).toBeVisible();
    // Two games of Whot today, one each way.
    const base = { room_id: roomId, game_id: "whot", players: [a.id, b.id], status: "finished", created_at: today() };
    await admin.from("game_sessions").insert([base, { ...base, players: [b.id, a.id] }]);
    await page.reload();
    await expect(page.getByRole("heading", { name: "It opens again at midnight" })).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(page.getByRole("link", { name: /Play as much as you like/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Today's question/ })).toBeVisible();
    // The server says no too, with when it opens again.
    const refused = await startGame(page, { gameId: "whot", roomId });
    expect(refused.status).toBe(402);
    expect(refused.text).toMatch(/opens again in/);
    // Other games keep their own plays; the daily question is never limited.
    await page.goto(`/room/${roomId}/games/ludo`);
    await expect(page.getByText("2 free games of this left today.")).toBeVisible();
    // The library card says so.
    await page.goto(`/room/${roomId}/games`);
    await expect(page.getByRole("link", { name: /Whot/ }).getByText("Back at midnight")).toBeVisible();
    // Either of them getting Plus lifts the limit for the room.
    await givePlus(b.id);
    const allowed = await startGame(page, { gameId: "whot", roomId });
    expect(allowed.status).toBe(200);
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});

test("free friend room: two at a time; with Plus, more can play", async ({ browser }) => {
  const [o, f1, f2] = await Promise.all([onboardedUser("Chidi", "fig", { plus: false }), onboardedUser("Funke", "moon", { plus: false }), onboardedUser("Musa", "wave", { plus: false })]);
  const room = await friendRoom(o, [f1, f2]);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(await signInPath(o.email, `/room/${room.id}/games/whot`));
    await expect(page.getByText(/Free games are two at a time/)).toBeVisible();
    // One friend only: picking a second replaces the first.
    await page.getByRole("radio", { name: /Funke/ }).click();
    await page.getByRole("radio", { name: /Musa/ }).click();
    await expect(page.getByRole("radio", { name: /Funke/ })).toHaveAttribute("aria-checked", "false");
    const three = await startGame(page, { gameId: "whot", roomId: room.id, opponents: [f1.id, f2.id] });
    expect(three.status).toBe(402);
    expect(three.text).toMatch(/two at a time/);
    await givePlus(o.id);
    const ok = await startGame(page, { gameId: "whot", roomId: room.id, opponents: [f1.id, f2.id] });
    expect(ok.status).toBe(200);
  } finally {
    await cleanup([o.id, f1.id, f2.id]);
    await ctx.close();
  }
});

test("Solo and Play the bot: twice a day per game, per person; challenges stay open", async ({ browser }) => {
  const me = await onboardedUser("Kemi", "fig", { plus: false });
  await admin.from("profiles").update({ solo_home: true }).eq("id", me.id);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    const run = { user_id: me.id, game_id: "bot-whot", mode: "easy", seed: "s", started_at: today() };
    await admin.from("solo_runs").insert([run, { ...run, seed: "t" }]);
    await page.goto(await signInPath(me.email, "/solo"));
    await expect(page.getByText("Every game is free twice a day.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /Whot/ }).filter({ hasText: "Back at midnight" }).first()).toBeVisible();
    await page.goto("/solo/bot-whot");
    await page.getByRole("radio", { name: /Small pikin/ }).click();
    await expect(page.getByRole("heading", { name: "It opens again at midnight" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ọ̀rọ̀ of the Day/ })).toBeVisible();
  } finally {
    await cleanup([me.id]);
    await ctx.close();
  }
});

test("the Amah team: admins and their couple partner have Plus free; friend rooms don't share it", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"], { plus: false });
  const friend = await onboardedUser("Femi", "wave", { plus: false });
  await admin.from("app_admins").insert({ user_id: a.id });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const ctxF = await browser.newContext();
  const pf = await ctxF.newPage();
  try {
    // The admin's partner can start a Plus game, which needs everyone playing to have Plus.
    await page.goto(await signInPath(b.email, `/room/${roomId}/settings/plus`));
    await expect(page.getByText(/Always on, on the house/)).toBeVisible();
    const chess = await startGame(page, { gameId: "chess", roomId });
    expect(chess.status).toBe(200);
    // A friend in a friend room with the admin doesn't get it: their chess game needs Plus.
    const fr = await friendRoom({ c: await clientAs(a.email) }, [friend]);
    await pf.goto(await signInPath(friend.email, `/room/${fr.id}/games/chess`));
    await expect(pf.getByRole("heading", { name: "Chess is on Amah Plus" })).toBeVisible();
    const refused = await startGame(pf, { gameId: "chess", roomId: fr.id, opponents: [a.id] });
    expect(refused.status).toBe(402);
  } finally {
    await admin.from("app_admins").delete().eq("user_id", a.id);
    await cleanup([a.id, b.id, friend.id]);
    await ctx.close();
    await ctxF.close();
  }
});
