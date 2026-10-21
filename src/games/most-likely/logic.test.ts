import { describe, expect, it } from "vitest";
import { MOST_LIKELY } from "@/content/most-likely";
import { mostLikely, MOST_LIKELY_COUNT, topVoted } from "./logic";
import { dontLaugh } from "../dont-laugh/logic";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const ctx = { now: 0 };

describe("most likely to", () => {
  it("is a group game with unique prompts", () => {
    expect(mostLikely.minPlayers).toBe(3);
    expect(new Set(MOST_LIKELY).size).toBe(MOST_LIKELY.length);
    expect(MOST_LIKELY.length).toBeGreaterThanOrEqual(MOST_LIKELY_COUNT * 3);
  });

  it("keeps votes anonymous and reveals counts only when everyone has voted", () => {
    let s = mostLikely.initialState("seed", [A, B, C], {}, ctx);
    s = mostLikely.applyMove(s, { index: 0, vote: B }, A, ctx);
    s = mostLikely.applyMove(s, { index: 0, vote: B }, C, ctx);
    const vb = mostLikely.viewFor(s, B);
    expect(vb.done).toHaveLength(0);
    expect(vb.answered).toEqual([A, C]);
    // Nothing in any view says who voted for whom.
    expect(JSON.stringify(mostLikely.viewFor(s, A))).not.toContain(`"votes"`);
    // Can't run ahead, can't vote for an outsider.
    expect(mostLikely.validateMove(s, { index: 1, vote: A }, A, ctx)).toBe(false);
    expect(mostLikely.validateMove(s, { index: 0, vote: "00000000-0000-4000-8000-00000000000d" }, B, ctx)).toBe(false);
    s = mostLikely.applyMove(s, { index: 0, vote: A }, B, ctx);
    expect(mostLikely.viewFor(s, C).done[0]!.counts).toEqual({ [A]: 1, [B]: 2, [C]: 0 });
    for (let i = 1; i < MOST_LIKELY_COUNT; i++) for (const p of [A, B, C]) s = mostLikely.applyMove(s, { index: i, vote: C }, p, ctx);
    expect(mostLikely.isOver(s)).toEqual({ over: true, complete: true });
    expect(mostLikely.viewFor(s, A).finished).toBe(true);
  });

  it("finds the top of a round, including ties and no votes", () => {
    expect(topVoted({ a: 2, b: 2, c: 0 })).toEqual(["a", "b"]);
    expect(topVoted({ a: 0, b: 0 })).toEqual([]);
  });
});

describe("don't laugh in a group", () => {
  it("rotates the performer, waits for every watcher, and scores each laugh", () => {
    let s = dontLaugh.initialState("seed", [A, B, C], {}, ctx);
    expect(dontLaugh.viewFor(s, A).rounds).toBe(6); // two turns each
    const perf = dontLaugh.viewFor(s, A).performer!;
    const watchers = [A, B, C].filter((p) => p !== perf);
    s = dontLaugh.applyMove(s, { type: "verdict", laughed: true }, watchers[0]!, ctx);
    // One watcher answered: the turn isn't over, and they can't answer twice.
    expect(dontLaugh.viewFor(s, A).round).toBe(0);
    expect(dontLaugh.validateMove(s, { type: "verdict", laughed: false }, watchers[0]!, ctx)).toBe(false);
    expect(dontLaugh.viewFor(s, watchers[0]!).myVerdict).toBe(true);
    s = dontLaugh.applyMove(s, { type: "verdict", laughed: true }, watchers[1]!, ctx);
    const v = dontLaugh.viewFor(s, A);
    expect(v.round).toBe(1);
    expect(v.scores[perf]).toBe(2);
    expect(v.history[0]!.laughs.sort()).toEqual([...watchers].sort());
    expect(v.performer).not.toBe(perf);
  });
});
