"use server";

import { after } from "next/server";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { getMyRoom, getUser } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { displayName, notify, notifyPartner } from "./server";
import { PUSH_KINDS } from "./types";

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyError(e) });

const subscription = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

/** Remember this device for notifications. A device moving to another account moves with it. */
export async function savePushSubscription(sub: unknown, device: unknown): Promise<ActionResult> {
  const parsed = subscription.safeParse(sub);
  if (!parsed.success) return { ok: false, error: "This browser gave us an unusable subscription." };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const admin = supabaseAdmin();
  await admin.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await admin.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    device: typeof device === "string" ? device.slice(0, 120) : null,
  });
  return error ? fail(error) : { ok: true, data: null };
}

export async function removePushSubscription(endpoint: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user || typeof endpoint !== "string") return { ok: true, data: null };
  await (await supabaseServer()).from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: true, data: null };
}

export async function setPushPrefs(prefs: unknown): Promise<ActionResult> {
  const parsed = z.object(Object.fromEntries(PUSH_KINDS.map((k) => [k, z.boolean()]))).safeParse(prefs);
  if (!parsed.success) return { ok: false, error: "Those settings didn't add up." };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const { error } = await (await supabaseServer()).from("profiles").update({ push_prefs: parsed.data }).eq("id", user.id);
  return error ? fail(error) : { ok: true, data: null };
}

/** A test notification to all of the caller's own devices, to check it works. */
export async function sendTestPush(): Promise<ActionResult<{ sent: number }>> {
  const user = await getUser();
  if (!user) return fail("not signed in");
  const sent = await notify(user.id, "nudges", { title: "Notifications are on", body: "This is how Amah will let you know it's your turn.", url: "/room", tag: "test" }, { evenIfHere: true });
  return { ok: true, data: { sent } };
}

/** "Thinking of you": a heart to your partner. Instant if they're in the app, a notification if not. */
export async function sendNudge(): Promise<ActionResult> {
  const bundle = await getMyRoom();
  if (!bundle?.partner) return { ok: false, error: "Nudges need two." };
  const { error } = await (await supabaseServer()).from("nudges").insert({ room_id: bundle.room.id, from_user: bundle.me.profile.id });
  if (error) return error.message.includes("rate limited") ? { ok: false, error: "That's a lot of love for one hour. Save some for later." } : fail(error);
  const name = bundle.me.profile.display_name || "Your partner";
  after(() => notifyPartner(bundle.room.id, bundle.me.profile.id, "nudges", { title: `${name} is thinking of you`, body: "Open Amah to send one back.", url: `/room/${bundle.room.id}`, tag: "nudge" }));
  return { ok: true, data: null };
}

/** Called by the sender's app after a chat message is saved. */
export async function notifyChatMessage(messageId: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(messageId);
  const user = await getUser();
  if (!id.success || !user) return { ok: true, data: null };
  const { data: m } = await (await supabaseServer()).from("chat_messages").select("room_id, sender_id, kind, body").eq("id", id.data).maybeSingle();
  if (!m || m.sender_id !== user.id) return { ok: true, data: null };
  after(async () => {
    const name = await displayName(user.id);
    const body = m.kind === "voice" ? "🎤 Voice message" : m.kind === "sticker" ? "Sent a sticker" : String(m.body ?? "").slice(0, 120);
    await notifyPartner(m.room_id as string, user.id, "messages", { title: name, body, url: `/room/${m.room_id}?chat=1`, tag: `chat-${m.room_id}` });
  });
  return { ok: true, data: null };
}
