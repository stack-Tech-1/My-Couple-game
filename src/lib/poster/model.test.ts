import { describe, expect, it } from "vitest";
import { EMPTY_STATS } from "@/lib/progress/model";
import { personalStats } from "@/lib/stats/personal";
import { buildPoster, scoreLine } from "./model";

const ada = { name: "Ada", motif: "fig", hue: 12 };
const bo = { name: "Bo", motif: "moon", hue: 200 };
const personal = personalStats("a", [{ game_id: "whot", players: ["a", "b"], status: "finished", outcome: "win", winner: "a", finished_at: "2026-10-01T00:00:00Z" }]);

describe("share poster", () => {
  it("shows the couple's level, streaks and score", () => {
    const p = buildPoster({ me: ada, partner: bo, progress: { ...EMPTY_STATS, games: 12, streak: 3, best_streak: 5 }, score: [4, 2], personal });
    expect(p.level?.level).toBeGreaterThanOrEqual(1);
    expect(p.level!.progress).toBeGreaterThanOrEqual(0);
    expect(p.level!.progress).toBeLessThanOrEqual(1);
    expect([p.streak, p.bestStreakDays, p.together]).toEqual([3, 5, 12]);
    expect(p.topGame).toBe("Whot");
    expect(scoreLine(p)).toBe("Ada is ahead. Bo wants a rematch.");
  });

  it("is a personal poster without a partner, and says level scores kindly", () => {
    const solo = buildPoster({ me: ada, partner: null, progress: null, score: [9, 0], personal });
    expect(solo.level).toBeNull();
    expect(solo.score).toBeNull();
    expect(scoreLine(solo)).toBeNull();
    expect(scoreLine(buildPoster({ me: ada, partner: bo, progress: null, score: [2, 2], personal }))).toBe("Dead level. Rematch tonight?");
    expect(scoreLine(buildPoster({ me: ada, partner: bo, progress: null, score: [0, 0], personal }))).toBe("No winner yet. Watch this space.");
  });
});
