import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList, Rules } from "@/games/_engine/types";
import { makeRng, shuffle, type Rng } from "@/games/_engine/rng";
import type { GameCategory } from "@/games/catalog";

/**
 * One engine for every multiple-choice quiz (riddles, trivia, Pidgin, emoji), for 2 to 8 players.
 * Everyone answers the same question; nobody sees the right answer or anyone's pick until all have
 * answered, and nobody can get more than one question ahead of the slowest player. A point for
 * each right answer.
 */

/** A bank entry. Without `wrong`, three wrong options are drawn from other answers in the same group. */
export type QuizSource = { q: string; a: string; wrong?: readonly string[]; group?: string; note?: string; ask?: string };
export type QuizItem = { q: string; options: string[]; answer: number; note?: string; ask?: string };

export type QuizState = { players: PlayerList; items: QuizItem[]; picks: Record<PlayerId, number[]>; winner: PlayerId | "tie" | null };
export type QuizMove = { index: number; pick: number };

export type QuizRound = { q: string; options: string[]; answer: number; note?: string; ask?: string; picks: Record<PlayerId, number> };
export type QuizView = {
  players: PlayerList;
  me: PlayerId;
  total: number;
  /** How the question is shown: plain text, or big emoji. */
  look: "text" | "emoji";
  /** Default prompt above each question, unless the item has its own. */
  ask: string;
  /** Questions everyone has answered, with the answer and every pick. */
  done: QuizRound[];
  /** My next question (no answer attached), or null while waiting or finished. */
  current: { index: number; q: string; options: string[]; ask?: string } | null;
  /** Who has answered my current question (or, while I wait, the one I just answered). */
  answered: PlayerId[];
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

/** How many questions every player has answered. */
const allDone = (s: QuizState) => Math.min(...s.players.map((p) => s.picks[p]?.length ?? 0));
const scoreOf = (s: QuizState, p: PlayerId, upTo: number) => (s.picks[p] ?? []).slice(0, upTo).filter((pick, i) => pick === s.items[i]!.answer).length;

/** The single top scorer, or "tie" when two or more share the top. */
export function topOf(scores: Record<PlayerId, number>): PlayerId | "tie" {
  const best = Math.max(...Object.values(scores));
  const top = Object.keys(scores).filter((p) => scores[p] === best);
  return top.length === 1 ? top[0]! : "tie";
}

export function makeQuiz(def: {
  id: string;
  category?: GameCategory;
  estimatedMinutes: number;
  rules: Rules;
  look?: "text" | "emoji";
  ask: string;
  bank: () => readonly QuizSource[];
  /** Group-capable (friend rooms): up to this many players. */
  maxPlayers?: number;
}): GameLogic<QuizState, QuizMove, QuizView, Record<string, never>, PlayerList> {
  return {
    id: def.id,
    category: def.category ?? "competitive",
    minPlayers: 2,
    maxPlayers: def.maxPlayers ?? 2,
    estimatedMinutes: def.estimatedMinutes,
    moveSchema,
    rules: def.rules,

    initialState(seed, players) {
      return { players: [...players], items: buildItems(def.bank(), makeRng(seed)), picks: Object.fromEntries(players.map((p) => [p, []])), winner: null };
    },

    validateMove(s, move, by) {
      const mine = s.picks[by]?.length;
      if (mine === undefined || s.winner) return false;
      // At most one question ahead of the slowest player.
      return move.index === mine && mine < s.items.length && mine <= allDone(s) && move.pick < s.items[mine]!.options.length;
    },

    applyMove(s, move, by) {
      const next = { ...s, picks: { ...s.picks, [by]: [...s.picks[by]!, move.pick] } };
      if (allDone(next) < s.items.length) return next;
      return { ...next, winner: topOf(Object.fromEntries(s.players.map((p) => [p, scoreOf(next, p, s.items.length)]))) };
    },

    isOver(s): Outcome {
      return s.winner ? { over: true, winner: s.winner } : { over: false };
    },

    viewFor(s, player) {
      const mine = s.picks[player] ?? [];
      const both = allDone(s);
      const next = s.items[mine.length];
      const canAnswer = !!next && !s.winner && mine.length <= both;
      // The question I'm on, or (while waiting for others) the one I just answered.
      const focus = canAnswer ? mine.length : mine.length - 1;
      return {
        players: s.players,
        me: player,
        total: s.items.length,
        look: def.look ?? "text",
        ask: def.ask,
        done: s.items.slice(0, both).map((it, i) => ({ ...it, picks: Object.fromEntries(s.players.map((p) => [p, s.picks[p]![i]!])) })),
        current: canAnswer ? { index: mine.length, q: next.q, options: next.options, ...(next.ask ? { ask: next.ask } : {}) } : null,
        answered: focus >= 0 ? s.players.filter((p) => (s.picks[p]?.length ?? 0) > focus) : [],
        scores: Object.fromEntries(s.players.map((p) => [p, scoreOf(s, p, both)])),
        winner: s.winner,
      };
    },
  };
}
