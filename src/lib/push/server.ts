import "server-only";
import webpush from "web-push";
import { OPERATOR } from "@/lib/legal";
import { supabaseAdmin } from "@/lib/supabase/server";
import { type PushKind } from "./types";

import { withPetName, type Payload } from "./petname";
import { inQuietHours } from "./quiet";

/** Someone counts as "here" if their app sent a heartbeat this recently (see Heartbeat). */
const HERE_MS = 70_000;

let vapid: Promise<{ publicKey: string; privateKey: string } | null> | null = null;
/** The VAPID key pair lives in app_secrets (npm run push:keys). Cached per server instance. */
export function vapidKeys() {
  vapid ??= (async () => {
    const { data } = await supabaseAdmin().from("app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private"]);
    const get = (k: string) => data?.find((r) => r.key === k)?.value as string | undefined;
    const publicKey = get("vapid_public");
    const privateKey = get("vapid_private");
    if (!publicKey || !privateKey) {
      vapid = null; // try again next time, e.g. after the keys are created
      return null;
    }
    return { publicKey, privateKey };
  })();
  return vapid;
}

/**
 * Notify one person on every device they've allowed. Skips them when they're looking at Amah right
 * now (they'll see it there) or have that kind switched off. Never throws: a failed notification
 * must never fail the action that caused it.
 */
export async function notify(userId: string, kind: PushKind, payload: Payload, opts: { evenIfHere?: boolean; evenIfQuiet?: boolean } = {}): Promise<number> {
  try {
    const keys = await vapidKeys();
    if (!keys) return 0;
    const admin = supabaseAdmin();
    const [{ data: prof }, { data: here }, { data: subs }] = await Promise.all([
      admin.from("profiles").select("push_prefs, quiet_start, quiet_end, time_zone").eq("id", userId).maybeSingle(),
      admin.from("user_presence").select("seen_at").eq("user_id", userId).maybeSingle(),
      admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId),
    ]);
    if (!subs?.length) return 0;
    const prefs = (prof?.push_prefs ?? {}) as Partial<Record<PushKind, boolean>>;
    if (prefs[kind] === false) return 0;
    // Quiet hours: nothing buzzes; it's all waiting in the app when they're back.
    if (!opts.evenIfQuiet && inQuietHours(prof?.quiet_start as number | null, prof?.quiet_end as number | null, prof?.time_zone as string | null, new Date())) return 0;
    if (!opts.evenIfHere && here?.seen_at && Date.now() - Date.parse(here.seen_at as string) < HERE_MS) return 0;

    webpush.setVapidDetails(`mailto:${OPERATOR.email}`, keys.publicKey, keys.privateKey);
    const body = JSON.stringify(payload);
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, body, { TTL: 60 * 60 * 24, urgency: "high" });
          sent++;
          await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
        } catch (e) {
          // Gone or invalid: the browser revoked it, or the app was uninstalled.
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410 || code === 403) await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }),
    );
    return sent;
  } catch {
    return 0;
  }
}

/** Notify the other member of a room. */
/**
 * Notifies the other people in a room: your partner in a couple room, everyone else in a friend
 * room, or only `only` if given. Anyone who has blocked the sender is skipped.
 */
export async function notifyPartner(roomId: string, fromUserId: string, kind: PushKind, payload: Payload, only?: string[]): Promise<number> {
  const admin = supabaseAdmin();
  const [{ data: members }, { data: blockers }] = await Promise.all([
    admin.from("room_members").select("user_id").eq("room_id", roomId).neq("user_id", fromUserId),
    admin.from("blocks").select("blocker_id").eq("blocked_id", fromUserId),
  ]);
  const skip = new Set((blockers ?? []).map((b) => b.blocker_id as string));
  const to = (members ?? []).map((m) => m.user_id as string).filter((id) => !skip.has(id) && (!only || only.includes(id)));
  // Anyone who gave the sender a pet name sees it in the notification too ("Baby just played").
  const [{ data: nicks }, real] = await Promise.all([
    to.length ? admin.from("nicknames").select("owner_id, nickname").eq("target_id", fromUserId).in("owner_id", to) : Promise.resolve({ data: [] }),
    displayName(fromUserId),
  ]);
  const nickOf = new Map((nicks ?? []).map((n) => [n.owner_id as string, n.nickname as string]));
  const sent = await Promise.all(to.map((id) => notify(id, kind, withPetName(payload, real, nickOf.get(id)))));
  return sent.reduce((a, b) => a + b, 0);
}

export async function displayName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin().from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return (data?.display_name as string) || "Your partner";
}
