import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { oroAnswer } from "./oro-words";

export type DayWord = { day: string; word: string; naija: boolean; hint: string | null; set: boolean };

/** The word for a day: one set in the admin wins, otherwise the built-in list. */
export async function answerFor(day: string): Promise<DayWord> {
  const { data } = await supabaseAdmin().from("solo_word_days").select("word, naija, hint").eq("day", day).maybeSingle();
  if (data) return { day, word: data.word as string, naija: !!data.naija, hint: (data.hint as string | null) ?? null, set: true };
  return { day, ...oroAnswer(day), set: false };
}

/** The next `n` days' words, for the admin. */
export async function upcomingWords(from: string, n: number): Promise<DayWord[]> {
  const days = Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 864e5).toISOString().slice(0, 10));
  const { data } = await supabaseAdmin().from("solo_word_days").select("day, word, naija, hint").in("day", days);
  return days.map((day) => {
    const set = (data ?? []).find((d) => d.day === day);
    return set ? { day, word: set.word as string, naija: !!set.naija, hint: (set.hint as string | null) ?? null, set: true } : { day, ...oroAnswer(day), set: false };
  });
}
