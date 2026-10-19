import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { DEEP_QUESTIONS } from "@/content/personal";

export type DeepState = {
  players: Players;
  /** Shuffled question order per level. */
  decks: number[][];
  level: number;
  pos: number[];
  answerer: 0 | 1;
  current: { level: number; q: number } | null;
  asked: { level: number; q: number; answerer: PlayerId }[];
  ended: boolean;
};
export type DeepMove = { type: "next" } | { type: "skip" } | { type: "deeper" } | { type: "end" };
export type DeepView = {
  players: Players;
  me: PlayerId;
  level: number;
  levels: { level: string; blurb: string }[];
  card: string | null;
  answerer: PlayerId;
  asked: { level: string; question: string; answerer: PlayerId }[];
  remainingAtLevel: number;
  ended: boolean;
};

const moveSchema = z.object({ type: z.enum(["next", "skip", "deeper", "end"]) });

function draw(s: DeepState): DeepState {
  const deck = s.decks[s.level]!;
  const p = s.pos[s.level]!;
  if (p >= deck.length) return { ...s, current: null };
  return { ...s, current: { level: s.level, q: deck[p]! }, pos: s.pos.map((x, i) => (i === s.level ? x + 1 : x)) };
}

export const deepQuestions: GameLogic<DeepState, DeepMove, DeepView> = {
  id: "deep-questions",
  category: "personal",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  moveSchema,
  rules: {
    summary: "A deck of questions that starts light and goes somewhere real, at whatever pace suits you.",
    sections: [
      { title: "How it works", body: ["One card at a time. Take turns answering: out loud, face to face if you can.", "Skip any card, no explanation needed."] },
      { title: "Going deeper", body: ["When you're both ready, move to the next level. There's no rush and no score."] },
    ],
  },

  initialState(seed, players) {
    const rng = makeRng(seed);
    const decks = DEEP_QUESTIONS.map((l) => shuffle(l.questions.map((_, i) => i), rng));
    return draw({ players, decks, level: 0, pos: decks.map(() => 0), answerer: rng.int(2) as 0 | 1, current: null, asked: [], ended: false });
  },

  validateMove(s, move) {
    if (s.ended) return false;
    if (move.type === "deeper") return s.level < DEEP_QUESTIONS.length - 1;
    return true;
  },

  applyMove(s, move) {
    if (move.type === "end") return { ...s, ended: true };
    if (move.type === "deeper") return draw({ ...s, level: s.level + 1 });
    const asked = move.type === "next" && s.current ? [...s.asked, { ...s.current, answerer: s.players[s.answerer] }] : s.asked;
    const answerer: 0 | 1 = move.type === "next" ? (s.answerer === 0 ? 1 : 0) : s.answerer;
    return draw({ ...s, asked, answerer });
  },

  isOver(s): Outcome {
    return s.ended ? { over: true, complete: true } : { over: false };
  },

  viewFor(s, player) {
    return {
      players: s.players,
      me: player,
      level: s.level,
      levels: DEEP_QUESTIONS.map(({ level, blurb }) => ({ level, blurb })),
      card: s.current ? DEEP_QUESTIONS[s.current.level]!.questions[s.current.q]! : null,
      answerer: s.players[s.answerer],
      asked: s.asked.map((a) => ({ level: DEEP_QUESTIONS[a.level]!.level, question: DEEP_QUESTIONS[a.level]!.questions[a.q]!, answerer: a.answerer })),
      remainingAtLevel: s.decks[s.level]!.length - s.pos[s.level]!,
      ended: s.ended,
    };
  },
};