import { describe, expect, it } from "vitest";
import { isWord, mark, wordDuel as g, MAX_GUESSES, type WordDuelState } from "./logic";
import { ANSWERS } from "@/content/words/answers5";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const rig = (target: string): WordDuelState => ({ ...g.initialState("s", P, {}, ctx), target });
const guess = (s: WordDuelState, by: string, w: string) => runMove(g, s, { guess: w }, by, ctx).next as WordDuelState;

describe("word lists", () => {
  it("every answer is a valid guess, and there are plenty", () => {
    expect(ANSWERS.length).toBeGreaterThan(500);
    for (const w of ANSWERS) expect(isWord(w)).toBe(true);
  });
  it("rejects non-words", () => {
    expect(isWord("qzxvb")).toBe(false);
    expect(isWord("crane")).toBe(true);
  });
});

describe("marking", () => {
  it("marks greens, yellows and greys", () => {
    expect(mark("crane", "react")).toEqual(["y", "y", "g", "x", "y"]);
  });
  it("handles repeated letters like the real thing", () => {
    expect(mark("sassy", "brass")).toEqual(["y", "y", "x", "g", "x"]);
    expect(mark("llama", "hello")).toEqual(["y", "y", "x", "x", "x"]);
    expect(mark("geese", "these")).toEqual(["x", "x", "g", "g", "g"]);
  });
});

describe("word duel", () => {
  it("both players can guess at the same time", () => {
    let s = rig("bread");
    s = guess(s, "ada", "crane");
    s = guess(s, "bo", "slate");
    expect(s.guesses.ada).toHaveLength(1);
    expect(s.guesses.bo).toHaveLength(1);
  });

  it("rejects words not in the dictionary", () => {
    expect(() => guess(rig("bread"), "ada", "qzxvb")).toThrow(MoveRejected);
    expect(() => guess(rig("bread"), "ada", "four")).toThrow(MoveRejected);
  });

  it("the first to solve wins", () => {
    let s = rig("bread");
    s = guess(s, "bo", "crane");
    s = guess(s, "ada", "bread");
    expect(g.isOver(s)).toEqual({ over: true, winner: "ada" });
    expect(() => guess(s, "bo", "bread")).toThrow(MoveRejected);
  });

  it("caps guesses at six and ties when both run out", () => {
    let s = rig("bread");
    const misses = ["crane", "slate", "pious", "lymph", "glove", "touch"];
    for (const w of misses) s = guess(s, "ada", w);
    expect(s.guesses.ada).toHaveLength(MAX_GUESSES);
    expect(() => guess(s, "ada", "bread")).toThrow(MoveRejected);
    expect(s.winner).toBeNull();
    for (const w of misses) s = guess(s, "bo", w);
    expect(g.isOver(s)).toEqual({ over: true, winner: "tie" });
  });

  it("a player who is out can still lose to one who solves late", () => {
    let s = rig("bread");
    for (const w of ["crane", "slate", "pious", "lymph", "glove", "touch"]) s = guess(s, "ada", w);
    s = guess(s, "bo", "bread");
    expect(g.isOver(s)).toEqual({ over: true, winner: "bo" });
  });

  it("never leaks the target or the partner's letters", () => {
    let s = rig("bread");
    s = guess(s, "bo", "brave");
    const v = g.viewFor(s, "ada");
    const json = JSON.stringify(v);
    expect(json).not.toContain("bread");
    expect(json).not.toContain("brave");
    expect(v.theirs).toEqual([["g", "g", "y", "x", "y"]]);
    expect(v.target).toBeNull();
  });
});
