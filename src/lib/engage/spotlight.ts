import "server-only";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { notify } from "@/lib/push/server";
import { lagosDate } from "./rotation";
import { gradeOf, type Grade, type SpotlightKind, type SpotlightWinner } from "./spotlight-shared";

export type { SpotlightWinner } from "./spotlight-shared";

/**
 * Couple of the Week and Gang of the Week.
 *  - Thursday (Lagos): the seven days Thursday to Wednesday are scored; the top three of each
 *    kind are asked whether they'd like to be shown.
 *  - Friday: the highest-placed room that said yes wins. Couples: both must say yes. Gangs: the
 *    owner says yes and nobody in the room says no. No answer is a no, so it falls to the next.
 *  - The winners show to everyone (the ticker and /spotlight) until the next Friday.
 */
const ASK = 3;
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 Sunday … 4 Thursday, 5 Friday
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const lagosMidnight = (day: string) => new Date(`${day}T00:00:00+01:00`).toISOString();

type Candidate = { room_id: string; members: number; days: number; games: number; coop: number; dailies: number; active: number; score: number };

/** Run by the daily job. Thursday asks, Friday decides; other days do nothing. */
export async function runSpotlight(at = Date.now()): Promise<{ asked: number; won: string[] }> {
  const today = lagosDate(at);
  const wd = weekdayOf(today);
  if (wd === 4) return { asked: await ask(addDays(today, 1)), won: [] };
  if (wd === 5) return { asked: 0, won: await decide(today) };
  return { asked: 0, won: [] };
}

/** Score the week before `friday` and ask the top rooms. Idempotent: asks once per week. */
export async function ask(friday: string): Promise<number> {
  const admin = supabaseAdmin();
  const { count } = await admin.from("spotlights").select("id", { count: "exact", head: true }).eq("week", friday);
  if (count) return 0;
  // Thursday to Wednesday: the seven full days before the asking day.
  const start = lagosMidnight(addDays(friday, -8));
  const end = lagosMidnight(addDays(friday, -1));
  let asked = 0;
  for (const kind of ["couple", "gang"] as const) {
    const { data } = await admin.rpc("spotlight_candidates", { p_kind: kind, p_start: start, p_end: end, p_limit: ASK });
    const rows = ((data ?? []) as Candidate[]).filter((c) => c.score > 0);
    if (!rows.length) continue;
    const { data: inserted } = await admin
      .from("spotlights")
      .insert(rows.map((c, i) => ({ week: friday, kind, room_id: c.room_id, rank: i + 1, score: c.score, grade: gradeOf(kind, c.score), stats: { days: c.days, games: c.games, coop: c.coop, dailies: c.dailies, active: c.active, members: c.members } })))
      .select("id, room_id");
    for (const s of inserted ?? []) {
      const { data: members } = await admin.from("room_members").select("user_id").eq("room_id", s.room_id);
      for (const m of members ?? [])
        await notify(m.user_id as string, "spotlight", {
          title: kind === "couple" ? "You two are in the running" : "Your room is in the running",
          body: kind === "couple" ? "For Couple of the Week. Say whether we can show you if you win." : "For Gang of the Week. Say whether we can show you if you win.",
          url: `/room/${s.room_id}`,
          tag: `spotlight-${friday}`,
        });
      asked++;
    }
  }
  return asked;
}

/** Friday: the highest-placed room that said yes wins; the rest pass. */
export async function decide(friday: string): Promise<string[]> {
  const admin = supabaseAdmin();
  const won: string[] = [];
  for (const kind of ["couple", "gang"] as const) {
    const { data } = await admin.from("spotlights").select("id, room_id, rank, status").eq("week", friday).eq("kind", kind).order("rank");
    const rows = data ?? [];
    if (!rows.length || rows.some((r) => r.status !== "asking")) continue;
    let winner: (typeof rows)[number] | null = null;
    for (const r of rows) {
      const [{ data: members }, { data: answers }, { data: room }] = await Promise.all([
        admin.from("room_members").select("user_id").eq("room_id", r.room_id),
        admin.from("spotlight_answers").select("user_id, yes").eq("spotlight_id", r.id),
        admin.from("rooms").select("owner_id").eq("id", r.room_id).maybeSingle(),
      ]);
      const yes = new Set((answers ?? []).filter((a) => a.yes).map((a) => a.user_id as string));
      const anyNo = (answers ?? []).some((a) => !a.yes);
      const ids = (members ?? []).map((m) => m.user_id as string);
      const agreed = kind === "couple" ? ids.length >= 2 && ids.every((id) => yes.has(id)) : !anyNo && !!room?.owner_id && yes.has(room.owner_id as string);
      if (agreed) {
        winner = r;
        break;
      }
    }
    const now = new Date().toISOString();
    for (const r of rows) await admin.from("spotlights").update({ status: winner && r.id === winner.id ? "won" : "passed", decided_at: now }).eq("id", r.id);
    if (winner) {
      won.push(winner.room_id as string);
      const { data: members } = await admin.from("room_members").select("user_id").eq("room_id", winner.room_id);
      for (const m of members ?? [])
        await notify(m.user_id as string, "spotlight", {
          title: kind === "couple" ? "You're Couple of the Week" : "You're Gang of the Week",
          body: "Everyone on Amah can see it this week. Your poster is ready to share.",
          url: "/spotlight",
          tag: `spotlight-${friday}`,
        });
    }
  }
  return won;
}

/** This week's winners, as everyone sees them. */
export async function currentSpotlight(): Promise<SpotlightWinner[]> {
  const { data } = await (await supabaseServer()).rpc("spotlight_current");
  return ((data ?? []) as SpotlightWinner[]).filter(Boolean);
}

export type SpotlightAsk = { id: string; kind: SpotlightKind; roomId: string; roomName: string; grade: Grade; stats: Record<string, number>; week: string; myAnswer: boolean | null };

/** Being asked: entries for my rooms this week that are still open. */
export async function mySpotlightAsks(userId: string): Promise<SpotlightAsk[]> {
  const supabase = await supabaseServer();
  // Still being asked (Friday's decision closes it), from this week.
  const { data } = await supabase.from("spotlights").select("id, kind, room_id, grade, stats, week, rooms(name)").eq("status", "asking").gte("week", lagosDate(Date.now() - 7 * 864e5));
  if (!data?.length) return [];
  const { data: answers } = await supabase.from("spotlight_answers").select("spotlight_id, yes").eq("user_id", userId).in("spotlight_id", data.map((d) => d.id));
  return data.map((d) => ({
    id: d.id as string,
    kind: d.kind as SpotlightKind,
    roomId: d.room_id as string,
    roomName: ((d.rooms as unknown as { name: string } | null)?.name ?? "") as string,
    grade: d.grade as Grade,
    stats: d.stats as Record<string, number>,
    week: d.week as string,
    myAnswer: ((answers ?? []).find((a) => a.spotlight_id === d.id)?.yes as boolean | undefined) ?? null,
  }));
}
