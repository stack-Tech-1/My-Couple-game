import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { plusLive } from "@/lib/plus/server";

export type Audience = "all" | "free" | "plus" | "waiting";
export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Everyone",
  free: "Free plan only",
  plus: "Amah Plus only",
  waiting: "Waiting for their person",
};

/** Of these people, the ones an announcement for `audience` should reach. */
export async function inAudience(userIds: string[], audience: Audience): Promise<Set<string>> {
  if (audience === "all" || !userIds.length) return new Set(userIds);
  const admin = supabaseAdmin();
  if (audience === "waiting") {
    // In a couple room on their own.
    const { data: rooms } = await admin.from("rooms").select("id").eq("kind", "couple");
    const coupleIds = (rooms ?? []).map((r) => r.id as string);
    const { data: members } = coupleIds.length ? await admin.from("room_members").select("room_id, user_id").in("room_id", coupleIds) : { data: [] };
    const count = new Map<string, number>();
    for (const m of members ?? []) count.set(m.room_id as string, (count.get(m.room_id as string) ?? 0) + 1);
    return new Set((members ?? []).filter((m) => count.get(m.room_id as string) === 1).map((m) => m.user_id as string).filter((id) => userIds.includes(id)));
  }
  // Plus or free. While Plus isn't live, nobody is on Plus.
  const now = new Date().toISOString();
  const live = await plusLive();
  const { data: seats } = live ? await admin.from("plus_seats").select("user_id").is("revoked_at", null).lte("starts_at", now).gt("ends_at", now).limit(50000) : { data: [] };
  const withPlus = new Set((seats ?? []).map((s) => s.user_id as string));
  return new Set(userIds.filter((id) => (audience === "plus" ? withPlus.has(id) : !withPlus.has(id))));
}
