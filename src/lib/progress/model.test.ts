import { describe, expect, it } from "vitest";
import { badgesOf, EMPTY_STATS, levelOf, xpForLevel, xpOf } from "./model";

describe("couple progress", () => {
  it("starts at level 1 with nothing earned", () => {
    expect(xpOf(EMPTY_STATS)).toBe(0);
    expect(levelOf(0)).toMatchObject({ level: 1, name: "New spark", floor: 0, next: 60, progress: 0 });
    expect(badgesOf(EMPTY_STATS).every((b) => !b.earned)).toBe(true);
  });

  it("weights shared effort over chatter", () => {
    const games = xpOf({ ...EMPTY_STATS, games: 1 });
    const messages = xpOf({ ...EMPTY_STATS, messages: 10 });
    expect(games).toBeGreaterThan(messages * 5);
  });

  it("levels up at the thresholds, and keeps naming past the last title", () => {
    expect(levelOf(59).level).toBe(1);
    expect(levelOf(60)).toMatchObject({ level: 2, name: "Getting cosy" });
    expect(levelOf(xpForLevel(8)).name).toBe("Legends");
    expect(levelOf(xpForLevel(10)).name).toBe("Legends 3");
    expect(levelOf(90).progress).toBeCloseTo(0.25);
  });

  it("earns badges at their targets and caps progress", () => {
    const b = badgesOf({ ...EMPTY_STATS, games: 30, best_streak: 8 });
    const byId = Object.fromEntries(b.map((x) => [x.id, x]));
    expect(byId.first_game!.earned).toBe(true);
    expect(byId.games_25!.earned).toBe(true);
    expect(byId.games_100).toMatchObject({ earned: false, value: 30, target: 100 });
    expect(byId.streak_7!.earned).toBe(true);
    expect(byId.streak_30!.earned).toBe(false);
    expect(byId.first_game!.value).toBe(1);
  });
});
