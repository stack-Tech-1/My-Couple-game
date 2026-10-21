import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { DONT_LAUGH } from "@/content/together-quizzes";

/**
 * Don't Laugh: take turns performing a silly prompt. The other person keeps a straight face, then says
 * honestly whether they laughed. A laugh is a point for the performer. Best for together or video calls.
 */
export const DONT_LAUGH_ROUNDS = 6;
export type DontLaughState = {
  players: Players;
  /** Shuffled prompts, server-side only. The round's prompt is deck[cursor]. */
  deck: string[];
  cursor: number;
  first: 0 | 1;
  swapped: boolean;
  history: { performer: PlayerId; prompt: string; laughed: boolean }[];
  winner: PlayerId | "tie" | null;
};
export type DontLaughMove = { type: "swap" } | { type: "verdict"; laughed: boolean };
export type DontLaughView = {
  players: Players;
  me: PlayerId;
  round: number;
  rounds: number;
  performer: PlayerId | null;
  /** Only the performer sees the prompt before the round ends. */
  prompt: string | null;
  canSwap: boolean;
  history: DontLaughState["history"];
  scores: Record<PlayerId, number>;
  winner: PlayerId | "tie" | null;
};

const moveSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("swap") }), z.object({ type: z.literal("verdict"), laughed: z.boolean() })]);

const performerOf = (s: DontLaughState): PlayerId => s.players[(s.first + s.history.length) % 2]!;
const scoresOf = (s: DontLaughState) => Object.fromEntries(s.players.map((p) => [p, s.history.filter((h) => h.performer === p && h.laughed).length])) as Record<PlayerId, number>;

export const dontLaugh: GameLogic<DontLaughState, DontLaughMove, DontLaughView> = {
  id: "dont-laugh",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 8,
  moveSchema,
  rules: {
    summary: "Take turns performing something ridiculous. Your partner must not laugh. Best played together, or on a video call.",
    sections: [
      { title: "Your turn to perform", body: ["Only you see the prompt. Act it out with your whole chest.", "Don't like it? Swap it once per turn."] },
      { title: "Your turn to watch", body: ["Keep a straight face. When they're done, tell the truth: did you laugh? A smile that cracks counts."] },
      { title: "Scoring", body: [`${DONT_LAUGH_ROUNDS} turns, three each. Every laugh is a point for the performer. Most points wins.`] },
    ],
  },

  initialState(seed, players) {
    const rng = makeRng(seed);
    return { players, deck: shuffle(DONT_LAUGH, rng), cursor: 0, first: rng.int(2) as 0 | 1, swapped: false, history: [], winner: null };
  },

  validateMove(s, move, by) {
    if (s.winner) return false;
    const performer = performerOf(s);
    if (move.type === "swap") return by === performer && !s.swapped && s.cursor + 1 < s.deck.length;
    return by !== performer;
  },

  applyMove(s, move) {
    if (move.type === "swap") return { ...s, cursor: s.cursor + 1, swapped: true };
    const history = [...s.history, { performer: performerOf(s), prompt: s.deck[s.cursor]!, laughed: move.laughed }];
    const next: DontLaughState = { ...s, history, cursor: s.cursor + 1, swapped: false };
    if (history.length < DONT_LAUGH_ROUNDS) return next;
    const sc = scoresOf(next);
    const [a, b] = s.players;
    return { ...next, winner: sc[a] === sc[b] ? "tie" : sc[a]! > sc[b]! ? a : b };
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const performer = s.winner ? null : performerOf(s);
    return {
      players: s.players,
      me: player,
      round: s.history.length,
      rounds: DONT_LAUGH_ROUNDS,
      performer,
      prompt: performer === player ? s.deck[s.cursor]! : null,
      canSwap: performer === player && !s.swapped && s.cursor + 1 < s.deck.length,
      history: s.history,
      scores: scoresOf(s),
      winner: s.winner,
    };
  },
};
