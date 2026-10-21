import { describe, expect, it } from "vitest";
import { makeRng } from "@/games/_engine/rng";
import { RIDDLES } from "@/content/riddles";
import { NAIJA_TRIVIA } from "@/content/naija-trivia";
import { PIDGIN } from "@/content/pidgin";
import { EMOJI_GUESS } from "@/content/emoji-guess";
import { buildItems, QUIZ_COUNT, type QuizState } from "./logic";
import { riddles, naijaTrivia, pidginPalava, emojiGuess } from "./games";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ctx = { now: 0 };

describe("quiz banks", () => {
  for (const [name, bank] of Object.entries({ RIDDLES, NAIJA_TRIVIA, PIDGIN, EMOJI_GUESS })) {
    it(`${name}: every question gets four different options including the answer`, () => {
      expect(bank.length).toBeGreaterThanOrEqual(QUIZ_COUNT * 2);
      expect(new Set(bank.map((b) => b.q)).size).toBe(bank.length);
      const items = buildItems(bank, makeRng("x"), bank.length);
      items.forEach((it, i) => {
        expect(new Set(it.options).size, it.q).toBe(4);
        expect(it.answer, it.q).toBeGreaterThanOrEqual(0);
        expect(it.options[it.answer]).toBe(bank.find((b) => b.q === it.q)!.a);
        void i;
      });
    });
  }

  it("emoji decoys stay within songs or films", () => {
    const items = buildItems(EMOJI_GUESS, makeRng("y"), EMOJI_GUESS.length);
    for (const it of items) {
      const group = EMOJI_GUESS.find((b) => b.q === it.q)!.group;
      for (const o of it.options) expect(EMOJI_GUESS.find((b) => b.a === o)!.group, it.q).toBe(group);
    }
  });
});

describe("quiz engine", () => {
  const g = riddles;
  const start = () => g.initialState("seed", [A, B], {}, ctx);
  const play = (s: QuizState, by: string, pick: number) => {
    const move = { index: s.picks[by]!.length, pick };
    expect(g.validateMove(s, move, by, ctx)).toBe(true);
    return g.applyMove(s, move, by, ctx);
  };

  it("never shows the answer or the partner's pick before both have answered", () => {
    let s = start();
    s = play(s, A, 0);
    const vb = g.viewFor(s, B);
    expect(vb.done).toHaveLength(0);
    expect(JSON.stringify(vb.current)).not.toContain("answer");
    expect(vb.answered).toEqual([A]);
    const va = g.viewFor(s, A);
    expect(va.current).toBeNull();
    s = play(s, B, 1);
    expect(g.viewFor(s, A).done[0]!.picks).toEqual({ [A]: 0, [B]: 1 });
  });

  it("keeps players in step: nobody gets two questions ahead", () => {
    let s = start();
    s = play(s, A, 0);
    expect(g.validateMove(s, { index: 1, pick: 0 }, A, ctx)).toBe(false);
    expect(g.validateMove(s, { index: 0, pick: 0 }, A, ctx)).toBe(false);
  });

  it("scores right answers and ends with a winner or a tie", () => {
    let s = start();
    for (let i = 0; i < s.items.length; i++) {
      const ans = s.items[i]!.answer;
      s = play(s, A, ans);
      s = play(s, B, i === 0 ? (ans + 1) % 4 : ans);
    }
    expect(g.isOver(s)).toEqual({ over: true, winner: A });
    expect(g.viewFor(s, B).scores).toEqual({ [A]: QUIZ_COUNT, [B]: QUIZ_COUNT - 1 });

    let t = start();
    for (let i = 0; i < t.items.length; i++) {
      t = play(t, A, t.items[i]!.answer);
      t = play(t, B, t.items[i]!.answer);
    }
    expect(g.isOver(t)).toEqual({ over: true, winner: "tie" });
  });

  it("works for a group: everyone in step, reveal only when all have answered, tie at the top", () => {
    const C = "00000000-0000-4000-8000-00000000000c";
    expect(riddles.maxPlayers).toBe(8);
    let s = riddles.initialState("seed", [A, B, C], {}, ctx);
    const go = (by: string, pick: number) => (s = riddles.applyMove(s, { index: s.picks[by]!.length, pick }, by, ctx));
    go(A, 0);
    go(B, 0);
    expect(riddles.viewFor(s, A).done).toHaveLength(0);
    expect(riddles.viewFor(s, A).current).toBeNull();
    expect(riddles.validateMove(s, { index: 1, pick: 0 }, A, ctx)).toBe(false);
    expect(riddles.viewFor(s, C).answered).toEqual([A, B]);
    go(C, 0);
    expect(riddles.viewFor(s, B).done).toHaveLength(1);
    expect(Object.keys(riddles.viewFor(s, B).done[0]!.picks)).toHaveLength(3);
    for (let i = 1; i < s.items.length; i++) for (const p of [A, B, C]) go(p, p === C ? (s.items[i]!.answer + 1) % 4 : s.items[i]!.answer);
    // A and B share the top score.
    expect(riddles.isOver(s)).toEqual({ over: true, winner: "tie" });
  });

  it("all four games deal a full round", () => {
    for (const game of [riddles, naijaTrivia, pidginPalava, emojiGuess]) expect(game.initialState("s", [A, B], {}, ctx).items).toHaveLength(QUIZ_COUNT);
  });
});
