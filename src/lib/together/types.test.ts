import { describe, expect, it } from "vitest";
import { daysTogether, daysUntil, isAnniversary } from "./types";

const at = (iso: string) => new Date(`${iso}T15:00:00Z`);

describe("together dates", () => {
  it("counts days until a date, today being 0", () => {
    expect(daysUntil("2026-10-21", at("2026-10-21"))).toBe(0);
    expect(daysUntil("2026-10-24", at("2026-10-21"))).toBe(3);
    expect(daysUntil("2026-10-20", at("2026-10-21"))).toBe(-1);
  });

  it("counts the first day together as day 1", () => {
    expect(daysTogether("2026-10-21", at("2026-10-21"))).toBe(1);
    expect(daysTogether("2025-10-21", at("2026-10-21"))).toBe(366);
  });

  it("spots anniversaries, including Feb 29 in non-leap years", () => {
    expect(isAnniversary("2024-10-21", at("2026-10-21"))).toBe(2);
    expect(isAnniversary("2026-10-21", at("2026-10-21"))).toBeNull();
    expect(isAnniversary("2024-10-20", at("2026-10-21"))).toBeNull();
    expect(isAnniversary("2024-02-29", at("2025-02-28"))).toBe(1);
    expect(isAnniversary("2024-02-29", at("2028-02-29"))).toBe(4);
    expect(isAnniversary("2024-02-29", at("2028-02-28"))).toBeNull();
  });
});
