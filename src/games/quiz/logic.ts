import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players, Rules } from "@/games/_engine/types";
import { makeRng, shuffle, type Rng } from "@/games/_engine/rng";
import type { GameCategory } from "@/games/catalog";

/**
 * One engine for every multiple-choice quiz (riddles, trivia, Pidgin, emoji). Both players answer the
 * same question; nobody sees the right answer or the other's pick until both have answered, and
 * nobody can get more than one question ahead. A point for each right answer.
 */

/** A bank entry. Without `wrong`, three wrong options are drawn from other answers in the same group. */
export type QuizSource = { q: string; a: string; wrong?: readonly string[]; group?: string; note?: string; ask?: string };
export type QuizItem = { q: string; options: string[]; answer: number; note?: string; ask?: string };

export type QuizState = { players: Players; items: QuizItem[]; picks: Record<PlayerId, number[]>; winner: PlayerId | "tie" | null };
export type QuizMove = { index: number; pick: number };

export type QuizRound = { q: string; options: string[]; answer: number; note?: string; ask?: string; mine: number; theirs: number };
export type QuizView = {
  players: Players;
  me: PlayerId;
  total: number;
  /** How the question is shown: plain text, or big emoji. */
  look: "text" | "emoji";
  /** Default prompt above each question, unless the item has its own. */
  ask: string;
  /** Questions both have answered, with the answer and both picks. */
  done: QuizRound[];
  /** My next question (no answer attached), or null while waiting or finished. */
  current: { index: number; q: string; options: string[]; ask?: string } | null;
  partnerAnswered: number;
  scores: Record<PlayerId, number>;
  winner: PlayerId | "tie" | null;
};

export const QUIZ_COUNT = 8;
const moveSchema = z.object({ index: z.number().int().min(0).max(QUIZ_COUNT - 1), pick: z.number().int().min(0).max(3) });

/** Turns bank entries into four-option questions with the answer in a random slot. */
export function buildItems(bank: readonly QuizSource[], rng: Rng, count = QUIZ_COUNT): QuizItem[] {
  return shuffle(bank, rng)
    .slice(0, Math.min(count, bank.length))
    .map((src) => {
      const pool = src.wrong?.length ? [...src.wrong] : bank.filter((b) => (b.group ?? "") === (src.group ?? "") && b.a !== src.a).map((b) => b.a);
      const wrong = shuffle([...new Set(pool)], rng).slice(0, 3);
      const options = shuffle([src.a, ...wrong], rng);
      return { q: src.q, options, answer: options.indexOf(src.a), ...(src.note ? { note: src.note } : {}), ...(src.ask ? { ask: src.ask } : {}) };
    });
}

const scoreOf = (s: QuizState, p: PlayerId, upTo: number) => s.picks[p]!.slice(0, upTo).filter((pick, i) => pick === s.items[i]!.answer).length;

export function makeQuiz(def: { id: string; category?: GameCategory; estimatedMinutes: number; rules: Rules; look?: "text" | "emoji"; ask: string; bank: () => readonly QuizSource[] }): GameLogic<QuizState, QuizMove, QuizView> {
  return {
    id: def.id,
    category: def.category ?? "competitive",
    minPlayers: 2,
    maxPlayers: 2,
    estimatedMinutes: def.estimatedMinutes,
    moveSchema,
    rules: def.rules,

    initialState(seed, players) {
      return { players, items: buildItems(def.bank(), makeRng(seed)), picks: { [players[0]]: [], [players[1]]: [] }, winner: null };
    },

    validateMove(s, move, by) {
      const partner = s.players[0] === by ? s.players[1] : s.players[0];
      const mine = s.picks[by]!.length;
      return !s.winner && move.index === mine && mine < s.items.length && mine <= s.picks[partner]!.length && move.pick < s.items[mine]!.options.length;
    },

    applyMove(s, move, by) {
      const picks = { ...s.picks, [by]: [...s.picks[by]!, move.pick] };
      const next = { ...s, picks };
      const [a, b] = s.players;
      if (picks[a]!.length < s.items.length || picks[b]!.length < s.items.length) return next;
      const sa = scoreOf(next, a, s.items.length);
      const sb = scoreOf(next, b, s.items.length);
      return { ...next, winner: sa === sb ? "tie" : sa > sb ? a : b };
    },

    isOver(s): Outcome {
      return s.winner ? { over: true, winner: s.winner } : { over: false };
    },

    viewFor(s, player) {
      const partner = s.players[0] === player ? s.players[1] : s.players[0];
      const mine = s.picks[player] ?? [];
      const theirs = s.picks[partner] ?? [];
      const both = Math.min(mine.length, theirs.length);
      const next = s.items[mine.length];
      return {
        players: s.players,
        me: player,
        total: s.items.length,
        look: def.look ?? "text",
        ask: def.ask,
        done: s.items.slice(0, both).map((it, i) => ({ ...it, mine: mine[i]!, theirs: theirs[i]! })),
        current: next && !s.winner && mine.length <= theirs.length ? { index: mine.length, q: next.q, options: next.options, ...(next.ask ? { ask: next.ask } : {}) } : null,
        partnerAnswered: theirs.length,
        scores: { [player]: scoreOf(s, player, both), [partner]: scoreOf(s, partner, both) },
        winner: s.winner,
      };
    },
  };
}
