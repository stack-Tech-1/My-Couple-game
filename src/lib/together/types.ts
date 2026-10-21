export const MOODS = [
  { key: "great", label: "Great", emoji: "😄" },
  { key: "happy", label: "Happy", emoji: "🙂" },
  { key: "loved", label: "Loved", emoji: "🥰" },
  { key: "calm", label: "Calm", emoji: "😌" },
  { key: "tired", label: "Tired", emoji: "😴" },
  { key: "stressed", label: "Stressed", emoji: "😣" },
  { key: "sad", label: "Low", emoji: "😔" },
  { key: "missing_you", label: "Missing you", emoji: "🥺" },
] as const;
export type MoodKey = (typeof MOODS)[number]["key"];
export const moodInfo = (k: string) => MOODS.find((m) => m.key === k);

export type Countdown = { id: string; title: string; on_date: string };
export type Mood = { user_id: string; mood: MoodKey; note: string | null };
export type ChallengeState = { id: string; challenge_id: string; started_on: string; today: number; checks: { day: number; user_id: string }[] } | null;
export type TogetherState = { countdowns: Countdown[]; moods: Mood[]; challenge: ChallengeState };

const DAY = 86_400_000;
/** Whole days from today (UTC) to a YYYY-MM-DD date; negative once it has passed. */
export function daysUntil(date: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / DAY);
}

/** Days together, counting the first day as day 1. */
export const daysTogether = (since: string, now = new Date()) => 1 - daysUntil(since, now);

/** Is today the anniversary (same month and day, at least a year on)? Feb 29 falls on Feb 28. */
export function isAnniversary(since: string, now = new Date()): number | null {
  const [y, m, d] = since.split("-").map(Number) as [number, number, number];
  const years = now.getUTCFullYear() - y;
  if (years < 1) return null;
  const leapless = m === 2 && d === 29 && !(now.getUTCFullYear() % 4 === 0 && (now.getUTCFullYear() % 100 !== 0 || now.getUTCFullYear() % 400 === 0));
  return now.getUTCMonth() + 1 === m && now.getUTCDate() === (leapless ? 28 : d) ? years : null;
}
