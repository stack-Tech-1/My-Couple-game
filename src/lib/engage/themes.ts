/**
 * Themed weeks on the Nigerian calendar. Worked out from the date (Lagos), nothing stored: a
 * banner on the Today card, a line in the ticker, and a little goal for the week (play a few games
 * together) with a keepsake name to go with it.
 */
export type Theme = {
  id: string;
  name: string;
  /** One line under the name. */
  blurb: string;
  /** Games together this week for the keepsake. */
  goal: number;
  keepsake: string;
  colors: { bg: string; ink: string; accent: string };
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easter(y: number): string {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

export function themesFor(y: number): Theme[] {
  const e = easter(y);
  return [
    { id: "new-year", name: "New Year, New Us", blurb: "Fresh start. Set one thing to do together this year.", goal: 5, keepsake: `New Year ${y}`, colors: { bg: "#1f2a5c", ink: "#f6d26a", accent: "#f6d26a" }, start: ymd(y, 1, 1), end: ymd(y, 1, 7) },
    { id: "val", name: "Val Week", blurb: "Love notes, sweet questions and a little extra wahala.", goal: 7, keepsake: `Val ${y}`, colors: { bg: "#8f1d40", ink: "#ffd7e2", accent: "#ff8fb1" }, start: ymd(y, 2, 8), end: ymd(y, 2, 14) },
    { id: "easter", name: "Easter Break", blurb: "Long weekend. Long games. Rice and chicken energy.", goal: 5, keepsake: `Easter ${y}`, colors: { bg: "#3f6b3a", ink: "#fff3c4", accent: "#f6d26a" }, start: shift(e, -3), end: shift(e, 1) },
    { id: "workers", name: "Workers' Day Rest", blurb: "You worked hard. Now play hard.", goal: 3, keepsake: `Workers' Day ${y}`, colors: { bg: "#7a3b12", ink: "#ffe1c2", accent: "#ffb067" }, start: ymd(y, 4, 29), end: ymd(y, 5, 1) },
    { id: "children", name: "Children's Day", blurb: "Play like you're 10 again. Ludo, Ayo, X and O.", goal: 4, keepsake: `Children's Day ${y}`, colors: { bg: "#1f6b7a", ink: "#e6fbff", accent: "#ffd166" }, start: ymd(y, 5, 24), end: ymd(y, 5, 27) },
    { id: "june12", name: "June 12", blurb: "Democracy Day. Every vote counts, even in Most Likely To.", goal: 3, keepsake: `June 12, ${y}`, colors: { bg: "#0a6b3c", ink: "#f2fff6", accent: "#ffffff" }, start: ymd(y, 6, 10), end: ymd(y, 6, 12) },
    { id: "independence", name: "Independence Week", blurb: "Green, white, green. How Naija are you? Naija Trivia is waiting.", goal: 5, keepsake: `Independence ${y}`, colors: { bg: "#0a6b3c", ink: "#f2fff6", accent: "#ffffff" }, start: ymd(y, 9, 25), end: ymd(y, 10, 1) },
    { id: "detty", name: "Detty December", blurb: "Owambe season. Show up every day, and play like it's the last week of the year.", goal: 10, keepsake: `Detty December ${y}`, colors: { bg: "#3a1250", ink: "#ffe9a8", accent: "#f9e08a" }, start: ymd(y, 12, 15), end: ymd(y, 12, 31) },
  ];
}

/** The themed week running on this day (Lagos), if any. */
export function themeOn(day: string): Theme | null {
  const y = Number(day.slice(0, 4));
  return themesFor(y).find((t) => day >= t.start && day <= t.end) ?? null;
}
