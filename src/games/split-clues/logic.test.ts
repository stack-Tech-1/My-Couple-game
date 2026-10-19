import { describe, expect, it } from "vitest";
import { PUZZLES } from "@/content/split-clues";
import { LIVES, matches, splitClues as g, type SplitState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const mv = (s: SplitState, by: string, m: object) => runMove(g, s, m, by, ctx).next as SplitState;
const answerOf = (s: SplitState) => PUZZLES.find((p) => p.id === s.puzzles[s.index])!.answer;

describe("split clues content", () => {
  it("ships at least eight puzzles, each needing both halves", () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    for (const p of PUZZLES) {
      expect(p.a.length, p.id).toBeGreaterThan(0);
      expect(p.b.length, p.id).toBeGreaterThan(0);
      // Neither half simply states the answer.
      for (const clue of [...p.a, ...p.b]) expect(clue.toLowerCase().includes(` ${p.answer} `), `${p.id}: ${clue}`).toBe(false);
    }
  });
  it("accepts formatting variations", () => {
    const clock = PUZZLES.find((p) => p.id === "clock")!;
    for (const t of ["7:45", "7.45", "745", " 7 : 45 "]) expect(matches(clock, t)).toBe(true);
    expect(matches(clock, "8:45")).toBe(false);
  });
});

describe("split clues", () => {
  it("gives each player a different half of the same puzzle", () => {
    const s = g.initialState("seed", P, {}, ctx);
    const a = g.viewFor(s, "ada");
    const b = g.viewFor(s, "bo");
    expect(a.title).toBe(b.title);
    expect(a.clues).not.toEqual(b.clues);
    expect(JSON.stringify(a)).not.toContain(JSON.stringify(b.clues[0]));
    expect(a.answers).toBeNull();
  });

  it("advances on a right answer and costs a life on a wrong one", () => {
    let s = g.initialState("seed", P, {}, ctx);
    s = mv(s, "ada", { type: "answer", text: "definitely not it" });
    expect(s.lives).toBe(LIVES - 1);
    expect(s.attempts).toHaveLength(1);
    s = mv(s, "bo", { type: "answer", text: answerOf(s) });
    expect(s.index).toBe(1);
    expect(s.attempts).toHaveLength(0);
  });

  it("hints cost a star, once per puzzle", () => {
    let s = g.initialState("seed", P, {}, ctx);
    s = mv(s, "ada", { type: "hint" });
    expect(g.viewFor(s, "bo").hint).toBeTruthy();
    expect(() => mv(s, "bo", { type: "hint" })).toThrow(MoveRejected);
    s = mv(s, "ada", { type: "answer", text: answerOf(s) });
    expect(g.viewFor(s, "ada").stars[0]).toBe(2);
  });

  it("clears the chapter when all three are solved", () => {
    let s = g.initialState("seed", P, {}, ctx);
    for (let i = 0; i < 3; i++) s = mv(s, i % 2 ? "bo" : "ada", { type: "answer", text: answerOf(s) });
    expect(g.isOver(s)).toEqual({ over: true, coop: "win" });
    expect(g.viewFor(s, "ada").answers).toHaveLength(3);
  });

  it("runs out of lives together", () => {
    let s = g.initialState("seed", P, {}, ctx);
    for (let i = 0; i < LIVES; i++) s = mv(s, "ada", { type: "answer", text: `nope${i}` });
    expect(g.isOver(s)).toEqual({ over: true, coop: "loss" });
    expect(() => mv(s, "ada", { type: "answer", text: answerOf(s) })).toThrow(MoveRejected);
  });

  it("keeps the chat, even after the game ends", () => {
    let s = g.initialState("seed", P, {}, ctx);
    s = mv(s, "ada", { type: "say", text: "my clue mentions February" });
    expect(g.viewFor(s, "bo").chat).toEqual([{ by: "ada", text: "my clue mentions February" }]);
  });
});
