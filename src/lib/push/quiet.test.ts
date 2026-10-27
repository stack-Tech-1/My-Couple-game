import { describe, expect, it } from "vitest";
import { hourIn, hourLabel, inQuietHours, isTimeZone } from "./quiet";

// 22:30 UTC = 23:30 in Lagos (UTC+1) = 22:30 in London (GMT in late October).
const lateNight = new Date("2026-10-26T22:30:00Z");
const morning = new Date("2026-10-26T06:30:00Z"); // 07:30 Lagos

describe("quiet hours", () => {
  it("reads the hour in the person's own zone", () => {
    expect(hourIn(lateNight, "Africa/Lagos")).toBe(23);
    expect(hourIn(lateNight, "Europe/London")).toBe(22);
    expect(hourIn(lateNight, "Not/AZone")).toBe(23); // falls back to Lagos
  });

  it("wraps past midnight", () => {
    expect(inQuietHours(23, 7, "Africa/Lagos", lateNight)).toBe(true);
    expect(inQuietHours(23, 7, "Africa/Lagos", morning)).toBe(false);
    expect(inQuietHours(23, 7, "Europe/London", lateNight)).toBe(false);
  });

  it("works inside one day too, and is off when unset or empty", () => {
    expect(inQuietHours(7, 9, "Africa/Lagos", morning)).toBe(true);
    expect(inQuietHours(null, 7, "Africa/Lagos", lateNight)).toBe(false);
    expect(inQuietHours(5, 5, "Africa/Lagos", lateNight)).toBe(false);
  });

  it("says hours the way people do", () => {
    expect([0, 7, 12, 23].map(hourLabel)).toEqual(["12 midnight", "7 am", "12 noon", "11 pm"]);
    expect(isTimeZone("Africa/Lagos")).toBe(true);
    expect(isTimeZone("Mars/Base")).toBe(false);
  });
});
