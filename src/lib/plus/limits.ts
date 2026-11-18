import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { soloGame } from "@/lib/solo/catalog";
import { FREE_CAREER_MODES } from "@/lib/solo/games/mama";
import { FREE_PLAYS_PER_DAY, countsAsPlay, freePlaysFor, lagosDayBounds, type FreePlays } from "./plans";
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
/** Plays that never count against the free limit: Mama Put's Yaba days. */
const freeSoloMode = (gameId: string, mode: string) => gameId === "mama-put" && (FREE_CAREER_MODES as readonly string[]).includes(mode);

export async function soloFreePlays(userId: string, gameId: string, at = Date.now()): Promise<FreePlays> {
  const { start, end } = lagosDayBounds(at);
  const g = soloGame(gameId);
  if (!g || g.kind === "daily" || !(await plusLive()) || !(await lackingPlus([userId])).length) return open(end);
  const { data } = await supabaseAdmin()
    .from("solo_runs")
    .select("mode")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .is("challenge_id", null)
    .not("mode", "like", "d-%")
    .gte("started_at", start)
    .limit(200);
  const modes = (data ?? []).map((r) => r.mode as string).filter((m) => !freeSoloMode(gameId, m));
  // Zobo Sort counts different levels, so trying the same level again costs nothing.
  if (gameId === "zobo-sort") {
    const levels = [...new Set(modes)];
    return { limited: true, used: levels.length, left: Math.max(0, freePlaysFor(gameId) - levels.length), resetsAt: end, modes: levels };
  }
  return counted(modes.length, end);
}

/** Every Solo game's plays today for one person, in one read (for the Solo home). */
export async function soloFreePlaysAll(userId: string, at = Date.now()): Promise<{ limited: boolean; used: Record<string, number>; resetsAt: string }> {
  const { start, end } = lagosDayBounds(at);
  if (!(await plusLive()) || !(await lackingPlus([userId])).length) return { limited: false, used: {}, resetsAt: end };
  const { data } = await supabaseAdmin().from("solo_runs").select("game_id, mode").eq("user_id", userId).is("challenge_id", null).not("mode", "like", "d-%").gte("started_at", start).limit(500);
  const used: Record<string, number> = {};
  const zoboLevels = new Set<string>();
  for (const r of data ?? []) {
    if (r.game_id === "zobo-sort") zoboLevels.add(r.mode as string);
    else if (!freeSoloMode(r.game_id as string, r.mode as string)) used[r.game_id as string] = (used[r.game_id as string] ?? 0) + 1;
  }
  if (zoboLevels.size) used["zobo-sort"] = zoboLevels.size;
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
