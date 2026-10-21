import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

/** Subscriptions, presence and nudges are private; the push keys never leave the server. */
test("push data stays private", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(eve.email);
    const sub = (user: string) => ({ user_id: user, endpoint: `https://push.example.test/${user}/${Date.now()}`, p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" });

    expect((await ca.from("push_subscriptions").insert(sub(a.id))).error).toBeNull();
    expect((await ca.from("push_subscriptions").insert(sub(b.id))).error).not.toBeNull();
    expect((await cb.from("push_subscriptions").select("id")).data).toEqual([]);
    // Nobody but the server reads the key pair.
    expect((await ca.from("app_secrets").select("key")).data ?? []).toEqual([]);
    // Presence: your own row only.
    expect((await ca.from("user_presence").upsert({ user_id: a.id, seen_at: new Date().toISOString() })).error).toBeNull();
    expect((await ca.from("user_presence").upsert({ user_id: b.id, seen_at: new Date().toISOString() })).error).not.toBeNull();
    expect((await cb.from("user_presence").select("user_id")).data).toEqual([]);
    // Nudges: from yourself, within your room.
    expect((await ca.from("nudges").insert({ room_id: roomId, from_user: a.id })).error).toBeNull();
    expect((await ca.from("nudges").insert({ room_id: roomId, from_user: b.id })).error).not.toBeNull();
    expect((await ce.from("nudges").insert({ room_id: roomId, from_user: eve.id })).error).not.toBeNull();
    expect((await cb.from("nudges").select("from_user")).data).toEqual([{ from_user: a.id }]);
    expect((await ce.from("nudges").select("id")).data).toEqual([]);
  } finally {
    await cleanup([a.id, b.id, eve.id]);
  }
});

test("a nudge lands live, presence is tracked, and notification settings show", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  const SHOTS = process.env.SHOTS_DIR;

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pa.waitForTimeout(1500);

    // The app reports that Bo is here (so pushes skip him).
    await expect.poll(async () => (await admin.from("user_presence").select("seen_at").eq("user_id", b.id).maybeSingle()).data?.seen_at, { timeout: 15_000 }).toBeTruthy();
    const seen = (await admin.from("user_presence").select("seen_at").eq("user_id", b.id).single()).data!.seen_at as string;
    expect(Date.now() - Date.parse(seen)).toBeLessThan(60_000);

    await pa.getByRole("button", { name: /Send Bo a heart/ }).click();
    await expect(pb.getByText("Ada is thinking of you")).toBeVisible({ timeout: 8000 });
    if (SHOTS) await pb.screenshot({ path: `${SHOTS}/nudge.png` });
    await expect.poll(async () => (await admin.from("nudges").select("id").eq("room_id", roomId)).data?.length).toBe(1);
    // Send one back from the toast.
    await pb.getByRole("button", { name: "Send one back" }).click();
    await expect(pa.getByText("Bo is thinking of you")).toBeVisible({ timeout: 8000 });

    // Settings: the notifications section explains what's possible on this browser.
    await pa.goto(`/room/${roomId}/settings#notifications`);
    const section = pa.locator("#notifications");
    await expect(section.getByRole("switch", { name: "Your turn" })).toBeVisible();
    await section.getByRole("switch", { name: "Chat messages" }).click();
    await expect.poll(async () => ((await admin.from("profiles").select("push_prefs").eq("id", a.id).single()).data!.push_prefs as { messages: boolean }).messages).toBe(false);
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/notification-settings.png` });

    expect(errors).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
    await cleanup([a.id, b.id]);
  }
});
