import { describe, expect, it } from "vitest";
import { makeRng, shuffle } from "./rng";
import { toDb } from "./runner";

describe("rng", () => {
  it("is deterministic per seed and resumable by cursor", () => {
    const a = makeRng("x");
    const seq = [a.next(), a.next(), a.next()];
    expect(makeRng("x").next()).toBe(seq[0]);
    expect(makeRng("x", 2).next()).toBe(seq[2]);
    expect(makeRng("y").next()).not.toBe(seq[0]);
  });
  it("shuffles without losing items", () => {
    const out = shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRng("s"));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRng("s"))).toEqual(out);
  });
});

describe("toDb", () => {
  it("maps outcomes to persisted columns", () => {
    expect(toDb({ over: false })).toEqual({ status: "active", outcome: null, winner: null });
    expect(toDb({ over: true, winner: "u1" })).toEqual({ status: "finished", outcome: "win", winner: "u1" });
    expect(toDb({ over: true, winner: "tie" })).toEqual({ status: "finished", outcome: "tie", winner: null });
    expect(toDb({ over: true, coop: "win" })).toEqual({ status: "finished", outcome: "coop_win", winner: null });
  });
});