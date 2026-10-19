import { describe, expect, it } from "vitest";
import { complimentBattle as g, MAX_PER_ROUND, type ComplimentState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const mv = (s: ComplimentState, by: string, m: object, now = 1000) => runMove(g, s, m, by, { now }).next as ComplimentState;
const start = (rounds = 1) => g.initialState("", P, { rounds }, { now: 0 });

describe("compliment battle", () => {
  it("hides compliments from the partner while writing", () => {
    const s = mv(start(), "ada", { type: "say", text: "Your laugh fixes my bad days." });
    const bo = g.viewFor(s, "bo");
    expect(bo.theirs).toBeNull();
    expect(bo.theirCount).toBe(1);
    expect(JSON.stringify(bo)).not.toContain("laugh");
  });

  it("caps compliments per round and stops writing after the deadline", () => {
    let s = start();
    for (let i = 0; i < MAX_PER_ROUND; i++) s = mv(s, "ada", { type: "say", text: `compliment ${i}` });
    expect(() => mv(s, "ada", { type: "say", text: "one more" })).toThrow(MoveRejected);
    expect(() => mv(start(), "bo", { type: "say", text: "too late" }, 60_000)).toThrow(MoveRejected);
  });

  it("moves to judging when both are done, or when time runs out", () => {
    let s = mv(mv(start(), "ada", { type: "done" }), "bo", { type: "done" });
    expect(s.phase).toBe("judging");
    expect(() => mv(start(), "ada", { type: "tick" }, 1000)).toThrow(MoveRejected);
    s = mv(start(), "ada", { type: "tick" }, 46_000);
    expect(s.phase).toBe("judging");
  });

  it("judges must rate every compliment, and verdicts stay hidden until both judge", () => {
    let s = mv(start(), "ada", { type: "say", text: "You make the best tea." });
    s = mv(s, "bo", { type: "say", text: "You always notice the small things." });
    s = mv(s, "bo", { type: "say", text: "Your playlists are elite." });
    s = mv(mv(s, "ada", { type: "done" }), "bo", { type: "done" });
    expect(g.viewFor(s, "ada").theirs).toHaveLength(2);
    expect(() => mv(s, "ada", { type: "judge", hearts: [3] })).toThrow(MoveRejected);
    s = mv(s, "ada", { type: "judge", hearts: [3, 2] });
    expect(g.viewFor(s, "bo").partnerJudged).toBe(true);
    expect(s.scores.bo).toBe(0); // not applied until both judge
    s = mv(s, "bo", { type: "judge", hearts: [1] });
    expect(s.scores).toEqual({ ada: 1, bo: 5 });
    expect(g.isOver(s)).toEqual({ over: true, winner: "bo" });
  });

  it("runs multiple rounds with a fresh clock each time", () => {
    let s = start(2);
    s = mv(mv(s, "ada", { type: "done" }), "bo", { type: "done" });
    s = mv(mv(s, "ada", { type: "judge", hearts: [] }), "bo", { type: "judge", hearts: [] }, 5000);
    expect(s.round).toBe(2);
    expect(s.phase).toBe("writing");
    expect(s.deadline).toBe(5000 + 45_000);
  });
});