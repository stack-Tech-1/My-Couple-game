import { describe, expect, it } from "vitest";
import { knowMeTrivia as g, POINTS, STREAK_BONUS, type Question, type TriviaState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const mv = (s: TriviaState, by: string, m: object) => runMove(g, s, m, by, ctx).next as TriviaState;
const qs = (who: string, n = 3): Question[] =>
  Array.from({ length: n }, (_, i) => ({ prompt: `${who} q${i}?`, answer: `${who}-right-${i}`, decoys: [`${who}-a-${i}`, `${who}-b-${i}`, `${who}-c-${i}`] }));
const start = () => g.initialState("seed", P, { count: 3 }, ctx);
const both = () => mv(mv(start(), "ada", { type: "submit", questions: qs("ada") }), "bo", { type: "submit", questions: qs("bo") });
/** The option index (in this player's view) holding the real answer. */
const rightIndex = (s: TriviaState, by: string, i: number) => {
  const author = by === "ada" ? "bo" : "ada";
  return s.order[author]![i]!.indexOf(0);
};

describe("know me trivia", () => {
  it("needs exactly the configured number of valid questions", () => {
    expect(() => mv(start(), "ada", { type: "submit", questions: qs("ada", 2) })).toThrow(MoveRejected);
    const dupe = [{ prompt: "x?", answer: "same", decoys: ["same", "b", "c"] }, ...qs("ada", 2)];
    expect(() => mv(start(), "ada", { type: "submit", questions: dupe })).toThrow(MoveRejected);
  });

  it("starts answering only once both have written", () => {
    const one = mv(start(), "ada", { type: "submit", questions: qs("ada") });
    expect(one.phase).toBe("write");
    expect(() => mv(one, "ada", { type: "answer", index: 0, choice: 0 })).toThrow(MoveRejected);
    expect(both().phase).toBe("answer");
  });

  it("hides a partner's questions while writing, and the right answer until you've answered", () => {
    const one = mv(start(), "ada", { type: "submit", questions: qs("ada") });
    expect(JSON.stringify(g.viewFor(one, "bo"))).not.toContain("ada-right");
    const s = both();
    const v = g.viewFor(s, "bo");
    expect(v.toAnswer).toHaveLength(3);
    expect(v.toAnswer[0]).not.toHaveProperty("correctIndex");
    const after = mv(s, "bo", { type: "answer", index: 0, choice: 0 });
    const v2 = g.viewFor(after, "bo");
    expect(v2.toAnswer[0]!.correctIndex).toBe(rightIndex(s, "bo", 0));
    expect(v2.toAnswer[1]).not.toHaveProperty("correctIndex");
  });

  it("answers must go in order", () => {
    expect(() => mv(both(), "bo", { type: "answer", index: 1, choice: 0 })).toThrow(MoveRejected);
  });

  it("scores with a growing streak bonus that resets on a miss", () => {
    let s = both();
    s = mv(s, "bo", { type: "answer", index: 0, choice: rightIndex(s, "bo", 0) });
    s = mv(s, "bo", { type: "answer", index: 1, choice: rightIndex(s, "bo", 1) });
    expect(s.scores.bo).toBe(POINTS + POINTS + STREAK_BONUS);
    s = mv(s, "bo", { type: "answer", index: 2, choice: (rightIndex(s, "bo", 2) + 1) % 4 });
    expect(s.scores.bo).toBe(2 * POINTS + STREAK_BONUS);
    expect(s.streaks.bo).toBe(0);
  });

  it("finishes when both have answered everything", () => {
    let s = both();
    for (let i = 0; i < 3; i++) s = mv(s, "ada", { type: "answer", index: i, choice: rightIndex(s, "ada", i) });
    expect(s.winner).toBeNull();
    for (let i = 0; i < 3; i++) s = mv(s, "bo", { type: "answer", index: i, choice: (rightIndex(s, "bo", i) + 1) % 4 });
    expect(g.isOver(s)).toEqual({ over: true, winner: "ada" });
  });
});
