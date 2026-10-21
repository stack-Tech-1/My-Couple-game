import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
/** Monday (UTC) of last week, plus `n` days. */
const lastWeek = (n: number) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 + n);
  return d.toISOString();
};

test("streaks, levels, badges and the weekly recap", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  try {
    // Both chat today, yesterday and the day before (a 3-day streak), Ada alone 4 days ago,
    // and a busy Tuesday last week. Seeded with the service role so timestamps can be set.
    const msgs = [0, 1, 2].flatMap((n) => [
      { room_id: roomId, sender_id: a.id, body: "hi", created_at: daysAgo(n) },
      { room_id: roomId, sender_id: b.id, body: "hey", created_at: daysAgo(n) },
    ]);
    msgs.push({ room_id: roomId, sender_id: a.id, body: "alone", created_at: daysAgo(4) });
    msgs.push({ room_id: roomId, sender_id: a.id, body: "last week", created_at: lastWeek(1) }, { room_id: roomId, sender_id: b.id, body: "last week", created_at: lastWeek(1) });
    expect((await admin.from("chat_messages").insert(msgs)).error).toBeNull();
    await admin.from("nudges").insert([{ room_id: roomId, from_user: a.id, created_at: lastWeek(2) }]);

    const ca = await clientAs(a.email);
    const ce = await clientAs(eve.email);
    const { data: p, error } = await ca.rpc("room_progress", { p_room: roomId });
    expect(error).toBeNull();
    expect(p).toMatchObject({ streak: 3, messages: msgs.length, nudges: 1 });
    expect((p as { shared_days: number }).shared_days).toBeGreaterThanOrEqual(4);
    expect((await ce.rpc("room_progress", { p_room: roomId })).error).not.toBeNull();
    expect((await ce.rpc("room_week", { p_room: roomId, p_start: lastWeek(0).slice(0, 10) })).error).not.toBeNull();
    // The helper itself is never exposed.
    expect((await ca.rpc("room_activity", { p_room: roomId, p_since: "2020-01-01" })).error).not.toBeNull();

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(await signInPath(a.email, `/room/${roomId}`));
    const us = page.getByRole("region", { name: "Us" });
    await expect(us).toContainText("Level 1");
    await expect(us).toContainText("3 days");
    await expect(us.getByRole("meter")).toBeVisible();
    await us.getByRole("button", { name: /All badges/ }).click();
    await expect(us.getByText("Whot champion")).toBeVisible();
    const recap = page.getByRole("region", { name: "Last week, together" });
    await expect(recap).toContainText("Messages");
    await expect(recap).toContainText("1 of 7");
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/us-panel.png`, fullPage: true });
    await ctx.close();
  } finally {
    await cleanup([a.id, b.id, eve.id]);
  }
});
