import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notify } from "@/lib/push/server";
import { withPetName } from "@/lib/push/petname";
import { daysUntil, todayIn, whenLabel } from "./birthdays";

/** Most of Amah is in Nigeria, so the daily reminder works on Lagos dates. */
const ZONE = "Africa/Lagos";
const HEADS_UP_DAYS = 3;

/**
 * Daily: everyone whose birthday is today or in three days. Their roommates get a push (with any pet
 * name they use for them), and on the day the birthday person gets one too. People who blocked
 * them are skipped. Returns counts for the cron log.
 */
export async function sendBirthdayReminders(now: Date): Promise<{ people: number; sent: number }> {
  const admin = supabaseAdmin();
  const today = todayIn(now, ZONE);
  const { data: all } = await admin.from("profiles").select("id, display_name, birth_month, birth_day").not("birth_month", "is", null);
  const due = (all ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string, m: p.birth_month as number, d: p.birth_day as number }))
    .map((p) => ({ ...p, n: daysUntil(p.m, p.d, today) }))
    .filter((p) => p.n === 0 || p.n === HEADS_UP_DAYS);

  let sent = 0;
  for (const p of due) {
    const tag = `birthday-${p.id}-${today.y}-${p.n}`;
    const { data: mine } = await admin.from("room_members").select("room_id").eq("user_id", p.id);
    const roomIds = (mine ?? []).map((r) => r.room_id as string);
    if (roomIds.length) {
      const [{ data: members }, { data: blockers }] = await Promise.all([
        admin.from("room_members").select("room_id, user_id").in("room_id", roomIds).neq("user_id", p.id),
        admin.from("blocks").select("blocker_id").eq("blocked_id", p.id),
      ]);
      const skip = new Set((blockers ?? []).map((b) => b.blocker_id as string));
      // One push per person, linking to the first room they share.
      const roomFor = new Map<string, string>();
      for (const m of members ?? []) if (!skip.has(m.user_id as string) && !roomFor.has(m.user_id as string)) roomFor.set(m.user_id as string, m.room_id as string);
      const to = [...roomFor.keys()];
      const { data: nicks } = to.length ? await admin.from("nicknames").select("owner_id, nickname").eq("target_id", p.id).in("owner_id", to) : { data: [] };
      const nickOf = new Map((nicks ?? []).map((n) => [n.owner_id as string, n.nickname as string]));
      const payload =
        p.n === 0
          ? { title: `It's ${p.name}'s birthday today`, body: "Send them some love on Amah." }
          : { title: `${p.name}'s birthday is ${whenLabel(p.m, p.d, today)}`, body: "Three days to plan something sweet." };
      const counts = await Promise.all(
        to.map((id) => notify(id, "birthdays", withPetName({ ...payload, url: `/room/${roomFor.get(id)}`, tag }, p.name, nickOf.get(id)), { evenIfHere: true })),
      );
      sent += counts.reduce((a, b) => a + b, 0);
    }
    if (p.n === 0) {
      sent += await notify(p.id, "birthdays", { title: `Happy birthday, ${p.name}!`, body: "Your people have been told. Have the best day.", url: "/room", tag }, { evenIfHere: true });
    }
  }
  return { people: due.length, sent };
}
