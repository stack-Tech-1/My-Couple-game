/**
 * What changes by the day and by the week, worked out from the date alone (Lagos time), so the
 * phone and the server always agree and nothing needs storing.
 *
 *  - Today's game: one Solo game, the same level for everyone, one go each. Couples compare.
 *  - The free game of the week: one Amah Plus game open to everyone, Monday to Sunday.
 */

/** Lagos date, "2026-11-14". */
export const lagosDate = (at = Date.now()) => new Date(at + 3600_000).toISOString().slice(0, 10);
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 864e5);

/** Solo games that play the same for everyone given the same seed. */
export const DAILY_GAMES = ["mama-put", "pump-am", "catch-am", "bash-am", "okada-rush", "mosquito-wahala", "blend-am", "zobo-sort", "ajo"] as const;

export type TodaysGame = { gameId: string; day: string; mode: string; seed: string };
export function todaysGame(at = Date.now()): TodaysGame {
  const day = lagosDate(at);
  const gameId = DAILY_GAMES[((dayNumber(day) % DAILY_GAMES.length) + DAILY_GAMES.length) % DAILY_GAMES.length]!;
  return { gameId, day, mode: `d-${day.replace(/-/g, "")}`, seed: `daily-${day}` };
}
export const isDailyMode = (mode: string) => /^d-\d{8}$/.test(mode);

/**
 * Plus games that take a turn as the free game of the week. Chess stays out (it's what most
 * people try Plus for), and so does After Dark.
 */
export const WEEKLY_ROTATION = [
  "naija-landlord",
  "word-duel",
  "know-me-trivia",
  "draw-guess",
  "spell-am",
  "in-sync",
  "riddles",
  "naija-trivia",
  "reflex-duel",
  "this-or-that",
  "emoji-guess",
  "memory-match",
  "pidgin-palava",
  "split-clues",
  "compliment-battle",
  "beat-the-clock",
  "dont-laugh",
] as const;

/** Monday (Lagos) of the week containing `at`. */
export function weekStart(at = Date.now()): string {
  const day = lagosDate(at);
  const n = dayNumber(day);
  // 1970-01-01 was a Thursday: day 0 is weekday 3 counting Monday as 0.
  const weekday = (n + 3) % 7;
  return new Date((n - weekday) * 864e5).toISOString().slice(0, 10);
}

/** The free game of the week, and when the week ends (Sunday night, Lagos). */
export function freeGameOfWeek(at = Date.now()): { gameId: string; week: string; endsAt: string } {
  const week = weekStart(at);
  const index = Math.floor(dayNumber(week) / 7);
  const gameId = WEEKLY_ROTATION[((index % WEEKLY_ROTATION.length) + WEEKLY_ROTATION.length) % WEEKLY_ROTATION.length]!;
  const endsAt = new Date(Date.parse(`${week}T00:00:00+01:00`) + 7 * 864e5).toISOString();
  return { gameId, week, endsAt };
}
