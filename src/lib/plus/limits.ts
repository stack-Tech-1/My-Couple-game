import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { soloGame } from "@/lib/solo/catalog";
import { FREE_PLAYS_PER_DAY, countsAsPlay, lagosDayBounds, type FreePlays } from "./plans";
import { lackingPlus, plusLive } from "./server";

const open = (resetsAt: string): FreePlays => ({ limited: false, used: 0, left: Infinity, resetsAt });
const counted = (used: number, resetsAt: string): FreePlays => ({ limited: true, used, left: Math.max(0, FREE_PLAYS_PER_DAY - used), resetsAt });

/** Is this a free room (nobody in it has Plus, and Plus is live)? */
export async function freeRoom(memberIds: string[]): Promise<boolean> {
  if (!(await plusLive())) return false;
  const lacking = await lackingPlus(memberIds);
  return lacking.length === memberIds.length;
}

/** Free plays left today for a room game. Counted per room: a game you play together counts for you both. */
export async function roomFreePlays(roomId: string, memberIds: string[], gameId: string, at = Date.now()): Promise<FreePlays> {
  const { start, end } = lagosDayBounds(at);
  if (!countsAsPlay(gameId) || !(await freeRoom(memberIds))) return open(end);
  const { count } = await supabaseAdmin()
    .from("game_sessions")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("game_id", gameId)
    .gte("created_at", start);
  return counted(count ?? 0, end);
}

/** Free plays left today in a Solo or bot game, for one person. Challenges and today's game don't count. */
export async function soloFreePlays(userId: string, gameId: string, at = Date.now()): Promise<FreePlays> {
  const { start, end } = lagosDayBounds(at);
  const g = soloGame(gameId);
  if (!g || g.kind === "daily" || !(await plusLive()) || !(await lackingPlus([userId])).length) return open(end);
  const { count } = await supabaseAdmin()
    .from("solo_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .is("challenge_id", null)
    .not("mode", "like", "d-%")
    .gte("started_at", start);
  return counted(count ?? 0, end);
}

/** Every Solo game's plays today for one person, in one read (for the Solo home). */
export async function soloFreePlaysAll(userId: string, at = Date.now()): Promise<{ limited: boolean; used: Record<string, number>; resetsAt: string }> {
  const { start, end } = lagosDayBounds(at);
  if (!(await plusLive()) || !(await lackingPlus([userId])).length) return { limited: false, used: {}, resetsAt: end };
  const { data } = await supabaseAdmin().from("solo_runs").select("game_id").eq("user_id", userId).is("challenge_id", null).not("mode", "like", "d-%").gte("started_at", start).limit(500);
  const used: Record<string, number> = {};
  for (const r of data ?? []) used[r.game_id as string] = (used[r.game_id as string] ?? 0) + 1;
  return { limited: true, used, resetsAt: end };
}

/** Every room game's plays today in one room, in one read (for the game library). The caller decides whether the room is free. */
export async function roomPlaysToday(roomId: string, at = Date.now()): Promise<{ used: Record<string, number>; resetsAt: string }> {
  const { start, end } = lagosDayBounds(at);
  const { data } = await supabaseAdmin().from("game_sessions").select("game_id").eq("room_id", roomId).gte("created_at", start).limit(500);
  const used: Record<string, number> = {};
  for (const r of data ?? []) if (countsAsPlay(r.game_id as string)) used[r.game_id as string] = (used[r.game_id as string] ?? 0) + 1;
  return { used, resetsAt: end };
}
