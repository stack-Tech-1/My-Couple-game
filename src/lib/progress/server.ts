import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { EMPTY_STATS, type Stats } from "./model";

export async function getProgress(roomId: string): Promise<Stats> {
  const { data } = await (await supabaseServer()).rpc("room_progress", { p_room: roomId });
  return { ...EMPTY_STATS, ...((data ?? {}) as Partial<Stats>) };
}

export type Week = {
  start: string;
  games: number;
  wins: Record<string, number>;
  top_game: string | null;
  dailies: number;
  messages: number;
  voice: number;
  nudges: number;
  shared_days: number;
};

/** Monday (UTC) of the week before this one. */
export function lastWeekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday - 7);
  return d.toISOString().slice(0, 10);
}

export async function getLastWeek(roomId: string): Promise<Week | null> {
  const { data } = await (await supabaseServer()).rpc("room_week", { p_room: roomId, p_start: lastWeekStart() });
  const w = data as Week | null;
  // Nothing happened: no card (a recap of zeros helps nobody).
  return w && (w.games || w.dailies || w.messages || w.nudges) ? w : null;
}
