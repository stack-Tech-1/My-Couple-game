import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";

export const MAX_PER_ROUND = 5;
export const MAX_HEARTS = 3;

export const complimentConfigSchema = z.object({
  rounds: z.number().int().min(1).max(5).default(3),
  writeSeconds: z.number().int().min(20).max(120).default(45),
});
export type ComplimentConfig = z.input<typeof complimentConfigSchema>;

export type RoundRecord = { round: number; said: Record<PlayerId, string[]>; hearts: Record<PlayerId, number[]> };
export type ComplimentState = {
  players: Players;
  rounds: number;
  writeMs: number;
  round: number;
  phase: "writing" | "judging";
  deadline: number;
  said: Record<PlayerId, string[]>;
  doneWriting: Record<PlayerId, boolean>;
  /** Keyed by the receiver: hearts awarded to their compliments by the partner. */
  hearts: Record<PlayerId, number[] | null>;
  scores: Record<PlayerId, number>;
  history: RoundRecord[];
  winner: PlayerId | "tie" | null;
};

export type ComplimentMove =
  | { type: "say"; text: string }
  | { type: "done" }
  | { type: "tick" }
  | { type: "judge"; hearts: number[] };

export type ComplimentView = {
  players: Players;
  me: PlayerId;
  round: number;
  rounds: number;
  phase: "writing" | "judging";
  deadline: number;
  writeMs: number;
  mine: string[];
  /** Hidden while writing; shown for judging. */
  theirs: string[] | null;
  theirCount: number;
  iAmDone: boolean;
  partnerDone: boolean;
  iJudged: boolean;
  partnerJudged: boolean;
  scores: Record<PlayerId, number>;
  history: RoundRecord[];
  winner: PlayerId | "tie" | null;
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("say"), text: z.string().trim().min(2).max(140) }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("tick") }),
  z.object({ type: z.literal("judge"), hearts: z.array(z.number().int().min(0).max(MAX_HEARTS)).max(MAX_PER_ROUND) }),
]);

const partnerOf = (s: { players: Players }, p: PlayerId) => (s.players[0] === p ? s.players[1] : s.players[0]);
const empty = <T,>(players: Players, v: T) => ({ [players[0]]: v, [players[1]]: v }) as Record<PlayerId, T>;

function toJudging(s: ComplimentState): ComplimentState {
  return { ...s, phase: "judging" };
}

function settleRound(s: ComplimentState, now: number): ComplimentState {
  const scores = { ...s.scores };
  for (const p of s.players) scores[p] = scores[p]! + (s.hearts[p] ?? []).reduce((a, b) => a + b, 0);
  const history = [...s.history, { round: s.round, said: s.said, hearts: Object.fromEntries(s.players.map((p) => [p, s.hearts[p] ?? []])) }];
  if (s.round >= s.rounds) {
    const [a, b] = s.players;
    return { ...s, scores, history, winner: scores[a] === scores[b] ? "tie" : scores[a]! > scores[b]! ? a : b };
  }
  return {
    ...s,
    scores,
    history,
    round: s.round + 1,
    phase: "writing",
    deadline: now + s.writeMs,
    said: empty(s.players, []),
    doneWriting: empty(s.players, false),
    hearts: empty(s.players, null),
  };
}

export const complimentBattle: GameLogic<ComplimentState, ComplimentMove, ComplimentView, ComplimentConfig> = {
  id: "compliment-battle",
  category: "romantic",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 6,
  moveSchema,
  configSchema: complimentConfigSchema as unknown as z.ZodType<ComplimentConfig>,
  rules: {
    summary: "Timed rounds of compliments. Your partner hands out the hearts. Most hearts wins, and honestly, so do you both.",
    sections: [
      { title: "Writing", body: ["Forty-five seconds a round. Up to five compliments each. Specific beats generic."] },
      { title: "Judging", body: ["Then you read theirs and award up to three hearts each. Your verdicts stay hidden until you've both judged."] },
      { title: "Winning", body: ["Three rounds. Most hearts received takes the crown."] },
    ],
  },

  initialState(_seed, players, config, ctx) {
    const cfg = complimentConfigSchema.parse(config);
    return {
      players,
      rounds: cfg.rounds,
      writeMs: cfg.writeSeconds * 1000,
      round: 1,
      phase: "writing",
      deadline: ctx.now + cfg.writeSeconds * 1000,
      said: empty(players, []),
      doneWriting: empty(players, false),
      hearts: empty(players, null),
      scores: empty(players, 0),
      history: [],
      winner: null,
    };
  },

  validateMove(s, move, by, ctx) {
    if (s.winner) return false;
    switch (move.type) {
      case "say":
        return s.phase === "writing" && !s.doneWriting[by] && s.said[by]!.length < MAX_PER_ROUND && ctx.now <= s.deadline + 1500;
      case "done":
        return s.phase === "writing" && !s.doneWriting[by];
      case "tick":
        return s.phase === "writing" && ctx.now >= s.deadline;
      case "judge": {
        if (s.phase !== "judging") return false;
        const receiver = partnerOf(s, by);
        return s.hearts[receiver] === null && move.hearts.length === s.said[receiver]!.length;
      }
    }
  },

  applyMove(s, move, by, ctx) {
    switch (move.type) {
      case "say":
        return { ...s, said: { ...s.said, [by]: [...s.said[by]!, move.text.trim()] } };
      case "done": {
        const doneWriting = { ...s.doneWriting, [by]: true };
        return s.players.every((p) => doneWriting[p]) ? toJudging({ ...s, doneWriting }) : { ...s, doneWriting };
      }
      case "tick":
        return toJudging({ ...s, doneWriting: empty(s.players, true) });
      case "judge": {
        const receiver = partnerOf(s, by);
        const hearts = { ...s.hearts, [receiver]: move.hearts };
        const next = { ...s, hearts };
        return s.players.every((p) => hearts[p] !== null) ? settleRound(next, ctx.now) : next;
      }
    }
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const partner = partnerOf(s, player);
    return {
      players: s.players,
      me: player,
      round: s.round,
      rounds: s.rounds,
      phase: s.phase,
      deadline: s.deadline,
      writeMs: s.writeMs,
      mine: s.said[player] ?? [],
      theirs: s.phase === "judging" ? (s.said[partner] ?? []) : null,
      theirCount: s.said[partner]?.length ?? 0,
      iAmDone: !!s.doneWriting[player],
      partnerDone: !!s.doneWriting[partner],
      iJudged: s.hearts[partner] !== null,
      partnerJudged: s.hearts[player] !== null,
      scores: s.scores,
      history: s.history,
      winner: s.winner,
    };
  },
};