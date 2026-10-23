/** Birthdays are day and month only. Shared by the room home, Settings and the daily reminder. */

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type YMD = { y: number; m: number; d: number };

/** Days in a month, allowing 29 February. */
export const daysIn = (month: number) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The calendar date right now in a time zone (the reminder uses Lagos; screens use the phone's own). */
export function todayIn(now: Date, timeZone?: string): YMD {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** This year's (or next year's) birthday date. 29 February falls on the 28th in other years. */
function next(month: number, day: number, today: YMD): Date {
  const at = (y: number) => new Date(Date.UTC(y, month - 1, month === 2 && day === 29 && !isLeap(y) ? 28 : day));
  const t = Date.UTC(today.y, today.m - 1, today.d);
  const thisYear = at(today.y);
  return thisYear.getTime() >= t ? thisYear : at(today.y + 1);
}

/** Whole days from `today` to the next birthday: 0 means today. */
export function daysUntil(month: number, day: number, today: YMD): number {
  return Math.round((next(month, day, today).getTime() - Date.UTC(today.y, today.m - 1, today.d)) / 86_400_000);
}

export const formatBirthday = (month: number, day: number) => `${day} ${MONTHS[month - 1]}`;

/** "today", "tomorrow", "on Friday" (this week), or "on 14 March". */
export function whenLabel(month: number, day: number, today: YMD): string {
  const n = daysUntil(month, day, today);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n < 7) return `on ${WEEKDAYS[next(month, day, today).getUTCDay()]}`;
  return `on ${formatBirthday(month, day)}`;
}
