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

    // The studio's numbers: real names only, never the pet name.
    const json = await (await page.request.get(`/room/${roomId}/poster?format=json`)).text();
    expect(json).toContain("Bo");
    expect(json).not.toContain("Sugarplum");

    // The studio: four styles to swipe through, drawn on the phone, saved as a status-sized PNG.
    await page.getByRole("button", { name: "Share my stats" }).click();
    const styles = page.getByRole("listbox", { name: "Poster styles" });
    await expect(styles.getByRole("option")).toHaveCount(4);
    await expect(styles.locator("img")).toHaveCount(4);
    await page.getByRole("button", { name: "Owambe", exact: true }).click();
    await expect(styles.getByRole("option", { name: "Owambe poster" })).toHaveAttribute("aria-selected", "true");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save image" }).click()]);
    expect(download.suggestedFilename()).toBe("my-amah-owambe.png");
    const saved = (await import("node:fs")).readFileSync((await download.path())!);
    expect(saved.readUInt32BE(16)).toBe(1080);
    expect(saved.readUInt32BE(20)).toBe(1920);
    expect(saved.length).toBeGreaterThan(50_000);
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/poster-owambe.png`, saved);

    // Someone outside the room gets nothing.
    await pe.goto(await signInPath(eve.email, "/"));
    expect((await pe.request.get(`/room/${roomId}/poster`)).status()).toBe(404);
  } finally {
    await cleanup([a.id, b.id, eve.id]);
    await ctx.close();
    await ctxE.close();
  }
});
