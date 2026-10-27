/** Quiet hours: whole hours, in the person's own time zone, and they can wrap past midnight. */

export const DEFAULT_QUIET = { start: 23, end: 7 };

/** The hour (0..23) right now in a time zone; falls back to Lagos if the zone is unknown. */
export function hourIn(now: Date, timeZone: string | null | undefined): number {
  const read = (tz: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
  try {
    return read(timeZone || "Africa/Lagos");
  } catch {
    return read("Africa/Lagos");
  }
}

/** True when `now` falls in [start, end). start === end means off. 23→7 covers the night. */
export function inQuietHours(start: number | null | undefined, end: number | null | undefined, timeZone: string | null | undefined, now: Date): boolean {
  if (start == null || end == null || start === end) return false;
  const h = hourIn(now, timeZone);
  return start < end ? h >= start && h < end : h >= start || h < end;
}

/** "11 pm", "7 am", "12 noon", "12 midnight". */
export function hourLabel(h: number): string {
  if (h === 0) return "12 midnight";
  if (h === 12) return "12 noon";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
