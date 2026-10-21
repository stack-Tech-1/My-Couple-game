import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { daysUntil, type ChallengeState, type Countdown, type Mood, type TogetherState } from "./types";

const utcToday = () => new Date().toISOString().slice(0, 10);

export async function getTogether(roomId: string): Promise<TogetherState> {
  const supabase = await supabaseServer();
  const today = utcToday();
  const [{ data: cds }, { data: moods }, { data: ch }] = await Promise.all([
    supabase.from("countdowns").select("id, title, on_date").eq("room_id", roomId).gte("on_date", today).order("on_date").limit(5),
    supabase.from("moods").select("user_id, mood, note").eq("room_id", roomId).eq("day", today),
    supabase.from("room_challenges").select("id, challenge_id, started_on").eq("room_id", roomId).is("ended_at", null).maybeSingle(),
  ]);
  let challenge: ChallengeState = null;
  if (ch) {
    const { data: checks } = await supabase.from("challenge_checks").select("day, user_id").eq("room_challenge_id", ch.id);
    challenge = {
      id: ch.id as string,
      challenge_id: ch.challenge_id as string,
      started_on: ch.started_on as string,
      today: Math.min(30, 1 - daysUntil(ch.started_on as string)),
      checks: (checks ?? []) as { day: number; user_id: string }[],
    };
  }
  return { countdowns: (cds ?? []) as Countdown[], moods: (moods ?? []) as Mood[], challenge };
}
