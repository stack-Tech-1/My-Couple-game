import { describe, expect, it } from "vitest";
import { reflexDuel as g, ROUND_TIMEOUT_MS, WINS_NEEDED, type ReflexState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const at = (now: number) => ({ now });
const mv = (s: ReflexState, by: string, m: object, now: number) => runMove(g, s, m, by, at(now)).next as ReflexState;

function armed(): ReflexState {
  let s = g.initialState("seed", P, {}, at(0));
  s = mv(s, "ada", { type: "ready" }, 0);
  s = mv(s, "bo", { type: "ready" }, 0);
  return s;
}

describe("reflex duel", () => {
  it("arms only when both are ready, with the signal in the future", () => {
    let s = g.initialState("seed", P, {}, at(0));
    s = mv(s, "ada", { type: "ready" }, 0);
    expect(s.phase).toBe("lobby");
    expect(() => mv(s, "ada", { type: "ready" }, 0)).toThrow(MoveRejected);
    s = mv(s, "bo", { type: "ready" }, 0);
    expect(s.phase).toBe("armed");
    expect(s.goAt).toBeGreaterThanOrEqual(2500);
    expect(s.goAt).toBeLessThan(6100);
  });

  it("the faster tap wins the round", () => {
    let s = armed();
    const go = s.goAt!;
    s = mv(s, "ada", { type: "tap", ms: 240 }, go + 300);
    expect(s.round).toBe(1);
    s = mv(s, "bo", { type: "tap", ms: 210 }, go + 320);
    expect(s.score).toEqual({ ada: 0, bo: 1 });
    expect(s.round).toBe(2);
    expect(s.results.at(-1)).toMatchObject({ winner: "bo", reason: "faster" });
  });

  it("measures on the tapper's own screen, so lag doesn't decide it", () => {
    let s = armed();
    const go = s.goAt!;
    // Bo's tap arrives much later over a slow link but was the faster reaction.
    s = mv(s, "ada", { type: "tap", ms: 260 }, go + 280);
    s = mv(s, "bo", { type: "tap", ms: 230 }, go + 900);
    expect(s.score.bo).toBe(1);
  });

  it("a false start hands the point to the partner immediately", () => {
    let s = armed();
    s = mv(s, "ada", { type: "tap", ms: null }, s.goAt! - 1000);
    expect(s.score).toEqual({ ada: 0, bo: 1 });
    expect(s.results.at(-1)).toMatchObject({ reason: "false-start", winner: "bo" });
  });

  it("the server catches a gross false start even if the client claims a time", () => {
    let s = armed();
    s = mv(s, "ada", { type: "tap", ms: 200 }, s.goAt! - 2000);
    expect(s.score.bo).toBe(1);
  });

  it("impossibly fast times count as anticipation", () => {
    let s = armed();
    s = mv(s, "ada", { type: "tap", ms: 40 }, s.goAt! + 60);
    expect(s.score.bo).toBe(1);
  });

  it("a tick after the timeout gives the round to whoever tapped", () => {
    let s = armed();
    const go = s.goAt!;
    expect(() => mv(s, "ada", { type: "tick" }, go + 100)).toThrow(MoveRejected);
    s = mv(s, "ada", { type: "tap", ms: 300 }, go + 320);
    s = mv(s, "bo", { type: "tick" }, go + ROUND_TIMEOUT_MS + 10);
    expect(s.score.ada).toBe(1);
    expect(s.results.at(-1)).toMatchObject({ reason: "no-show" });
  });

  it("a tick with no taps replays the round", () => {
    let s = armed();
    s = mv(s, "ada", { type: "tick" }, s.goAt! + ROUND_TIMEOUT_MS + 1);
    expect(s.score).toEqual({ ada: 0, bo: 0 });
    expect(s.round).toBe(2);
  });

  it("first to four wins the match", () => {
    let s = armed();
    for (let i = 0; i < WINS_NEEDED; i++) {
      const go = s.goAt!;
      s = mv(s, "ada", { type: "tap", ms: 200 }, go + 220);
      s = mv(s, "bo", { type: "tap", ms: 300 }, go + 320);
    }
    expect(g.isOver(s)).toEqual({ over: true, winner: "ada" });
    expect(s.goAt).toBeNull();
  });

  it("doesn't send the seed (which would predict the next signal) to clients", () => {
    expect(g.viewFor(armed(), "ada")).not.toHaveProperty("seed");
  });
});
