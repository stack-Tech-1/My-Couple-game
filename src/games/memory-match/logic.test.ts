import { describe, expect, it } from "vitest";
import { memoryMatch as g, type MemoryState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const mv = (s: MemoryState, m: object, now = 1000, by?: string) => runMove(g, s, m, by ?? s.players[s.turn], { now }).next as MemoryState;
const start = () => g.initialState("seed", P, {}, { now: 0 });
const pairOf = (s: MemoryState, i: number) => s.cards.findIndex((c, j) => j !== i && c === s.cards[i]);
const notPairOf = (s: MemoryState, i: number) => s.cards.findIndex((c, j) => j !== i && c !== s.cards[i]);

describe("memory match", () => {
  it("deals eight pairs and hides every face", () => {
    const s = start();
    expect(s.cards).toHaveLength(16);
    expect(g.viewFor(s, "ada").cards.every((c) => c === null)).toBe(true);
  });

  it("only the current player flips, and not the same card twice", () => {
    const s = start();
    const other = s.players[s.turn === 0 ? 1 : 0];
    expect(() => mv(s, { type: "flip", index: 0 }, 1000, other)).toThrow(MoveRejected);
    const one = mv(s, { type: "flip", index: 0 });
    expect(() => mv(one, { type: "flip", index: 0 })).toThrow(MoveRejected);
  });

  it("a match stays up; turns alternate either way", () => {
    let s = start();
    const first = s.turn;
    s = mv(s, { type: "flip", index: 0 });
    s = mv(s, { type: "flip", index: pairOf(s, 0) });
    expect(s.matched.filter(Boolean)).toHaveLength(2);
    expect(s.turn).not.toBe(first);
  });

  it("a miss stays visible until the next flip, which hides it", () => {
    let s = start();
    s = mv(s, { type: "flip", index: 0 });
    const miss = notPairOf(s, 0);
    s = mv(s, { type: "flip", index: miss });
    expect(g.viewFor(s, "ada").cards.filter(Boolean)).toHaveLength(2);
    s = mv(s, { type: "flip", index: pairOf(s, 0) });
    expect(s.up).toEqual([pairOf(s, 0)]);
    expect(s.misses).toBe(1);
  });

  it("clears the board together", () => {
    let s = start();
    const done = new Set<number>();
    for (let i = 0; i < 16; i++) {
      if (done.has(i)) continue;
      const j = pairOf(s, i);
      s = mv(s, { type: "flip", index: i });
      s = mv(s, { type: "flip", index: j });
      done.add(i).add(j);
    }
    expect(g.isOver(s)).toEqual({ over: true, coop: "win" });
  });

  it("runs out of time together", () => {
    let s = mv(start(), { type: "flip", index: 0 }, 0);
    expect(() => mv(s, { type: "tick" }, 50_000)).toThrow(MoveRejected);
    s = mv(s, { type: "tick" }, s.deadline! + 1, "ada");
    expect(g.isOver(s)).toEqual({ over: true, coop: "loss" });
  });
});
