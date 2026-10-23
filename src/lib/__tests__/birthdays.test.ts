import { describe, expect, it } from "vitest";
import { daysIn, daysUntil, todayIn, whenLabel } from "../birthdays";

describe("birthdays", () => {
  const oct23 = { y: 2026, m: 10, d: 23 }; // a Friday

  it("counts the days to the next one, wrapping into next year", () => {
    expect(daysUntil(10, 23, oct23)).toBe(0);
    expect(daysUntil(10, 26, oct23)).toBe(3);
    expect(daysUntil(10, 22, oct23)).toBe(364);
    expect(daysUntil(1, 1, oct23)).toBe(70);
  });

  it("celebrates 29 February on the 28th outside leap years", () => {
    expect(daysUntil(2, 29, { y: 2027, m: 2, d: 28 })).toBe(0);
    expect(daysUntil(2, 29, { y: 2028, m: 2, d: 28 })).toBe(1);
    expect(daysIn(2)).toBe(29);
  });

  it("says when, the way people do", () => {
    expect(whenLabel(10, 23, oct23)).toBe("today");
    expect(whenLabel(10, 24, oct23)).toBe("tomorrow");
    expect(whenLabel(10, 26, oct23)).toBe("on Monday");
    expect(whenLabel(12, 14, oct23)).toBe("on 14 December");
  });

  it("reads today's date in a given time zone", () => {
    // 23:30 UTC on the 22nd is already the 23rd in Lagos (UTC+1).
    expect(todayIn(new Date("2026-10-22T23:30:00Z"), "Africa/Lagos")).toEqual(oct23);
  });
});
