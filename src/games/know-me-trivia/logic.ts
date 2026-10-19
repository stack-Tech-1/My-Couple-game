import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";

export const POINTS = 100;
export const STREAK_BONUS = 25;

export const triviaConfigSchema = z.object({ count: z.number().int().min(3).max(8).default(5) });
export type TriviaConfig = z.input<typeof triviaConfigSchema>;

const text = z.string().trim().min(1).max(120);
export const questionSchema = z
  .object({ prompt: text, answer: z.string().trim().min(1).max(60), decoys: z.array(z.string().trim().min(1).max(60)).length(3) })
  .refine((q) => new Set([q.answer, ...q.decoys].map((x) => x.toLowerCase())).size === 4, { message: "Answers must all be different." });
export type Question = z.infer<typeof questionSchema>;

export type Answered = { choice: number; correct: boolean; points: number };

export type TriviaState = {
  players: Players;
  count: number;
  phase: "write" | "answer";
  questions: Record<PlayerId, Question[] | null>;
  /** For each author: per-question option order (indices into [answer, ...decoys]). */
  order: Record<PlayerId, number[][]>;
  /** Keyed by the person answering (about their partner's questions). */
  answers: Record<PlayerId, Answered[]>;
  scores: Record<PlayerId, number>;
  streaks: Record<PlayerId, number>;
  seed: string;
  winner: PlayerId | "tie" | null;
};

export type TriviaMove = { type: "submit"; questions: Question[] } | { type: "answer"; index: number; choice: number };

export type CardForMe = { prompt: string; options: string[]; mine?: Answered; correctIndex?: number };
export type TriviaView = {
  players: Players;
  me: PlayerId;
  count: number;
  phase: "write" | "answer";
  submitted: Record<PlayerId, boolean>;
  /** My own questions (always visible to me). */
  myQuestions: Question[] | null;
  /** My partner's questions, as I'm allowed to see them: correct answer only after I've answered. */
  toAnswer: CardForMe[];
  /** How my partner is doing on MY questions. */
  partnerOnMine: Answered[];
  scores: Record<PlayerId, number>;
  streaks: Record<PlayerId, number>;
  winner: PlayerId | "tie" | null;
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("submit"), questions: z.array(questionSchema).min(3).max(8) }),
  z.object({ type: z.literal("answer"), index: z.number().int().min(0).max(7), choice: z.number().int().min(0).max(3) }),
]);

const optionsOf = (q: Question) => [q.answer, ...q.decoys];
const partnerOf = (s: { players: Players }, p: PlayerId) => (s.players[0] === p ? s.players[1] : s.players[0]);

export const knowMeTrivia: GameLogic<TriviaState, TriviaMove, TriviaView, TriviaConfig> = {
  id: "know-me-trivia",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 10,
  moveSchema,
  configSchema: triviaConfigSchema as unknown as z.ZodType<TriviaConfig>,
  rules: {
    summary: "Write questions about yourself, then answer theirs. Whoever knows the other better wins.",
    sections: [
      { title: "Writing", body: ["Write a few questions about you, or borrow from our bank.", "Add the real answer and three convincing fakes. Make them work for it."] },
      { title: "Answering", body: ["You both answer at the same time. Your partner's answers stay hidden until you've locked yours in."] },
      { title: "Scoring", body: ["100 points per correct answer.", "Get them in a row and each one adds a streak bonus of 25 more."] },
    ],
  },

  initialState(seed, players, config) {
    const { count } = triviaConfigSchema.parse(config);
    return {
      players,
      count,
      phase: "write",
      questions: { [players[0]]: null, [players[1]]: null },
      order: { [players[0]]: [], [players[1]]: [] },
      answers: { [players[0]]: [], [players[1]]: [] },
      scores: { [players[0]]: 0, [players[1]]: 0 },
      streaks: { [players[0]]: 0, [players[1]]: 0 },
      seed,
      winner: null,
    };
  },

  validateMove(s, move, by) {
    if (s.winner) return false;
    if (move.type === "submit") return s.phase === "write" && s.questions[by] === null && move.questions.length === s.count;
    if (s.phase !== "answer") return false;
    const theirs = s.questions[partnerOf(s, by)]!;
    return move.index === s.answers[by]!.length && move.index < theirs.length;
  },

  applyMove(s, move, by) {
    if (move.type === "submit") {
      const questions = { ...s.questions, [by]: move.questions };
      if (!s.players.every((p) => questions[p])) return { ...s, questions };
      // Both in: shuffle each question's options, deterministically.
      const rng = makeRng(s.seed);
      const order: Record<PlayerId, number[][]> = {};
      for (const p of s.players) order[p] = questions[p]!.map(() => shuffle([0, 1, 2, 3], rng));
      return { ...s, questions, order, phase: "answer" };
    }

    const author = partnerOf(s, by);
    const ord = s.order[author]![move.index]!;
    const correct = ord[move.choice] === 0;
    const streak = correct ? s.streaks[by]! + 1 : 0;
    const points = correct ? POINTS + STREAK_BONUS * (streak - 1) : 0;
    const answers = { ...s.answers, [by]: [...s.answers[by]!, { choice: move.choice, correct, points }] };
    const scores = { ...s.scores, [by]: s.scores[by]! + points };
    const streaks = { ...s.streaks, [by]: streak };
    const done = s.players.every((p) => answers[p]!.length === s.count);
    let winner: TriviaState["winner"] = null;
    if (done) {
      const [a, b] = s.players;
      winner = scores[a] === scores[b] ? "tie" : scores[a]! > scores[b]! ? a : b;
    }
    return { ...s, answers, scores, streaks, winner };
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const partner = partnerOf(s, player);
    const theirQs = s.phase === "answer" ? (s.questions[partner] ?? []) : [];
    const myAnswers = s.answers[player] ?? [];
    return {
      players: s.players,
      me: player,
      count: s.count,
      phase: s.phase,
      submitted: { [s.players[0]]: !!s.questions[s.players[0]], [s.players[1]]: !!s.questions[s.players[1]] },
      myQuestions: s.questions[player] ?? null,
      toAnswer: theirQs.map((q, i) => {
        const ord = s.order[partner]![i]!;
        const opts = optionsOf(q);
        const mine = myAnswers[i];
        return {
          prompt: q.prompt,
          options: ord.map((k) => opts[k]!),
          ...(mine || s.winner ? { correctIndex: ord.indexOf(0) } : {}),
          ...(mine ? { mine } : {}),
        };
      }),
      partnerOnMine: s.phase === "answer" ? (s.answers[partner] ?? []) : [],
      scores: s.scores,
      streaks: s.streaks,
      winner: s.winner,
    };
  },
};
