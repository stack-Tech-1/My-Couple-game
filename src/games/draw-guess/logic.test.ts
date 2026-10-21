import { describe, expect, it } from "vitest";
import { CHOOSE_MS, DRAWER_POINTS, drawerOf, drawGuess as g, nearlyEqual, normalise, type DrawState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const mv = (s: DrawState, by: string, m: object, now = 1000) => runMove(g, s, m, by, { now }).next as DrawState;
const start = (rounds = 2) => g.initialState("seed", P, { rounds, firstPlayer: 0 }, { now: 0 });

describe("draw & guess helpers", () => {
  it("normalises guesses", () => {
    expect(normalise("  Ice-Cream! ")).toBe("icecream");
    expect(normalise("Déjà vu")).toBe("dejavu");
  });
  it("spots near misses", () => {
    expect(nearlyEqual("girafe", "giraffe")).toBe(true);
    expect(nearlyEqual("giraffes", "giraffe")).toBe(true);
    expect(nearlyEqual("jiraffe", "giraffe")).toBe(true);
    expect(nearlyEqual("horse", "giraffe")).toBe(false);
  });
});

describe("draw & guess", () => {
  it("offers the drawer three words, one per difficulty", () => {
    const s = start();
    expect(s.options).toHaveLength(3);
    expect(drawerOf(s)).toBe("ada");
    expect(g.viewFor(s, "ada").options).toHaveLength(3);
    expect(g.viewFor(s, "bo").options).toBeNull();
  });

  it("only the drawer chooses, and the guesser never sees the word", () => {
    const s = start();
    expect(() => mv(s, "bo", { type: "choose", index: 0 })).toThrow(MoveRejected);
    const d = mv(s, "ada", { type: "choose", index: 1 });
    expect(d.phase).toBe("drawing");
    const bo = g.viewFor(d, "bo");
    expect(bo.word).toBeNull();
    expect(JSON.stringify(bo)).not.toContain(d.word!);
    expect(bo.pattern!.replace(/ /g, "").length).toBe(d.word!.replace(/ /g, "").length);
  });

  it("the drawer can't guess their own word", () => {
    const d = mv(start(), "ada", { type: "choose", index: 0 });
    expect(() => mv(d, "ada", { type: "guess", text: d.word! })).toThrow(MoveRejected);
  });

  it("wrong guesses are recorded, with near misses flagged", () => {
    let d = mv(start(), "ada", { type: "choose", index: 0 });
    d = { ...d, word: "giraffe" };
    d = mv(d, "bo", { type: "guess", text: "horse" });
    d = mv(d, "bo", { type: "guess", text: "girafe" });
    expect(d.guesses).toEqual([
      { text: "horse", close: false, by: "bo" },
      { text: "girafe", close: true, by: "bo" },
    ]);
  });

  it("works for a group: drawer rotates, everyone who guesses scores, the word stays hidden", () => {
    const G = ["ada", "bo", "cy"] as const;
    let d = g.initialState("seed", G, {}, { now: 0 });
    expect(d.rounds).toBe(6);
    const drawer = drawerOf(d);
    const [g1, g2] = G.filter((p) => p !== drawer);
    d = runMove(g, d, { type: "choose", index: 0 }, drawer, { now: 0 }).next as DrawState;
    d = runMove(g, d, { type: "guess", text: d.word! }, g1!, { now: 1000 }).next as DrawState;
    // One down, one to go: the round carries on, and the right guess doesn't leak the word.
    expect(d.round).toBe(1);
    expect(JSON.stringify(g.viewFor(d, g2!))).not.toContain(d.word!);
    expect(g.validateMove(d, { type: "guess", text: "again" }, g1!, { now: 1100 })).toBe(false);
    d = runMove(g, d, { type: "guess", text: d.word! }, g2!, { now: 2000 }).next as DrawState;
    expect(d.round).toBe(2);
    expect(d.scores[drawer]).toBe(100);
    expect(d.scores[g1!]).toBeGreaterThan(d.scores[g2!]!);
    expect(drawerOf(d)).not.toBe(drawer);
  });

  it("a fast correct guess scores more, and the drawer scores too", () => {
    const d = { ...mv(start(), "ada", { type: "choose", index: 0 }, 0), word: "giraffe" };
    const fast = mv(d, "bo", { type: "guess", text: "Giraffe" }, 5_000);
    const slow = mv(d, "bo", { type: "guess", text: "giraffes" }, 75_000);
    expect(fast.scores.bo!).toBeGreaterThan(slow.scores.bo!);
    expect(fast.scores.ada).toBe(DRAWER_POINTS);
    expect(fast.round).toBe(2);
    expect(drawerOf(fast)).toBe("bo");
  });

  it("time running out ends the round with no points; ticks before the deadline are rejected", () => {
    const d = mv(start(), "ada", { type: "choose", index: 0 }, 0);
    expect(() => mv(d, "bo", { type: "tick" }, 10_000)).toThrow(MoveRejected);
    const t = mv(d, "bo", { type: "tick" }, d.deadline + 1);
    expect(t.round).toBe(2);
    expect(t.scores).toEqual({ ada: 0, bo: 0 });
    expect(t.history[0]).toMatchObject({ guessed: false });
  });

  it("auto-picks the easy word if the drawer dawdles", () => {
    const s = start();
    const t = mv(s, "bo", { type: "tick" }, CHOOSE_MS + 1);
    expect(t.phase).toBe("drawing");
    expect(t.word).toBe(s.options[0]);
  });

  it("ends after the last round with a winner (or a tie)", () => {
    let s = start(2);
    s = { ...mv(s, "ada", { type: "choose", index: 0 }, 0), word: "cat" };
    s = mv(s, "bo", { type: "guess", text: "cat" }, 1_000);
    s = { ...mv(s, "bo", { type: "choose", index: 0 }, 2_000), word: "dog" };
    s = mv(s, "bo", { type: "pass" }, 3_000);
    expect(g.isOver(s)).toEqual({ over: true, winner: "bo" });
    expect(g.viewFor(s, "ada").history).toHaveLength(2);
  });
});
