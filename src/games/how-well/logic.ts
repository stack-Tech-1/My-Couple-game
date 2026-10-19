import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { HOW_WELL } from "@/content/personal";

export const howWellConfigSchema = z.object({ count: z.number().int().min(4).max(10).default(6) });
export type HowWellConfig = z.input<typeof howWellConfigSchema>;

export type Pick = { self: number; guess: number };
export type HowWellState = { players: Players; qs: number[]; picks: Record<PlayerId, Pick[]>; winner: PlayerId | "tie" | null };
export type HowWellMove = { index: number; self: number; guess: number };
export type HowWellView = {
  players: Players;
  me: PlayerId;
  questions: { q: string; options: string[] }[];
  mine: Pick[];
  partnerProgress: number;
  /** Revealed only when both have finished. */
  theirs: Pick[] | null;
  scores: Record<PlayerId, number> | null;
  winner: PlayerId | "tie" | null;
};

const moveSchema = z.object({ index: z.number().int().min(0).max(9), self: z.number().int().min(0).max(3), guess: z.number().int().min(0).max(3) });

/** How many of `guesser`'s guesses matched `subject`'s own answers. */
export const score = (guesser: Pick[], subject: Pick[]) => guesser.filter((p, i) => subject[i] && p.guess === subject[i]!.self).length;

export const howWell: GameLogic<HowWellState, HowWellMove, HowWellView, HowWellConfig> = {
  id: "how-well",
  category: "personal",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 10,
  moveSchema,
  configSchema: howWellConfigSchema as unknown as z.ZodType<HowWellConfig>,
  rules: {
    summary: "Answer each question for yourself, then guess what your partner said. Reveal side by side at the end.",
    sections: [
      { title: "Two taps per question", body: ["First, your honest answer. Then your guess for your partner.", "Nothing is shown until you've both finished."] },
      { title: "Scoring", body: ["One point for every guess that matches your partner's own answer."] },
    ],
  },

  initialState(seed, players, config) {
    const { count } = howWellConfigSchema.parse(config);
    const qs = shuffle(HOW_WELL.map((_, i) => i), makeRng(seed)).slice(0, count);
    return { players, qs, picks: { [players[0]]: [], [players[1]]: [] }, winner: null };
  },

  validateMove(s, move, by) {
    return !s.winner && move.index === s.picks[by]!.length && move.index < s.qs.length;
  },

  applyMove(s, move, by) {
    const picks = { ...s.picks, [by]: [...s.picks[by]!, { self: move.self, guess: move.guess }] };
    const [a, b] = s.players;
    if (picks[a]!.length < s.qs.length || picks[b]!.length < s.qs.length) return { ...s, picks };
    const sa = score(picks[a]!, picks[b]!);
    const sb = score(picks[b]!, picks[a]!);
    return { ...s, picks, winner: sa === sb ? "tie" : sa > sb ? a : b };
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const partner = s.players[0] === player ? s.players[1] : s.players[0];
    const done = !!s.winner;
    return {
      players: s.players,
      me: player,
      questions: s.qs.map((i) => ({ q: HOW_WELL[i]!.q, options: [...HOW_WELL[i]!.options] })),
      mine: s.picks[player] ?? [],
      partnerProgress: s.picks[partner]?.length ?? 0,
      theirs: done ? s.picks[partner]! : null,
      scores: done ? { [player]: score(s.picks[player]!, s.picks[partner]!), [partner]: score(s.picks[partner]!, s.picks[player]!) } : null,
      winner: s.winner,
    };
  },
};