import { describe, expect, it } from "vitest";
import { ayo as g, legalPits, sow, TOTAL, type AyoState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const rules = { grandSlam: false };
const rig = (over: Partial<AyoState>): AyoState => ({ ...g.initialState("s", P, { firstPlayer: 0 }, ctx), ...over });
const mv = (s: AyoState, by: string, pit: number) => runMove(g, s, { pit }, by, ctx).next as AyoState;
const seeds = (s: AyoState) => s.pits.reduce((a, b) => a + b, 0) + s.stores.ada! + s.stores.bo!;

describe("ayo sowing", () => {
  it("sows one seed per pit counter-clockwise", () => {
    const r = sow([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 2, rules);
    expect(r.pits).toEqual([4, 4, 0, 5, 5, 5, 5, 4, 4, 4, 4, 4]);
    expect(r.sown).toEqual([3, 4, 5, 6]);
  });

  it("skips the origin pit on a full lap", () => {
    const pits = Array(12).fill(0);
    pits[0] = 12;
    const r = sow(pits, 0, rules);
    expect(r.pits[0]).toBe(0);
    expect(r.pits[1]).toBe(2); // 11 pits get one, then the 12th seed skips pit 0 and lands in pit 1
    expect(r.sown).toHaveLength(12);
  });
});

describe("ayo captures", () => {
  it("captures 2s and 3s on the opponent's side, chaining backwards", () => {
    // Ada sows from pit 4 (3 seeds) → 5, 6, 7. Pits 6 and 7 had 1 and 2 → become 2 and 3.
    const pits = [0, 0, 0, 0, 3, 0, 1, 2, 5, 5, 5, 5];
    const r = sow(pits, 4, rules);
    expect(r.captured).toEqual([7, 6]);
    expect(r.seedsCaptured).toBe(5);
    expect(r.pits[6]).toBe(0);
    expect(r.pits[7]).toBe(0);
  });

  it("stops the chain at the first pit that isn't 2 or 3, and never captures on your own side", () => {
    const r = sow([0, 0, 0, 0, 2, 4, 2, 5, 5, 5, 5, 5], 4, rules); // → 5 (own side), 6
    expect(r.captured).toEqual([6]);
    expect(r.seedsCaptured).toBe(3);
  });

  it("a grand slam captures nothing unless the house rule allows it", () => {
    const pits = [0, 0, 0, 0, 0, 2, 1, 1, 0, 0, 0, 0];
    expect(sow(pits, 5, rules).seedsCaptured).toBe(0);
    expect(sow(pits, 5, { grandSlam: true }).seedsCaptured).toBe(4);
  });
});

describe("ayo rules", () => {
  it("only lets you move from your own non-empty pits on your turn", () => {
    const s = rig({});
    expect(() => mv(s, "bo", 0)).toThrow(MoveRejected);
    const empty = rig({ pits: [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] });
    expect(() => mv(empty, "ada", 0)).toThrow(MoveRejected);
  });

  it("seat 1's pits are counted from their own left", () => {
    const s = rig({ turn: 1 });
    const n = mv(s, "bo", 0); // absolute pit 6
    expect(n.pits[6]).toBe(0);
    expect(n.pits[10]).toBe(5);
  });

  it("forces a feeding move when the opponent's side is empty", () => {
    const s = rig({ pits: [0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0] });
    expect(legalPits(s)).toEqual([5]); // pit 4 (one seed) doesn't reach their side
  });

  it("conserves all 48 seeds across a long random game", () => {
    let s = rig({});
    for (let i = 0; i < 300 && !s.winner; i++) {
      const legal = legalPits(s);
      s = mv(s, s.players[s.turn], legal[(i * 7) % legal.length]!);
      expect(seeds(s)).toBe(TOTAL);
    }
    expect(s.winner).not.toBeNull();
  });

  it("wins at 25 seeds", () => {
    const s = rig({ stores: { ada: 23, bo: 10 }, pits: [0, 0, 0, 0, 3, 0, 1, 2, 3, 3, 3, 0] });
    const n = mv(s, "ada", 4);
    expect(g.isOver(n)).toEqual({ over: true, winner: "ada" });
  });

  it("splits the board when the next player can't be fed", () => {
    // After Ada's move Bo has seeds; give Ada a position where Bo then has nothing and can't be fed.
    const s = rig({ turn: 1, stores: { ada: 20, bo: 20 }, pits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] });
    const n = mv(s, "bo", 5); // Bo's last pit (11) sows into Ada's pit 0
    // Ada must move pit 0 → 1, which can't reach Bo's side: nobody can feed, board splits.
    expect(n.ended).toBe("starved");
    expect(n.stores.ada! + n.stores.bo!).toBe(41);
  });
});
