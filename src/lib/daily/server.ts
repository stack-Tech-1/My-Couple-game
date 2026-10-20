import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { questionFor, utcDay } from "./question";
import { dailyQuestions } from "@/lib/content/server";

export type DailyRow = { day: string; user_id: string; question: string; answer: string };
export type DailyState = {
  day: string;
  question: string;
  mine: string | null;
  partnerAnswered: boolean;
  /** Only present once both have answered (enforced by RLS, not just here). */
  theirs: string | null;
  streak: number;
  past: { day: string; question: string; mine: string; theirs: string }[];
};

export async function getDaily(roomId: string, me: string): Promise<DailyState> {
  const supabase = await supabaseServer();
  const day = utcDay();
  const [{ data: status }, { data: rows }] = await Promise.all([
    supabase.rpc("daily_status", { p_room: roomId }),
    supabase.from("daily_answers").select("day, user_id, question, answer").eq("room_id", roomId).order("day", { ascending: false }).limit(30),
  ]);
  const st = (status as { mine: boolean; partner: boolean; streak: number }[] | null)?.[0];
  const all = (rows ?? []) as DailyRow[];
  const today = all.filter((r) => r.day === day);
  const byDay = new Map<string, DailyRow[]>();
  for (const r of all) if (r.day !== day) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  const past = [...byDay.entries()]
    .filter(([, rs]) => rs.length === 2)
    .slice(0, 7)
    .map(([d, rs]) => ({ day: d, question: rs[0]!.question, mine: rs.find((r) => r.user_id === me)!.answer, theirs: rs.find((r) => r.user_id !== me)!.answer }));

  return {
    day,
    question: today[0]?.question ?? questionFor(roomId, day, await dailyQuestions()),
    mine: today.find((r) => r.user_id === me)?.answer ?? null,
    partnerAnswered: st?.partner ?? false,
    theirs: today.find((r) => r.user_id !== me)?.answer ?? null,
    streak: st?.streak ?? 0,
    past,
  };
}