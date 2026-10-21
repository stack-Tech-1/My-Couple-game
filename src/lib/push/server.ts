import "server-only";
import webpush from "web-push";
import { OPERATOR } from "@/lib/legal";
import { supabaseAdmin } from "@/lib/supabase/server";
import { type PushKind } from "./types";

type Payload = { title: string; body: string; url: string; tag?: string; quiet?: boolean };

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
export async function notify(userId: string, kind: PushKind, payload: Payload, opts: { evenIfHere?: boolean } = {}): Promise<number> {
  try {
    const keys = await vapidKeys();
    if (!keys) return 0;
    const admin = supabaseAdmin();
    const [{ data: prof }, { data: here }, { data: subs }] = await Promise.all([
      admin.from("profiles").select("push_prefs").eq("id", userId).maybeSingle(),
      admin.from("user_presence").select("seen_at").eq("user_id", userId).maybeSingle(),
      admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId),
    ]);
    if (!subs?.length) return 0;
    const prefs = (prof?.push_prefs ?? {}) as Partial<Record<PushKind, boolean>>;
    if (prefs[kind] === false) return 0;
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
export async function notifyPartner(roomId: string, fromUserId: string, kind: PushKind, payload: Payload): Promise<number> {
  const { data } = await supabaseAdmin().from("room_members").select("user_id").eq("room_id", roomId).neq("user_id", fromUserId).maybeSingle();
  return data?.user_id ? notify(data.user_id as string, kind, payload) : 0;
}

export async function displayName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin().from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return (data?.display_name as string) || "Your partner";
}
