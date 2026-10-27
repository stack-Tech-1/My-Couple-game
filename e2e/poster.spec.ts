import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { admin, cleanup, makeUser, pairedRoom, signInPath } from "./helpers";

test("share poster: a status-sized image of your Amah, only for people in the room", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  const base = { room_id: roomId, players: [a.id, b.id], status: "finished" };
  await admin.from("game_sessions").insert([
    { ...base, game_id: "whot", outcome: "win", winner: a.id, finished_at: new Date().toISOString() },
    { ...base, game_id: "whot", outcome: "win", winner: a.id, finished_at: new Date().toISOString() },
    { ...base, game_id: "ludo", outcome: "win", winner: b.id, finished_at: new Date().toISOString() },
  ]);
  // A pet name must never end up on a public poster.
  await admin.from("nicknames").insert({ owner_id: a.id, target_id: b.id, nickname: "Sugarplum" });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const page = await ctx.newPage();
  const ctxE = await browser.newContext();
  const pe = await ctxE.newPage();
  try {
    await page.goto(await signInPath(a.email, `/room/${roomId}/you`));
    const res = await page.request.get(`/room/${roomId}/poster`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    const png = await res.body();
    expect(png.length).toBeGreaterThan(20_000);
    expect(png.readUInt32BE(16)).toBe(1080); // width
    expect(png.readUInt32BE(20)).toBe(1920); // height
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/poster.png`, png);

    // The preview opens with a way to keep it.
    await page.getByRole("button", { name: "Share my stats" }).click();
    await expect(page.getByRole("img", { name: "Your Amah poster" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Save image" })).toBeVisible();

    // Someone outside the room gets nothing.
    await pe.goto(await signInPath(eve.email, "/"));
    expect((await pe.request.get(`/room/${roomId}/poster`)).status()).toBe(404);
  } finally {
    await cleanup([a.id, b.id, eve.id]);
    await ctx.close();
    await ctxE.close();
  }
});
