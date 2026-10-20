import { describe, expect, it } from "vitest";
import { runMove, MoveRejected } from "@/games/_engine/runner";
import type { AnyGameLogic } from "@/games/_engine/types";
import { DARES, DICE, FANTASY, HOT_SEAT, NEVER, TRUTHS } from "@/content/after-dark";
import { hotSeat, neverHaveI, spicyDice, truthOrDare, type TodState } from "./logic";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const mv = <S,>(g: AnyGameLogic, s: S, by: string, m: object) => runMove(g, s, m, by, ctx).next as S;

describe("after dark content", () => {
  it("has every heat level in every deck, and unique fantasy ids", () => {
    for (const d of [TRUTHS, DARES, HOT_SEAT, NEVER]) for (const h of [1, 2, 3]) expect(d.filter((c) => c.heat === h).length).toBeGreaterThanOrEqual(8);
    for (const h of [1, 2, 3] as const) {
      expect(DICE[h].action).toHaveLength(6);
      expect(DICE[h].where).toHaveLength(6);
    }
    expect(new Set(FANTASY.map((f) => f.id)).size).toBe(FANTASY.length);
  });
});

describe("heat cap", () => {
  it("never deals a card hotter than the server-set cap, whatever is requested", () => {
    let s = truthOrDare.initialState("seed", P, { maxHeat: 2 }, ctx);
    expect(() => mv(truthOrDare, s, "ada", { type: "heat", heat: 3 })).toThrow(MoveRejected);
    s = mv(truthOrDare, s, "bo", { type: "heat", heat: 2 });
    for (let i = 0; i < 60; i++) {
      const who = s.players[s.turn];
      s = mv(truthOrDare, s, who, { type: "pick", kind: i % 2 ? "truth" : "dare" });
      expect(s.current!.card.heat).toBeLessThanOrEqual(2);
      s = mv(truthOrDare, s, who, { type: "done" });
    }
  });

  it("filters custom cards by the cap too, and includes them in the deck", () => {
    const s = truthOrDare.initialState("seed", P, { maxHeat: 1, custom: [{ deck: "truth", heat: 1, text: "Our private question" }, { deck: "truth", heat: 3, text: "Too hot for the cap" }] }, ctx);
    const texts = s.truths.cards.map((c) => c.text);
    expect(texts).toContain("Our private question");
    expect(texts).not.toContain("Too hot for the cap");
  });
});

describe("truth or dare", () => {
  it("only the current player picks; either can skip; done passes the turn", () => {
    let s: TodState = truthOrDare.initialState("seed", P, { maxHeat: 3 }, ctx);
    const first = s.players[s.turn];
    const second = first === "ada" ? "bo" : "ada";
    expect(() => mv(truthOrDare, s, second, { type: "pick", kind: "truth" })).toThrow(MoveRejected);
    s = mv(truthOrDare, s, first, { type: "pick", kind: "dare" });
    const before = s.current!.card.text;
    s = mv(truthOrDare, s, second, { type: "skip" });
    expect(s.current!.kind).toBe("dare");
    expect(s.current!.card.text).not.toBe(before);
    s = mv(truthOrDare, s, first, { type: "done" });
    expect(s.players[s.turn]).toBe(second);
  });

  it("ends as complete, never with a winner", () => {
    const s = mv(truthOrDare, truthOrDare.initialState("seed", P, {}, ctx), "ada", { type: "end" });
    expect(truthOrDare.isOver(s)).toEqual({ over: true, complete: true });
  });
});

describe("spicy dice", () => {
  it("rolls faces from the current heat and hides the seed", () => {
    let s = spicyDice.initialState("seed", P, { maxHeat: 2 }, ctx);
    s = mv(spicyDice, s, s.players[s.turn], { type: "roll" });
    expect(DICE[1].action).toContain(s.roll!.action);
    const v = spicyDice.viewFor(s, "ada");
    expect(v).not.toHaveProperty("seed");
    expect(JSON.stringify(v)).not.toContain('"seed"');
  });
});

describe("hot seat", () => {
  it("swaps the seat after a run of questions; skips don't count", () => {
    let s = hotSeat.initialState("seed", P, { maxHeat: 3 }, ctx);
    const first = s.seat;
    s = mv(hotSeat, s, "ada", { type: "skip" });
    expect(s.answered).toBe(0);
    for (let i = 0; i < 5; i++) s = mv(hotSeat, s, "bo", { type: "next" });
    expect(s.seat).not.toBe(first);
    expect(s.answered).toBe(0);
  });
});

describe("never have I ever", () => {
  it("keeps each answer secret, even via the tally, until both have answered", () => {
    let s = neverHaveI.initialState("seed", P, { maxHeat: 1 }, ctx);
    s = mv(neverHaveI, s, "ada", { type: "answer", have: true });
    const bo = neverHaveI.viewFor(s, "bo");
    expect(bo.revealed).toBeNull();
    expect(bo.partnerAnswered).toBe(true);
    expect(bo.tally.ada).toBe(0); // the pending "I have" isn't leaked through the count
    expect(() => mv(neverHaveI, s, "ada", { type: "next" })).toThrow(MoveRejected);
    s = mv(neverHaveI, s, "bo", { type: "answer", have: false });
    expect(neverHaveI.viewFor(s, "bo").revealed).toEqual({ ada: true, bo: false });
    expect(neverHaveI.viewFor(s, "bo").tally.ada).toBe(1);
  });
});
