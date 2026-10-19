import { describe, expect, it } from "vitest";
import { buildDeck, canPlay, handValue, whot as g, type Card, type WhotState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const c = (id: number, shape: Card["shape"], n: number): Card => ({ id, shape, n });

/** A hand-built state so each rule can be tested in isolation. */
function rig(over: Partial<WhotState> & { ada?: Card[]; bo?: Card[] }): WhotState {
  const base = g.initialState("seed", P, { firstPlayer: 0 }, ctx);
  const { ada, bo, ...rest } = over;
  return {
    ...base,
    hands: { ada: ada ?? [c(40, "circle", 3), c(41, "square", 7)], bo: bo ?? [c(42, "cross", 11), c(43, "star", 4)] },
    market: [c(30, "triangle", 10), c(31, "circle", 11), c(32, "square", 13), c(33, "cross", 3), c(34, "star", 7)],
    pile: [c(20, "circle", 4)],
    turn: 0,
    ...rest,
  };
}
const play = (s: WhotState, by: string, move: object) => runMove(g, s, move, by, ctx).next as WhotState;

describe("whot deck", () => {
  it("has the standard 54 cards", () => {
    const d = buildDeck();
    expect(d).toHaveLength(54);
    expect(d.filter((x) => x.shape === "whot")).toHaveLength(5);
    expect(d.filter((x) => x.shape === "star")).toHaveLength(7);
    expect(d.filter((x) => x.shape === "cross")).toHaveLength(9);
    expect(new Set(d.map((x) => x.id)).size).toBe(54);
  });

  it("deals the configured hand size and opens on a plain number", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const s = g.initialState(seed, P, { handSize: 6 }, ctx);
      expect(s.hands.ada).toHaveLength(6);
      expect(s.hands.bo).toHaveLength(6);
      expect([1, 2, 5, 8, 14, 20]).not.toContain(s.pile[0]!.n);
      expect(s.market.length + 12 + 1).toBe(54);
    }
  });
});

describe("whot matching", () => {
  it("matches by shape or number, and Whot goes on anything", () => {
    const s = rig({});
    expect(canPlay(s, c(1, "circle", 9))).toBe(true);
    expect(canPlay(s, c(2, "star", 4))).toBe(true);
    expect(canPlay(s, c(3, "square", 7))).toBe(false);
    expect(canPlay(s, c(4, "whot", 20))).toBe(true);
  });

  it("rejects off-turn, unmatched and unknown cards", () => {
    const s = rig({});
    expect(() => play(s, "bo", { type: "draw" })).toThrow(MoveRejected);
    expect(() => play(s, "ada", { type: "play", cardId: 41 })).toThrow(MoveRejected);
    expect(() => play(s, "ada", { type: "play", cardId: 50 })).toThrow(MoveRejected);
  });

  it("requires a called shape for Whot and enforces it on the next player", () => {
    const s = rig({ ada: [c(40, "whot", 20), c(41, "square", 7)], bo: [c(42, "circle", 4), c(43, "star", 5)] });
    expect(() => play(s, "ada", { type: "play", cardId: 40 })).toThrow(MoveRejected);
    const n = play(s, "ada", { type: "play", cardId: 40, shape: "star" });
    expect(n.requested).toBe("star");
    expect(() => play(n, "bo", { type: "play", cardId: 42 })).toThrow(MoveRejected); // circle 4 matches number but not the call
    const m = play(n, "bo", { type: "play", cardId: 43 });
    expect(m.requested).toBeNull();
  });
});

describe("whot specials", () => {
  it("Hold On and Suspension let you play again", () => {
    for (const n of [1, 8]) {
      const s = rig({ ada: [c(40, "circle", n), c(41, "circle", 9)] });
      expect(play(s, "ada", { type: "play", cardId: 40 }).turn).toBe(0);
    }
  });

  it("Pick Two and Pick Three make the next player draw", () => {
    const s2 = play(rig({ ada: [c(40, "circle", 2), c(41, "circle", 9)] }), "ada", { type: "play", cardId: 40 });
    expect(s2.pendingPick).toBe(2);
    const after = play(s2, "bo", { type: "draw" });
    expect(after.hands.bo).toHaveLength(4);
    expect(after.pendingPick).toBe(0);
    expect(after.turn).toBe(0);

    const s5 = play(rig({ ada: [c(40, "circle", 5), c(41, "circle", 9)] }), "ada", { type: "play", cardId: 40 });
    expect(play(s5, "bo", { type: "draw" }).hands.bo).toHaveLength(5);
  });

  it("can't dodge a pick without the stacking house rule", () => {
    const s = play(rig({ ada: [c(40, "circle", 2), c(41, "circle", 9)], bo: [c(42, "square", 2), c(43, "star", 4)] }), "ada", { type: "play", cardId: 40 });
    expect(() => play(s, "bo", { type: "play", cardId: 42 })).toThrow(MoveRejected);
  });

  it("stacks picks when the house rule is on", () => {
    const rules = { stackPicks: true, generalMarketHold: true, announceLastCard: false, handSize: 5 };
    const s = play(rig({ rules, ada: [c(40, "circle", 2), c(41, "circle", 9)], bo: [c(42, "square", 2), c(43, "star", 4)] }), "ada", { type: "play", cardId: 40 });
    const stacked = play(s, "bo", { type: "play", cardId: 42 });
    expect(stacked.pendingPick).toBe(4);
    expect(play(stacked, "ada", { type: "draw" }).hands.ada).toHaveLength(5);
  });

  it("General Market makes the partner draw one; the player goes again by default", () => {
    const s = play(rig({ ada: [c(40, "circle", 14), c(41, "circle", 9)] }), "ada", { type: "play", cardId: 40 });
    expect(s.hands.bo).toHaveLength(3);
    expect(s.turn).toBe(0);
    const noHold = play(rig({ rules: { stackPicks: false, generalMarketHold: false, announceLastCard: false, handSize: 5 }, ada: [c(40, "circle", 14), c(41, "circle", 9)] }), "ada", { type: "play", cardId: 40 });
    expect(noHold.turn).toBe(1);
  });
});

describe("whot endings", () => {
  it("wins on an empty hand, even on a pick card", () => {
    const s = play(rig({ ada: [c(40, "circle", 2)] }), "ada", { type: "play", cardId: 40 });
    expect(g.isOver(s)).toEqual({ over: true, winner: "ada" });
  });

  it("penalises a missed 'last card' call when the house rule is on", () => {
    const rules = { stackPicks: false, generalMarketHold: true, announceLastCard: true, handSize: 5 };
    const forgot = play(rig({ rules }), "ada", { type: "play", cardId: 40 });
    expect(forgot.hands.ada).toHaveLength(3);
    const called = play(rig({ rules }), "ada", { type: "play", cardId: 40, lastCard: true });
    expect(called.hands.ada).toHaveLength(1);
  });

  it("reshuffles the pile when the market empties", () => {
    const s = rig({ market: [], pile: [c(20, "circle", 9), c(21, "cross", 9), c(22, "circle", 4)] });
    const n = play(s, "ada", { type: "draw" });
    expect(n.hands.ada).toHaveLength(3);
    expect(n.pile).toHaveLength(1);
    expect(n.market).toHaveLength(1);
    expect(n.log.some((l) => l.kind === "reshuffle")).toBe(true);
  });

  it("ends on a hand count when the market runs completely dry", () => {
    const s = rig({ market: [], pile: [c(22, "circle", 4)], ada: [c(40, "star", 7), c(41, "square", 7)], bo: [c(42, "cross", 11), c(43, "cross", 1)] });
    const n = play(s, "ada", { type: "draw" });
    expect(handValue(n.hands.ada!)).toBe(21);
    expect(g.isOver(n)).toEqual({ over: true, winner: "bo" });
  });
});

describe("whot privacy", () => {
  it("never shows the opponent's cards or the market order", () => {
    const s = rig({});
    const v = g.viewFor(s, "ada");
    expect(v.hand.map((x) => x.id)).toEqual([40, 41]);
    expect(JSON.stringify(v)).not.toContain('"id":42');
    expect(v.opponentCount).toBe(2);
    expect(v).not.toHaveProperty("market");
    expect(v.finalHands).toBeNull();
  });
});
