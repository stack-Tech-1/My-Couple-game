import { describe, expect, it } from "vitest";
import { beatTheClock as g, challenge, COUNTDOWN_MS, ROUND_MS, TARGET, WRONG_PENALTY_MS, type ClockState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const mv = (s: ClockState, by: string, m: object, now: number) => runMove(g, s, m, by, { now }).next as ClockState;
const live = () => mv(mv(g.initialState("seed", P, {}, { now: 0 }), "ada", { type: "ready" }, 0), "bo", { type: "ready" }, 0);
const right = (s: ClockState, by: string) => challenge(s.seed, s.players[0] === by ? 0 : 1, s.steps[by]!).answer;

describe("challenges", () => {
  it("are deterministic, four-option, and always contain exactly one right answer", () => {
    for (let k = 0; k < 300; k++) {
      const c = challenge("x", k % 2, k);
      expect(challenge("x", k % 2, k)).toEqual(c);
      expect(c.options).toHaveLength(4);
      expect(new Set(c.options).size).toBe(4);
      expect(c.answer).toBeGreaterThanOrEqual(0);
      if (c.kind === "math") {
        const [a, op, b] = c.prompt.split(" ");
        const v = op === "+" ? +a! + +b! : op === "×" ? +a! * +b! : +a! - +b!;
        expect(c.options[c.answer]).toBe(String(v));
      }
      if (c.kind === "stroop") expect(c.word).not.toBe(c.ink);
    }
  });
});

describe("beat the clock", () => {
  it("starts after both are ready, with a countdown", () => {
    const s = live();
    expect(s.phase).toBe("live");
    expect(s.deadline).toBe(COUNTDOWN_MS + ROUND_MS);
  });

  it("never sends the answer to the client", () => {
    const v = g.viewFor(live(), "ada");
    expect(v.current).not.toBeNull();
    expect(v.current).not.toHaveProperty("answer");
    expect(v).not.toHaveProperty("seed");
  });

  it("right answers add to the shared score; wrong ones cost both of you time", () => {
    let s = live();
    s = mv(s, "ada", { type: "answer", step: 0, choice: right(s, "ada") }, 4000);
    s = mv(s, "bo", { type: "answer", step: 0, choice: right(s, "bo") }, 4000);
    expect(s.score).toBe(2);
    const before = s.deadline!;
    s = mv(s, "ada", { type: "answer", step: 1, choice: (right(s, "ada") + 1) % 4 }, 5000);
    expect(s.score).toBe(2);
    expect(s.deadline).toBe(before - WRONG_PENALTY_MS);
  });

  it("rejects stale or skipped steps", () => {
    const s = live();
    expect(() => mv(s, "ada", { type: "answer", step: 3, choice: 0 }, 4000)).toThrow(MoveRejected);
  });

  it("wins the moment the team hits the target", () => {
    let s = live();
    for (let i = 0; i < TARGET; i++) {
      const who = i % 2 ? "bo" : "ada";
      s = mv(s, who, { type: "answer", step: s.steps[who]!, choice: right(s, who) }, 5000 + i);
    }
    expect(g.isOver(s)).toEqual({ over: true, coop: "win" });
  });

  it("loses when the clock runs out short of the target", () => {
    let s = live();
    expect(() => mv(s, "ada", { type: "tick" }, 10_000)).toThrow(MoveRejected);
    s = mv(s, "ada", { type: "tick" }, s.deadline! + 1);
    expect(g.isOver(s)).toEqual({ over: true, coop: "loss" });
  });
});
