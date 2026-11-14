import type { WeekDay } from "./model";

/**
 * The forgiving streak, the same rules as room_streaks() in 0030_engagement.sql, for tests and
 * anywhere the days are already at hand. Days are "YYYY-MM-DD"; weeks run Monday to Sunday.
 *  - A day you both did something counts.
 *  - Today doesn't break anything: it isn't over yet.
 *  - One missed day a week is a rest day while a streak is going; a second one ends it.
 */
const num = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 864e5);
const str = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);
const mondayOf = (n: number) => n - ((n + 3) % 7);

export function forgivingStreak(shared: string[], today: string): { streak: number; best: number; restUsed: boolean; week: WeekDay[] } {
  const days = new Set(shared.map(num));
  const t = num(today);
  const sorted = [...days].sort((a, b) => a - b);
  const first = sorted.length ? Math.min(sorted[0]!, t) : t;
  const monday = mondayOf(t);
  const rested = new Set<number>();
  let len = 0;
  let best = 0;
  const status = new Map<number, WeekDay["status"]>();
  for (let d = first; d <= t; d++) {
    let s: WeekDay["status"];
    if (days.has(d)) {
      len++;
      s = "together";
    } else if (d === t) s = "today";
    else if (len > 0 && !rested.has(mondayOf(d))) {
      rested.add(mondayOf(d));
      s = "rest";
    } else {
      len = 0;
      s = "missed";
    }
    best = Math.max(best, len);
    status.set(d, s);
  }
  const week: WeekDay[] = [];
  for (let d = monday; d < monday + 7; d++) week.push({ day: str(d), status: d > t ? "later" : (status.get(d) ?? (d === t ? "today" : "missed")) });
  return { streak: len, best, restUsed: rested.has(monday), week };
}
