import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { SAME_PAGE } from "@/content/together-quizzes";

/** On the Same Page: both answer the same life questions; the reveal shows where you match. Not scored. */
export const SAME_PAGE_COUNT = 10;
export type SamePageState = { players: Players; items: { q: string; options: string[] }[]; picks: Record<PlayerId, number[]> };
export type SamePageMove = { index: number; pick: number };
export type SamePageView = {
  players: Players;
  me: PlayerId;
  items: { q: string; options: string[] }[];
  mine: number[];
  partnerProgress: number;
  theirs: number[] | null;
  matches: number | null;
};

const moveSchema = z.object({ index: z.number().int().min(0).max(SAME_PAGE_COUNT - 1), pick: z.number().int().min(0).max(3) });
const done = (s: SamePageState) => s.players.every((p) => s.picks[p]!.length === s.items.length);

export const samePage: GameLogic<SamePageState, SamePageMove, SamePageView> = {
  id: "same-page",
  category: "personal",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 6,
  moveSchema,
  rules: {
    summary: "Ten real-life questions: money, family, children, where to live. See how in step you are.",
    sections: [
      { title: "How it works", body: ["Answer honestly for yourself. You won't see each other's answers until you've both finished."] },
      { title: "The reveal", body: ["Matches are counted, and the ones where you differ are marked as worth a conversation. There are no wrong answers."] },
    ],
  },

  initialState(seed, players) {
    const items = shuffle(SAME_PAGE, makeRng(seed)).slice(0, SAME_PAGE_COUNT).map((i) => ({ q: i.q, options: [...i.options] }));
    return { players, items, picks: { [players[0]]: [], [players[1]]: [] } };
  },

  validateMove(s, move, by) {
    return !done(s) && move.index === s.picks[by]!.length && move.index < s.items.length;
  },

  applyMove(s, move, by) {
    return { ...s, picks: { ...s.picks, [by]: [...s.picks[by]!, move.pick] } };
  },

  isOver(s): Outcome {
    return done(s) ? { over: true, complete: true } : { over: false };
  },

  viewFor(s, player) {
    const partner = s.players[0] === player ? s.players[1] : s.players[0];
    const mine = s.picks[player] ?? [];
    const theirs = s.picks[partner] ?? [];
    const end = done(s);
    return {
      players: s.players,
      me: player,
      items: s.items,
      mine,
      partnerProgress: theirs.length,
      theirs: end ? theirs : null,
      matches: end ? mine.filter((p, i) => p === theirs[i]).length : null,
    };
  },
};
