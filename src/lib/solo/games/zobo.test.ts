import { describe, expect, it } from "vitest";
import { freePlaysFor } from "@/lib/plus/plans";
import { CAP, DRINKS, LEVELS, RANKS, STALLS, addBottle, crateShut, levelOfMode, levelOpen, levelPay, lookPrice, newZoboLevel, outOfPours, pour, pourAmount, rankFor, solve, stallOf, starsFor, starsOfTakings, takings, undo, type Move, type ZoboState } from "./zobo";
import { ZOBO_LEVELS } from "./zobo-levels";
import solutions from "./zobo-levels.solutions.json";

describe("Zobo Sort career", () => {
  it("has five stalls of twenty levels", () => {
    expect(STALLS).toHaveLength(5);
    expect(LEVELS).toBe(100);
    expect(ZOBO_LEVELS).toHaveLength(100);
    expect(stallOf(20)).toBe(0);
    expect(stallOf(21)).toBe(1);
    expect(stallOf(100)).toBe(4);
    expect(levelOfMode("lvl-27")).toBe(27);
    for (const bad of ["lvl-0", "lvl-101", "normal", "d-20261118"]) expect(levelOfMode(bad)).toBeNull();
  });

  it("deals four of every drink in every level", () => {
    for (let level = 1; level <= LEVELS; level++) {
      const counts = new Map<number, number>();
      newZoboLevel(level).bottles.flat().forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
      expect([...counts.values()].every((c) => c === CAP)).toBe(true);
      expect(counts.size).toBeLessThanOrEqual(DRINKS.length);
    }
  });

  it("can finish every level under the real rules, in exactly the target pours", () => {
    (solutions as Move[][]).forEach((path, i) => {
      let s: ZoboState = newZoboLevel(i + 1);
      for (const [from, to] of path) {
        const next = pour(s, from, to);
        expect(next, `level ${i + 1}`).not.toBeNull();
        s = next!;
      }
      expect(s.won, `level ${i + 1}`).toBe(true);
      expect(s.moves).toBe(s.par);
      expect(starsFor(s.par!, s.moves)).toBe(3);
    });
  });

  it("gives each stall its twist", () => {
    expect(newZoboLevel(1).covered).toBeUndefined();
    expect(newZoboLevel(21).covered!.every((c, i) => c === Math.max(0, newZoboLevel(21).bottles[i]!.length - 1))).toBe(true);
    expect(newZoboLevel(41).crates!.length).toBeGreaterThan(0);
    expect(newZoboLevel(61).bottles.filter((b) => !b.length)).toHaveLength(1);
    expect(newZoboLevel(81).limit).toBeGreaterThan(newZoboLevel(81).par!);
    expect(newZoboLevel(100).limit! - newZoboLevel(100).par!).toBeLessThan(newZoboLevel(81).limit! * 2);
  });

  it("uncovers a market drink when what's on top is poured off, and undo covers it again", () => {
    const s: ZoboState = { ...newZoboLevel(21), bottles: [[0, 1, 2], []], covered: [2, 0], undoCovered: [] };
    const t = pour(s, 0, 1)!;
    expect(t.covered).toEqual([1, 0]);
    expect(undo(t)!.covered).toEqual([2, 0]);
  });

  it("keeps a crate shut until its drink is finished", () => {
    const crates = [{ bottle: 0, key: 1 }];
    const bottles = [[2, 3], [1, 1, 1], [1], []];
    expect(crateShut(bottles, crates[0]!)).toBe(true);
    expect(pourAmount(bottles, 0, 3, crates)).toBe(0);
    expect(pourAmount(bottles, 3, 0, crates)).toBe(0);
    const open = [[2, 3], [1, 1, 1, 1], [], []];
    expect(crateShut(open, crates[0]!)).toBe(false);
    expect(pourAmount(open, 0, 3, crates)).toBe(1);
  });

  it("ends an Island Lounge level when the pours run out", () => {
    const s: ZoboState = { ...newZoboLevel(81), bottles: [[0, 1], [], [], []], moves: 4, limit: 5, crates: undefined };
    const t = pour(s, 0, 1)!;
    expect(outOfPours(t)).toBe(true);
    expect(pour(t, 0, 2)).toBeNull();
    expect(undo(t)).toBeNull();
  });

  it("adds one bought bottle, and tops that level out at two stars", () => {
    const s = newZoboLevel(5);
    const t = addBottle(s)!;
    expect(t.bottles).toHaveLength(s.bottles.length + 1);
    expect(addBottle(t)).toBeNull();
    expect(starsFor(10, 10, true)).toBe(2);
  });

  it("finds a hint for a shelf that can be finished, and none for one that can't", () => {
    const s = newZoboLevel(3);
    expect(solve(s.bottles, s.crates, 200, 100)?.length).toBeGreaterThan(0);
    expect(solve([[0, 1, 0, 1], [1, 0, 1, 0]], undefined, 200, 100)).toBeNull();
  });

  it("reads the stars back from the takings, within the score cap", () => {
    for (const level of [1, 27, 100])
      for (const stars of [1, 2, 3]) {
        expect(Number.isInteger(takings(level, stars))).toBe(true);
        expect(starsOfTakings(level, takings(level, stars))).toBe(stars);
      }
    expect(takings(100, 3)).toBe(levelPay(100) * 2);
    expect(takings(100, 3)).toBeLessThanOrEqual(5000);
  });

  it("opens levels in order and climbs the ranks", () => {
    expect(levelOpen(1, () => false)).toBe(true);
    expect(levelOpen(2, () => false)).toBe(false);
    expect(levelOpen(2, () => true)).toBe(true);
    expect(rankFor(0).name).toBe("Stall Helper");
    expect(rankFor(61)).toMatchObject({ name: "Market Favourite", next: { name: "Owambe Supplier" } });
    expect(rankFor(300).next).toBeNull();
    expect(RANKS[RANKS.length - 1]!.stars).toBeLessThanOrEqual(LEVELS * 3);
  });

  it("gives free players one level a day, sells only real looks, and gives the plain ones away", () => {
    expect(freePlaysFor("zobo-sort")).toBe(1);
    expect(freePlaysFor("ajo")).toBe(2);
    expect(lookPrice("bottle-gold")).toBe(25000);
    expect(lookPrice("bottle-glass")).toBeNull();
    expect(lookPrice("nonsense")).toBeNull();
  });
});
