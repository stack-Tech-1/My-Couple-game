import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { lagosDate, weekStart } from "./rotation";
import { weeklyTable, type TableRow } from "./weekly-table";

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const lagosMidnight = (day: string) => new Date(`${day}T00:00:00+01:00`).toISOString();

async function tableFor(roomId: string, memberIds: string[], monday: string): Promise<TableRow[]> {
  const { data } = await supabaseAdmin()
    .from("game_sessions")
    .select("players, winner, game_id")
    .eq("room_id", roomId)
    .eq("status", "finished")
    .gte("finished_at", lagosMidnight(monday))
    .lt("finished_at", lagosMidnight(addDays(monday, 7)))
    .limit(2000);
  return weeklyTable((data ?? []) as { players: string[]; winner: string | null; game_id: string }[], memberIds);
}

export type FriendWeek = { rows: TableRow[]; lastWinner: TableRow | null; race: { rank: number; of: number } | null };

/** This week's table, last week's winner, and where the room stands in the Gang of the Week race. */
export async function friendWeek(roomId: string, memberIds: string[], at = Date.now()): Promise<FriendWeek> {
  const monday = weekStart(at);
  const [rows, last, race] = await Promise.all([tableFor(roomId, memberIds, monday), tableFor(roomId, memberIds, addDays(monday, -7)), gangRace(raceStart(at))]);
  const lastWinner = last[0] && last[0].points > 0 ? last[0] : null;
  const i = race.indexOf(roomId);
  return { rows, lastWinner, race: i >= 0 ? { rank: i + 1, of: race.length } : null };
}

/** Gang of the Week scores Thursday to Wednesday: the race so far starts on the latest Thursday. */
export function raceStart(at = Date.now()): string {
  let d = lagosDate(at);
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 4) d = addDays(d, -1);
  return d;
}

/**
 * The friend rooms ranked by the race so far, the way Gang of the Week scores them. Worked out at
 * most once an hour for everyone, since it looks at every room.
 */
const gangRace = (thursday: string) =>
  unstable_cache(
    async () => {
      const { data } = await supabaseAdmin().rpc("spotlight_candidates", { p_kind: "gang", p_start: lagosMidnight(thursday), p_end: new Date().toISOString(), p_limit: 50 });
      return ((data ?? []) as { room_id: string }[]).map((r) => r.room_id);
    },
    ["gang-race", thursday],
    { revalidate: 3600 },
  )();
