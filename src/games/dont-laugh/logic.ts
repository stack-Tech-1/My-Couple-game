import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { DONT_LAUGH } from "@/content/together-quizzes";
import { topOf } from "@/games/quiz/logic";

/**
 * Don't Laugh: take turns performing a silly prompt. Everyone else keeps a straight face, then says
 * honestly whether they laughed. Each laugh is a point for the performer. Two players get three
 * turns each; groups get two each. Best together, or on a video call.
 */
export const turnsEach = (players: number) => (players <= 2 ? 3 : 2);
export type DontLaughState = {
  players: PlayerList;
  /** Shuffled prompts, server-side only. The round's prompt is deck[cursor]. */
  deck: string[];
  cursor: number;
  first: number;
  swapped: boolean;
  /** This turn's answers so far, from the people watching. */
  verdicts?: Record<PlayerId, boolean>;
  /** `laughs` counts who cracked (older sessions only have `laughed`). */
  history: { performer: PlayerId; prompt: string; laughed: boolean; laughs?: PlayerId[] }[];
  winner: PlayerId | "tie" | null;
};
export type DontLaughMove = { type: "swap" } | { type: "verdict"; laughed: boolean };
export type DontLaughView = {
  players: PlayerList;
  me: PlayerId;
  round: number;
  rounds: number;
  performer: PlayerId | null;
  /** Only the performer sees the prompt before the turn ends. */
  prompt: string | null;
  canSwap: boolean;
  /** Watchers who have answered this turn (not what they said). */
  answered: PlayerId[];
  /** My answer this turn, if I'm watching and have given it. */
  myVerdict: boolean | null;
  history: { performer: PlayerId; prompt: string; laughs: PlayerId[] }[];
  scores: Record<PlayerId, number>;
  winner: PlayerId | "tie" | null;
};

const moveSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("swap") }), z.object({ type: z.literal("verdict"), laughed: z.boolean() })]);

const roundsOf = (s: DontLaughState) => s.players.length * turnsEach(s.players.length);
const performerOf = (s: DontLaughState): PlayerId => s.players[(s.first + s.history.length) % s.players.length]!;
const laughsOf = (h: DontLaughState["history"][number], players: PlayerList): PlayerId[] =>
  h.laughs ?? (h.laughed ? players.filter((p) => p !== h.performer) : []);
const scoresOf = (s: DontLaughState) =>
  Object.fromEntries(s.players.map((p) => [p, s.history.filter((h) => h.performer === p).reduce((n, h) => n + laughsOf(h, s.players).length, 0)])) as Record<PlayerId, number>;

export const dontLaugh: GameLogic<DontLaughState, DontLaughMove, DontLaughView, Record<string, never>, PlayerList> = {
  id: "dont-laugh",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 8,
  moveSchema,
  rules: {
    summary: "Take turns performing something ridiculous. Everyone else must not laugh. Best played together, or on a video call.",
    sections: [
      { title: "Your turn to perform", body: ["Only you see the prompt. Act it out with your whole chest.", "Don't like it? Swap it once per turn."] },
      { title: "Your turn to watch", body: ["Keep a straight face. When they're done, tell the truth: did you laugh? A smile that cracks counts."] },
      { title: "Scoring", body: ["Every laugh is a point for the performer. Two players get three turns each; groups get two each. Most points wins."] },
    ],
  },

  initialState(seed, players) {
    const rng = makeRng(seed);
    return { players: [...players], deck: shuffle(DONT_LAUGH, rng), cursor: 0, first: rng.int(players.length), swapped: false, verdicts: {}, history: [], winner: null };
  },

  validateMove(s, move, by) {
    if (s.winner || !s.players.includes(by)) return false;
    const performer = performerOf(s);
    if (move.type === "swap") return by === performer && !s.swapped && s.cursor + 1 < s.deck.length;
    return by !== performer && !(by in (s.verdicts ?? {}));
  },

  applyMove(s, move, by) {
    if (move.type === "swap") return { ...s, cursor: s.cursor + 1, swapped: true };
    const performer = performerOf(s);
    const verdicts = { ...(s.verdicts ?? {}), [by]: move.laughed };
    const watchers = s.players.filter((p) => p !== performer);
    if (!watchers.every((w) => w in verdicts)) return { ...s, verdicts };
    const laughs = watchers.filter((w) => verdicts[w]);
    const history = [...s.history, { performer, prompt: s.deck[s.cursor]!, laughed: laughs.length > 0, laughs }];
    const next: DontLaughState = { ...s, history, verdicts: {}, cursor: s.cursor + 1, swapped: false };
    return history.length < roundsOf(s) ? next : { ...next, winner: topOf(scoresOf(next)) };
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const performer = s.winner ? null : performerOf(s);
    const verdicts = s.verdicts ?? {};
    return {
      players: s.players,
      me: player,
      round: s.history.length,
      rounds: roundsOf(s),
      performer,
      prompt: performer === player ? s.deck[s.cursor]! : null,
      canSwap: performer === player && !s.swapped && s.cursor + 1 < s.deck.length,
      answered: Object.keys(verdicts),
      myVerdict: player in verdicts ? verdicts[player]! : null,
      history: s.history.map((h) => ({ performer: h.performer, prompt: h.prompt, laughs: laughsOf(h, s.players) })),
      scores: scoresOf(s),
      winner: s.winner,
    };
  },
};

/** Kept for the two-player tests and rules copy. */
export const DONT_LAUGH_ROUNDS = 6;
