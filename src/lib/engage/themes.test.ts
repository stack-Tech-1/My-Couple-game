import { describe, expect, it } from "vitest";
import { easter, themeOn, themesFor } from "./themes";

describe("themed weeks", () => {
  it("works out Easter", () => {
    expect(easter(2025)).toBe("2025-04-20");
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
  });

  it("finds the week running on a day, and nothing in between", () => {
    expect(themeOn("2026-12-20")?.id).toBe("detty");
    expect(themeOn("2026-02-14")?.id).toBe("val");
    expect(themeOn("2026-10-01")?.id).toBe("independence");
    expect(themeOn("2026-04-04")?.id).toBe("easter");
    expect(themeOn("2026-11-14")).toBeNull();
  });

  it("no two themes overlap in a year", () => {
    for (const y of [2026, 2027, 2028]) {
      const t = themesFor(y).sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < t.length; i++) expect(t[i]!.start > t[i - 1]!.end, `${t[i - 1]!.id} and ${t[i]!.id} in ${y}`).toBe(true);
    }
  });
});
