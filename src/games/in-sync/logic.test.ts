import { describe, expect, it } from "vitest";
import { inSync as g, MAX_ROUNDS, same, type InSyncState } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const mv = (s: InSyncState, by: string, word: string) => runMove(g, s, { word }, by, ctx).next as InSyncState;

describe("in sync", () => {
  it("treats case, accents, punctuation and a plural s as the same word", () => {
    expect(same("Café", "cafe")).toBe(true);
    expect(same("ice-cream", "Ice cream")).toBe(true);
    expect(same("cat", "cats")).toBe(true);
    expect(same("cat", "dog")).toBe(false);
  });

  it("hides the partner's word until both lock in", () => {
    const s = mv(g.initialState("", P, {}, ctx), "ada", "ocean");
    const bo = g.viewFor(s, "bo");
    expect(bo.partnerLockedIn).toBe(true);
    expect(JSON.stringify(bo)).not.toContain("ocean");
    expect(() => mv(s, "ada", "again")).toThrow(MoveRejected);
  });

  it("reveals both and moves on when they differ", () => {
    let s = mv(g.initialState("", P, {}, ctx), "ada", "ocean");
    s = mv(s, "bo", "pizza");
    expect(s.round).toBe(2);
    expect(g.viewFor(s, "bo").history).toEqual([{ mine: "pizza", theirs: "ocean" }]);
  });

  it("wins together on a match", () => {
    let s = mv(g.initialState("", P, {}, ctx), "ada", "Beach");
    s = mv(s, "bo", "beach");
    expect(g.isOver(s)).toEqual({ over: true, coop: "win" });
  });

  it("loses together after the last round", () => {
    let s = g.initialState("", P, {}, ctx);
    for (let i = 0; i < MAX_ROUNDS; i++) s = mv(mv(s, "ada", `a${i}`), "bo", `b${i}`);
    expect(g.isOver(s)).toEqual({ over: true, coop: "loss" });
  });
});
