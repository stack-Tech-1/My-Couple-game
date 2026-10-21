import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { LOVE_STYLE_PAIRS, LOVE_STYLES, type LoveStyle } from "@/content/together-quizzes";

/**
 * Love Styles: ten either-or choices each, then a guess at your partner's main style.
 * Nothing is shown until you've both finished. Not scored: it's a conversation starter.
 */
type Choice = { text: string; style: LoveStyle };
export type LoveStylesState = { players: Players; pairs: [Choice, Choice][]; picks: Record<PlayerId, (0 | 1)[]>; guesses: Record<PlayerId, LoveStyle | null> };
export type LoveStylesMove = { type: "pick"; index: number; side: 0 | 1 } | { type: "guess"; style: LoveStyle };
export type Profile = Record<LoveStyle, number>;
export type LoveStylesView = {
  players: Players;
  me: PlayerId;
  pairs: [string, string][];
  mine: (0 | 1)[];
  myGuess: LoveStyle | null;
  partnerDone: boolean;
  /** Both profiles and guesses, once both have finished. */
  result: { profiles: Record<PlayerId, Profile>; guesses: Record<PlayerId, LoveStyle> } | null;
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pick"), index: z.number().int().min(0).max(9), side: z.union([z.literal(0), z.literal(1)]) }),
  z.object({ type: z.literal("guess"), style: z.enum(LOVE_STYLES) }),
]);

export function profileOf(pairs: [Choice, Choice][], picks: (0 | 1)[]): Profile {
  const p = Object.fromEntries(LOVE_STYLES.map((s) => [s, 0])) as Profile;
  picks.forEach((side, i) => {
    const c = pairs[i]?.[side];
    if (c) p[c.style]++;
  });
  return p;
}
/** Styles with the highest count (there can be a joint top). */
export const topStyles = (p: Profile): LoveStyle[] => {
  const max = Math.max(...LOVE_STYLES.map((s) => p[s]));
  return LOVE_STYLES.filter((s) => p[s] === max);
};

const finished = (s: LoveStylesState, p: PlayerId) => s.picks[p]!.length === s.pairs.length && s.guesses[p] !== null;

export const loveStyles: GameLogic<LoveStylesState, LoveStylesMove, LoveStylesView> = {
  id: "love-styles",
  category: "personal",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 5,
  moveSchema,
  rules: {
    summary: "Ten quick either-or choices show how you most like to be loved. Then guess your partner's.",
    sections: [
      { title: "How it works", body: ["Pick the one that would mean more to you. Both are nice; go with your gut.", "Then guess which style your partner will land on."] },
      { title: "The reveal", body: ["Once you've both finished, see each other's styles side by side, and whether your guesses were right.", "Five styles: kind words, time together, thoughtful gifts, helping hands and touch."] },
    ],
  },

  initialState(seed, players) {
    const rng = makeRng(seed);
    const pairs = shuffle(LOVE_STYLE_PAIRS, rng).map((pair) => (rng.int(2) ? [pair[1], pair[0]] : [pair[0], pair[1]]) as [Choice, Choice]);
    return { players, pairs, picks: { [players[0]]: [], [players[1]]: [] }, guesses: { [players[0]]: null, [players[1]]: null } };
  },

  validateMove(s, move, by) {
    if (finished(s, by)) return false;
    if (move.type === "pick") return move.index === s.picks[by]!.length && move.index < s.pairs.length;
    return s.picks[by]!.length === s.pairs.length && s.guesses[by] === null;
  },

  applyMove(s, move, by) {
    if (move.type === "pick") return { ...s, picks: { ...s.picks, [by]: [...s.picks[by]!, move.side] } };
    return { ...s, guesses: { ...s.guesses, [by]: move.style } };
  },

  isOver(s): Outcome {
    return s.players.every((p) => finished(s, p)) ? { over: true, complete: true } : { over: false };
  },

  viewFor(s, player) {
    const partner = s.players[0] === player ? s.players[1] : s.players[0];
    const done = s.players.every((p) => finished(s, p));
    return {
      players: s.players,
      me: player,
      pairs: s.pairs.map(([a, b]) => [a.text, b.text]),
      mine: s.picks[player] ?? [],
      myGuess: s.guesses[player] ?? null,
      partnerDone: finished(s, partner),
      result: done
        ? {
            profiles: { [player]: profileOf(s.pairs, s.picks[player]!), [partner]: profileOf(s.pairs, s.picks[partner]!) },
            guesses: { [player]: s.guesses[player]!, [partner]: s.guesses[partner]! },
          }
        : null,
    };
  },
};
