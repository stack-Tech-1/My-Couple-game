import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";

export const SYMBOLS = ["heart", "moon", "sun", "envelope", "camera", "bolt", "puzzle", "trophy"] as const;
export type Symbol = (typeof SYMBOLS)[number];

export const memoryConfigSchema = z.object({ targetSeconds: z.number().int().min(30).max(300).default(90) });
export type MemoryConfig = z.input<typeof memoryConfigSchema>;

export type MemoryState = {
  players: Players;
  cards: Symbol[];
  matched: boolean[];
  /** Currently face-up, unmatched cards: one mid-turn, or two left showing after a miss. */
  up: number[];
  turn: 0 | 1;
  flips: number;
  misses: number;
  targetMs: number;
  startedAt: number | null;
  deadline: number | null;
  result: "win" | "loss" | null;
};
export type MemoryMove = { type: "flip"; index: number } | { type: "tick" };
export type MemoryView = {
  players: Players;
  me: PlayerId;
  /** null = face down. Symbols only for face-up or matched cards. */
  cards: (Symbol | null)[];
  matched: boolean[];
  up: number[];
  turn: PlayerId;
  flips: number;
  misses: number;
  targetMs: number;
  deadline: number | null;
  result: "win" | "loss" | null;
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flip"), index: z.number().int().min(0).max(15) }),
  z.object({ type: z.literal("tick") }),
]);

export const memoryMatch: GameLogic<MemoryState, MemoryMove, MemoryView, MemoryConfig> = {
  id: "memory-match",
  category: "coop",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 6,
  moveSchema,
  configSchema: memoryConfigSchema as unknown as z.ZodType<MemoryConfig>,
  rules: {
    summary: "One board, two memories. Clear every pair together before the clock runs out.",
    sections: [
      { title: "Taking turns", body: ["Flip two cards. A match stays face up. Either way, it's then your partner's turn.", "Shout out what you remember. That's the whole point."] },
      { title: "The clock", body: ["The timer starts on the first flip. Clear all eight pairs in 90 seconds to win together."] },
    ],
  },

  initialState(seed, players, config) {
    const { targetSeconds } = memoryConfigSchema.parse(config);
    const rng = makeRng(seed);
    return {
      players,
      cards: shuffle([...SYMBOLS, ...SYMBOLS], rng),
      matched: Array<boolean>(16).fill(false),
      up: [],
      turn: rng.int(2) as 0 | 1,
      flips: 0,
      misses: 0,
      targetMs: targetSeconds * 1000,
      startedAt: null,
      deadline: null,
      result: null,
    };
  },

  validateMove(s, move, by, ctx) {
    if (s.result) return false;
    if (move.type === "tick") return s.deadline !== null && ctx.now >= s.deadline;
    if (s.players[s.turn] !== by) return false;
    if (s.deadline !== null && ctx.now > s.deadline) return false;
    if (s.matched[move.index]) return false;
    // Can't flip the card you've just turned over.
    return !(s.up.length === 1 && s.up[0] === move.index);
  },

  applyMove(s, move, _by, ctx) {
    if (move.type === "tick") return { ...s, result: "loss", up: [] };
    const startedAt = s.startedAt ?? ctx.now;
    const deadline = s.deadline ?? ctx.now + s.targetMs;
    // A miss stays visible until the next flip.
    const up = s.up.length === 2 ? [move.index] : [...s.up, move.index];
    const base = { ...s, startedAt, deadline, flips: s.flips + 1 };
    if (up.length === 1) return { ...base, up };

    const [a, b] = up as [number, number];
    const next = s.turn === 0 ? 1 : 0;
    if (s.cards[a] === s.cards[b]) {
      const matched = s.matched.map((m, i) => m || i === a || i === b);
      return { ...base, matched, up: [], turn: next, result: matched.every(Boolean) ? "win" : null };
    }
    return { ...base, up, turn: next, misses: s.misses + 1 };
  },

  isOver(s): Outcome {
    return s.result ? { over: true, coop: s.result } : { over: false };
  },

  viewFor(s, player) {
    return {
      players: s.players,
      me: player,
      cards: s.cards.map((c, i) => (s.matched[i] || s.up.includes(i) || s.result ? c : null)),
      matched: s.matched,
      up: s.up,
      turn: s.players[s.turn],
      flips: s.flips,
      misses: s.misses,
      targetMs: s.targetMs,
      deadline: s.deadline,
      result: s.result,
    };
  },
};
