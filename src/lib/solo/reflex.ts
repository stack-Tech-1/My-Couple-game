/**
 * Reflex Training as a penalty shoot-out: the score is still the average reaction time over five
 * kicks (lower is better). A kick counts as saved when you dived in under SAVE_MS; that's only a
 * way of reading the times, and changes nothing about the score.
 */
export const SAVE_MS = 300;

/** The last game's times, kept for the finish screen (which only gets the score). */
export type ReflexLast = { times: number[] };
export const REFLEX_LAST = "amah:reflex:last";

export const savesOf = (times: number[]) => times.filter((t) => t < SAVE_MS).length;

/** The keeper's rank for an average time. */
export function keeperRank(avg: number): { name: string; line: string } {
  if (avg < 230) return { name: "Super Eagles keeper", line: "Nothing passes you." };
  if (avg < 280) return { name: "Club first choice", line: "Sharp. The gloves are yours." };
  if (avg < 350) return { name: "Bench keeper", line: "The coach is watching. Faster." };
  return { name: "Street ball keeper", line: "Wake up, the ball don pass!" };
}
