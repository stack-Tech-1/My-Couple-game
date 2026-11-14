import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { gameMeta, isFriendGame } from "@/games/catalog";
import { soloGame, formatScore } from "@/lib/solo/catalog";
import type { RoomBundle } from "@/lib/room/types";
import { freeGameOfWeek, lagosDate, todaysGame } from "./rotation";

export type TodayMemory = { id: string; prompt: string; when: "year" | "month" | "taken"; years: number };
export type Today = {
  day: string;
  game: { gameId: string; name: string; mode: string; scores: { userId: string; name: string; score: string | null; played: boolean }[] };
  freeGame: { gameId: string; name: string; endsAt: string } | null;
  word: { started: boolean; finished: boolean; guesses: number; solved: boolean };
  memory: TodayMemory | null;
};

/**
 * Everything for the Today card, in one go. Reads only this room's own things; the scores are
 * the room members' scores in today's game (the same level for everyone).
 */
export async function getToday(bundle: RoomBundle, at = Date.now()): Promise<Today> {
  const admin = supabaseAdmin();
  const t = todaysGame(at);
  const me = bundle.me.profile.id;
  const people = bundle.members.filter((m) => !bundle.blocked.includes(m.profile.id));
  const ids = people.map((m) => m.profile.id);
  const day = lagosDate(at);
  const [{ data: scores }, { data: runs }, { data: word }, { data: memories }] = await Promise.all([
    admin.from("solo_scores").select("user_id, score").eq("game_id", t.gameId).eq("mode", t.mode).in("user_id", ids),
    admin.from("solo_runs").select("user_id").eq("game_id", t.gameId).eq("mode", t.mode).in("user_id", ids),
    admin.from("solo_word_plays").select("guesses, solved, finished_at").eq("user_id", me).eq("day", day).maybeSingle(),
    bundle.room.kind === "couple" ? admin.from("memories").select("id, prompt, taken_on, created_at").eq("room_id", bundle.room.id).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
  ]);
  const g = soloGame(t.gameId)!;
  const best = new Map<string, number>();
  for (const s of scores ?? []) {
    const prev = best.get(s.user_id as string);
    const v = s.score as number;
    if (prev === undefined || (g.lowerIsBetter ? v < prev : v > prev)) best.set(s.user_id as string, v);
  }
  const started = new Set((runs ?? []).map((r) => r.user_id as string));

  const fw = freeGameOfWeek(at);
  const fwMeta = gameMeta(fw.gameId);
  const fits = fwMeta && (bundle.room.kind === "friends" ? isFriendGame(fw.gameId) : !fwMeta.friendsOnly);

  return {
    day,
    game: {
      gameId: t.gameId,
      name: g.name,
      mode: t.mode,
      // Me first, then everyone else by score.
      scores: people
        .map((m) => ({ userId: m.profile.id, name: m.profile.id === me ? "You" : m.profile.display_name, score: best.has(m.profile.id) ? formatScore(g, best.get(m.profile.id)!) : null, played: started.has(m.profile.id) }))
        .sort((a, b) => (a.userId === me ? -1 : b.userId === me ? 1 : (best.get(b.userId) ?? -1) - (best.get(a.userId) ?? -1))),
    },
    freeGame: fits ? { gameId: fw.gameId, name: fwMeta.name, endsAt: fw.endsAt } : null,
    word: { started: !!word, finished: !!word?.finished_at, guesses: ((word?.guesses as string[] | undefined) ?? []).length, solved: !!word?.solved },
    memory: onThisDay((memories ?? []) as { id: string; prompt: string; taken_on: string | null; created_at: string }[], day),
  };
}

/** A photo from this day: taken on this date in an earlier year, or added a year or a month ago. */
export function onThisDay(rows: { id: string; prompt: string; taken_on: string | null; created_at: string }[], day: string): TodayMemory | null {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const md = day.slice(5);
  const taken = rows.find((r) => r.taken_on && r.taken_on.slice(5) === md && Number(r.taken_on.slice(0, 4)) < y);
  if (taken) return { id: taken.id, prompt: taken.prompt, when: "taken", years: y - Number(taken.taken_on!.slice(0, 4)) };
  const lagos = (iso: string) => new Date(Date.parse(iso) + 3600_000).toISOString().slice(0, 10);
  const yearAgo = `${y - 1}-${md}`;
  const year = rows.find((r) => lagos(r.created_at) === yearAgo);
  if (year) return { id: year.id, prompt: year.prompt, when: "year", years: 1 };
  const mm = m === 1 ? 12 : m - 1;
  const monthAgo = `${m === 1 ? y - 1 : y}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const month = rows.find((r) => lagos(r.created_at) === monthAgo);
  return month ? { id: month.id, prompt: month.prompt, when: "month", years: 0 } : null;
}
