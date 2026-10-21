import { describe, expect, it } from "vitest";
import { LOVE_STYLE_PAIRS, LOVE_STYLES, SAME_PAGE, DONT_LAUGH } from "@/content/together-quizzes";
import { loveStyles, profileOf, topStyles } from "./logic";
import { samePage } from "../same-page/logic";
import { dontLaugh, DONT_LAUGH_ROUNDS } from "../dont-laugh/logic";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ctx = { now: 0 };

describe("love styles", () => {
  it("covers every pair of styles once, so each style can score 0 to 4", () => {
    const keys = LOVE_STYLE_PAIRS.map(([x, y]) => [x.style, y.style].sort().join("+"));
    expect(new Set(keys).size).toBe(10);
    for (const s of LOVE_STYLES) expect(LOVE_STYLE_PAIRS.filter((p) => p.some((c) => c.style === s))).toHaveLength(4);
  });

  it("keeps both profiles hidden until both have finished, then reveals profiles and guesses", () => {
    let s = loveStyles.initialState("seed", [A, B], {}, ctx);
    const finish = (by: string, side: 0 | 1, guess: (typeof LOVE_STYLES)[number]) => {
      for (let i = 0; i < 10; i++) {
        expect(loveStyles.validateMove(s, { type: "guess", style: guess }, by, ctx)).toBe(false);
        s = loveStyles.applyMove(s, { type: "pick", index: i, side }, by, ctx);
      }
      s = loveStyles.applyMove(s, { type: "guess", style: guess }, by, ctx);
    };
    finish(A, 0, "time");
    expect(loveStyles.viewFor(s, B).result).toBeNull();
    expect(JSON.stringify(loveStyles.viewFor(s, B))).not.toContain("style\"");
    finish(B, 1, "words");
    expect(loveStyles.isOver(s)).toEqual({ over: true, complete: true });
    const r = loveStyles.viewFor(s, A).result!;
    expect(Object.values(r.profiles[A]!).reduce((x, y) => x + y)).toBe(10);
    expect(r.guesses).toEqual({ [A]: "time", [B]: "words" });
    expect(r.profiles[A]).toEqual(profileOf(s.pairs, s.picks[A]!));
  });

  it("finds joint top styles", () => {
    expect(topStyles({ words: 3, time: 3, gifts: 2, help: 1, touch: 1 })).toEqual(["words", "time"]);
  });
});

describe("on the same page", () => {
  it("has four distinct options per question and reveals only at the end", () => {
    for (const q of SAME_PAGE) expect(new Set(q.options).size, q.q).toBe(4);
    let s = samePage.initialState("seed", [A, B], {}, ctx);
    for (let i = 0; i < s.items.length; i++) s = samePage.applyMove(s, { index: i, pick: i % 4 }, A, ctx);
    expect(samePage.viewFor(s, B).theirs).toBeNull();
    for (let i = 0; i < s.items.length; i++) s = samePage.applyMove(s, { index: i, pick: i === 0 ? 3 : i % 4 }, B, ctx);
    expect(samePage.viewFor(s, A).matches).toBe(s.items.length - 1);
    expect(samePage.isOver(s)).toEqual({ over: true, complete: true });
  });
});

describe("don't laugh", () => {
  it("shows the prompt only to the performer, alternates turns, and scores laughs", () => {
    expect(new Set(DONT_LAUGH).size).toBe(DONT_LAUGH.length);
    let s = dontLaugh.initialState("seed", [A, B], {}, ctx);
    const first = dontLaugh.viewFor(s, A).performer!;
    const other = first === A ? B : A;
    expect(dontLaugh.viewFor(s, first).prompt).toBeTruthy();
    expect(dontLaugh.viewFor(s, other).prompt).toBeNull();
    expect(dontLaugh.validateMove(s, { type: "verdict", laughed: true }, first, ctx)).toBe(false);
    expect(dontLaugh.validateMove(s, { type: "swap" }, other, ctx)).toBe(false);

    const before = dontLaugh.viewFor(s, first).prompt;
    s = dontLaugh.applyMove(s, { type: "swap" }, first, ctx);
    expect(dontLaugh.viewFor(s, first).prompt).not.toBe(before);
    expect(dontLaugh.validateMove(s, { type: "swap" }, first, ctx)).toBe(false);

    for (let r = 0; r < DONT_LAUGH_ROUNDS; r++) {
      const perf = dontLaugh.viewFor(s, A).performer!;
      expect(perf).toBe(r % 2 === 0 ? first : other);
      const watcher = perf === A ? B : A;
      s = dontLaugh.applyMove(s, { type: "verdict", laughed: perf === first }, watcher, ctx);
    }
    expect(dontLaugh.isOver(s)).toEqual({ over: true, winner: first });
    expect(dontLaugh.viewFor(s, A).scores).toEqual({ [first]: 3, [other]: 0 });
  });
});
