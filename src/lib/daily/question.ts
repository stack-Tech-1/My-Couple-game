import { DAILY_QUESTIONS } from "@/content/personal";

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** The same question for both partners on a given day, different rooms get different orders. */
export function questionFor(roomId: string, day: string): string {
  let h = 2166136261;
  for (const ch of `${roomId}:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return DAILY_QUESTIONS[(h >>> 0) % DAILY_QUESTIONS.length]!;
}