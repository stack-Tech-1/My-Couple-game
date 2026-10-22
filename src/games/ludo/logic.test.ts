import { describe, expect, it } from "vitest";
import { absolute, absoluteFor, colourOf, HOME, ludo as g, legalOptions, legalTokens, YARD, type LudoState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const rig = (over: Partial<LudoState>): LudoState => ({ ...g.initialState("s", P, { firstPlayer: 0 }, ctx), ...over });
const mv = (s: LudoState, by: string, m: object) => runMove(g, s, m, by, ctx).next as LudoState;

describe("ludo", () => {
  it("seats start on opposite sides of the track", () => {
    expect(absolute(0, 0)).toBe(0);
    expect(absolute(1, 0)).toBe(26);
    expect(absolute(1, 30)).toBe(4);
  });

  it("rolls deterministically and only on your turn", () => {
    const s = rig({});
    expect(() => mv(s, "bo", { type: "roll" })).toThrow(MoveRejected);
    const a = mv(s, "ada", { type: "roll" });
    const b = mv(s, "ada", { type: "roll" });
    expect(a.dice).toBe(b.dice);
    expect(a.dice).toBeGreaterThanOrEqual(1);
    expect(a.dice).toBeLessThanOrEqual(6);
  });

  it("needs a six to leave the yard (or a one with the house rule)", () => {
    expect(legalTokens(rig({ phase: "move", dice: 5 }))).toEqual([]);
    expect(legalTokens(rig({ phase: "move", dice: 6 }))).toEqual([0, 1, 2, 3]);
    const rules = { exitOnOne: true, exactHome: true, bonusRolls: true, threeSixes: true };
    expect(legalTokens(rig({ rules, phase: "move", dice: 1 }))).toEqual([0, 1, 2, 3]);
  });

  it("passes the turn automatically when nothing can move", () => {
    // find a seed whose first roll isn't a six: with all tokens in the yard nothing moves
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const s = mv(rig({ seed }), "ada", { type: "roll" });
      if (s.dice !== 6) {
        expect(s.turn).toBe(1);
        expect(s.phase).toBe("roll");
        expect(s.last).toMatchObject({ kind: "roll", noMoves: true });
        return;
      }
    }
    throw new Error("no non-six seed found");
  });

  it("brings a token out on a six and grants another roll", () => {
    const s = mv(rig({ phase: "move", dice: 6 }), "ada", { type: "move", token: 0 });
    expect(s.tokens.ada![0]).toBe(0);
    expect(s.turn).toBe(0);
  });

  it("captures on a normal square and sends the token home, with a bonus roll", () => {
    // Bo's token at rel 4 sits on absolute 30. Ada moves from rel 27 (abs 27) by 3 → abs 30.
    const s = rig({ phase: "move", dice: 3, tokens: { ada: [27, YARD, YARD, YARD], bo: [4, YARD, YARD, YARD] } });
    const n = mv(s, "ada", { type: "move", token: 0 });
    expect(n.tokens.bo![0]).toBe(YARD);
    expect(n.last).toMatchObject({ kind: "move", captured: [{ owner: "bo", token: 0 }] });
    expect(n.turn).toBe(0);
  });

  it("never captures on a safe square", () => {
    // Bo at rel 8 → abs 34 (a star). Ada from rel 31 (abs 31) by 3 → abs 34.
    const s = rig({ phase: "move", dice: 3, tokens: { ada: [31, YARD, YARD, YARD], bo: [8, YARD, YARD, YARD] } });
    const n = mv(s, "ada", { type: "move", token: 0 });
    expect(n.tokens.bo![0]).toBe(8);
    expect(n.turn).toBe(1);
  });

  it("doesn't capture from inside the home column", () => {
    const s = rig({ phase: "move", dice: 2, tokens: { ada: [50, YARD, YARD, YARD], bo: [26, YARD, YARD, YARD] } });
    const n = mv(s, "ada", { type: "move", token: 0 });
    expect(n.tokens.ada![0]).toBe(52);
    expect(n.tokens.bo![0]).toBe(26);
  });

  it("requires an exact roll home unless the house rule is off", () => {
    expect(legalTokens(rig({ phase: "move", dice: 5, tokens: { ada: [53, YARD, YARD, YARD], bo: [YARD, YARD, YARD, YARD] } }))).toEqual([]);
    const loose = { exitOnOne: false, exactHome: false, bonusRolls: true, threeSixes: true };
    expect(legalTokens(rig({ rules: loose, phase: "move", dice: 5, tokens: { ada: [53, YARD, YARD, YARD], bo: [YARD, YARD, YARD, YARD] } }))).toEqual([0]);
  });

  it("forfeits the turn on a third six", () => {
    // Find a seed whose roll is a six, then pretend it's the third.
    for (const seed of "abcdefghijklmnopqrstuvwxyz".split("")) {
      const s = rig({ seed, sixes: 2 });
      const n = mv(s, "ada", { type: "roll" });
      if (n.dice === 6) {
        expect(n.turn).toBe(1);
        expect(n.last).toMatchObject({ forfeited: true });
        return;
      }
    }
    throw new Error("no six seed found");
  });

  it("wins when all four tokens are home", () => {
    const s = rig({ phase: "move", dice: 1, tokens: { ada: [HOME, HOME, HOME, 55], bo: [YARD, YARD, YARD, YARD] } });
    const n = mv(s, "ada", { type: "move", token: 3 });
    expect(g.isOver(n)).toEqual({ over: true, winner: "ada" });
    expect(() => mv(n, "bo", { type: "roll" })).toThrow(MoveRejected);
  });
});

describe("ludo for a group", () => {
  const G = ["ada", "bo", "cy", "di"] as const;
  it("gives each of four players their own corner and goes round in turn", () => {
    const s = g.initialState("seed", G, {}, { now: 0 });
    expect(s.colours).toEqual([0, 1, 2, 3]);
    expect(G.map((_, seat) => absoluteFor(colourOf(s, seat), 0))).toEqual([0, 13, 26, 39]);
    // Two players keep opposite corners.
    expect(colourOf(g.initialState("seed", ["a", "b"], {}, { now: 0 }), 1)).toBe(2);
    // A roll with nothing to move passes to the next seat.
    let t = { ...s, turn: 0 };
    for (const seed of "abcdefghijklmnop".split("")) {
      const r = runMove(g, { ...t, seed }, { type: "roll" }, "ada", { now: 0 }).next as LudoState;
      if (r.dice !== 6) {
        expect(r.turn).toBe(1);
        t = r;
        break;
      }
    }
    expect(t.turn).toBe(1);
  });

  it("captures any other player's token, not just one opponent's", () => {
    const s = g.initialState("seed", ["ada", "bo", "cy"], {}, { now: 0 });
    // Cy (colour 2) sits on absolute square 30 = Cy's rel 4. Ada (colour 0) is at rel 27 and rolls 3.
    const rigged: LudoState = {
      ...s,
      turn: 0,
      phase: "move",
      dice: 3,
      tokens: { ada: [27, YARD, YARD, YARD], bo: [YARD, YARD, YARD, YARD], cy: [4, YARD, YARD, YARD] },
    };
    const n = runMove(g, rigged, { type: "move", token: 0 }, "ada", { now: 0 }).next as LudoState;
    expect(n.tokens.cy![0]).toBe(YARD);
    expect(n.last).toMatchObject({ captured: [{ owner: "cy", token: 0 }] });
    expect(n.turn).toBe(0); // capture earns another roll
  });
});

describe("ludo privacy", () => {
  it("never sends the dice seed to clients", () => {
    const v = g.viewFor(rig({}), "ada");
    expect(v).not.toHaveProperty("seed");
    expect(v).not.toHaveProperty("rngCursor");
  });
});

describe("ludo with two dice", () => {
  const two = (over: Partial<LudoState>): LudoState => ({ ...g.initialState("s", P, { firstPlayer: 0, twoDice: true }, ctx), ...over });
  const moving = (left: number[], tokens: LudoState["tokens"], over: Partial<LudoState> = {}) =>
    two({ phase: "move", pair: [left[0]!, left[1] ?? left[0]!], left, dice: left[0]!, tokens, ...over });
  const yard = [YARD, YARD, YARD, YARD];

  it("is off for older sessions and on when picked", () => {
    expect(rig({}).rules.twoDice).toBeUndefined();
    expect(two({}).rules.twoDice).toBe(true);
    const r = mv(two({}), "ada", { type: "roll" });
    expect(r.pair).toHaveLength(2);
    expect(r.last).toMatchObject({ kind: "roll", pair: r.pair });
  });

  it("a six on either die brings a token out, and the other die can move it on", () => {
    let s = moving([6, 3], { ada: [...yard], bo: [...yard] });
    // Only the six gets out; the sum never does.
    expect(legalOptions(s)).toEqual([0, 1, 2, 3].map((token) => ({ token, use: 0 })));
    s = mv(s, "ada", { type: "move", token: 0, use: 0 });
    expect(s.tokens.ada![0]).toBe(0);
    expect(s.left).toEqual([3]);
    expect(s.turn).toBe(0);
    s = mv(s, "ada", { type: "move", token: 0, use: 0 });
    expect(s.tokens.ada![0]).toBe(3);
    // Dice spent, not a double six: the turn passes.
    expect(s.turn).toBe(1);
    expect(s.phase).toBe("roll");
  });

  it("can add the dice together for one token", () => {
    const s = mv(moving([4, 5], { ada: [10, YARD, YARD, YARD], bo: [...yard] }), "ada", { type: "move", token: 0, use: "both" });
    expect(s.tokens.ada![0]).toBe(19);
    expect(s.turn).toBe(1);
  });

  it("ends the turn when the die that's left can't move anything", () => {
    // One token out; after using the 3, the 5 has nowhere to go (the yard needs a six).
    const s = mv(moving([3, 5], { ada: [53, YARD, YARD, YARD], bo: [...yard] }), "ada", { type: "move", token: 0, use: 0 });
    expect(s.tokens.ada![0]).toBe(HOME);
    // Getting home earns another roll.
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("roll");
  });

  it("a double six earns another roll; a capture does too", () => {
    let s = mv(moving([6, 6], { ada: [10, YARD, YARD, YARD], bo: [...yard] }, { again: true, sixes: 1 }), "ada", { type: "move", token: 0, use: "both" });
    expect(s.tokens.ada![0]).toBe(22);
    expect(s.turn).toBe(0);
    expect(s.sixes).toBe(1);
    // Bo's token at rel 4 sits on absolute 30. Ada from 27 with a 3, then 2 more.
    s = moving([3, 2], { ada: [27, YARD, YARD, YARD], bo: [4, YARD, YARD, YARD] });
    s = mv(s, "ada", { type: "move", token: 0, use: 0 });
    expect(s.tokens.bo![0]).toBe(YARD);
    s = mv(s, "ada", { type: "move", token: 0, use: 0 });
    expect(s.turn).toBe(0);
    expect(s.sixes).toBe(0);
  });

  it("forfeits on a third double six", () => {
    for (let i = 0; i < 400; i++) {
      const n = mv(two({ seed: `x${i}`, sixes: 2 }), "ada", { type: "roll" });
      if (n.pair?.[0] === 6 && n.pair[1] === 6) {
        expect(n.turn).toBe(1);
        expect(n.last).toMatchObject({ forfeited: true });
        return;
      }
    }
    throw new Error("no double-six seed found");
  });

  it("rejects a die that can't move that token, and fills in the die for older clients", () => {
    const s = moving([6, 3], { ada: [...yard], bo: [...yard] });
    expect(() => mv(s, "ada", { type: "move", token: 0, use: 1 })).toThrow(MoveRejected);
    expect(() => mv(s, "ada", { type: "move", token: 0, use: "both" })).toThrow(MoveRejected);
    expect(mv(s, "ada", { type: "move", token: 0 }).tokens.ada![0]).toBe(0);
  });

  it("shows choices only to the player whose turn it is", () => {
    const s = moving([6, 3], { ada: [...yard], bo: [...yard] });
    expect(g.viewFor(s, "ada").options).toHaveLength(4);
    expect(g.viewFor(s, "bo").options).toEqual([]);
    expect(g.viewFor(rig({}), "ada")).not.toHaveProperty("options");
  });
});
