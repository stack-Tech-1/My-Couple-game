import { describe, expect, it } from "vitest";
import { forgivingStreak } from "./streak";

// 2026-11-14 is a Saturday; that week runs Monday 9 to Sunday 15.
const TODAY = "2026-11-14";

describe("forgiving streaks", () => {
  it("counts days together, and today never breaks it", () => {
    expect(forgivingStreak(["2026-11-12", "2026-11-13"], TODAY).streak).toBe(2);
    expect(forgivingStreak(["2026-11-12", "2026-11-13", TODAY], TODAY).streak).toBe(3);
  });

  it("one missed day a week is a rest day; a second in the same week ends it", () => {
    // Missed Wednesday 11th: rest. Streak 4 (9, 10, 12, 13).
    const one = forgivingStreak(["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13"], TODAY);
    expect(one.streak).toBe(4);
    expect(one.restUsed).toBe(true);
    expect(one.week.map((d) => d.status)).toEqual(["together", "together", "rest", "together", "together", "today", "later"]);
    // Missed the 10th and the 12th: the second miss ends it, so only the 13th counts.
    expect(forgivingStreak(["2026-11-09", "2026-11-11", "2026-11-13"], TODAY).streak).toBe(1);
  });

  it("each week has its own rest day, and a rest only helps a streak that's going", () => {
    // Missed Sunday 8th (last week) and Wednesday 11th (this week): still going.
    const s = forgivingStreak(["2026-11-06", "2026-11-07", "2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13"], TODAY);
    expect(s.streak).toBe(6);
    expect(s.best).toBe(6);
    // Nothing before: a gap is just a gap.
    expect(forgivingStreak([], TODAY).streak).toBe(0);
    expect(forgivingStreak(["2026-11-01"], TODAY).streak).toBe(0);
  });
});
