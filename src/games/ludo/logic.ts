import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

/**
 * Token progress is relative to its owner: -1 yard, 0..50 main track, 51..55 home
 * column, 56 home. Seat 0 starts at track square 0, seat 1 at 26 (opposite corners).
 */
export const YARD = -1;
export const LAST_TRACK = 50;
export const HOME = 56;
export const START: [number, number] = [0, 26];
/** Start squares and stars. Nobody can be captured here. */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const ludoRulesSchema = z.object({
  /** Roll needed to leave the yard. */
  exitOnOne: z.boolean().default(false),
  /** Home must be reached with an exact roll. */
  exactHome: z.boolean().default(true),
  /** Capturing, or getting a token home, earns another roll. */
  bonusRolls: z.boolean().default(true),
  /** A third six in a row forfeits the turn. */
  threeSixes: z.boolean().default(true),
});
export type LudoRules = z.infer<typeof ludoRulesSchema>;
const configSchema = ludoRulesSchema.extend({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional() });
export type LudoConfig = z.input<typeof configSchema>;

export type LudoEvent =
  | { kind: "roll"; by: PlayerId; value: number; forfeited?: boolean; noMoves?: boolean }
  | { kind: "move"; by: PlayerId; token: number; from: number; to: number; captured?: { owner: PlayerId; token: number }[] };

export type LudoState = {
  players: Players;
  seed: string;
  rngCursor: number;
  rules: LudoRules;
  tokens: Record<PlayerId, number[]>;
  turn: 0 | 1;
  firstTurn: 0 | 1;
  phase: "roll" | "move";
  dice: number | null;
  rollId: number;
  sixes: number;
  last: LudoEvent | null;
  winner: PlayerId | null;
};

export type LudoMove = { type: "roll" } | { type: "move"; token: number };
export type LudoView = Omit<LudoState, "seed" | "rngCursor"> & { me: PlayerId; legal: number[] };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("move"), token: z.number().int().min(0).max(3) }),
]);

const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);
export const absolute = (seat: 0 | 1, rel: number) => (START[seat] + rel) % 52;
const seatOf = (s: LudoState, p: PlayerId): 0 | 1 => (s.players[0] === p ? 0 : 1);

export function target(rules: LudoRules, rel: number, dice: number): number | null {
  if (rel === HOME) return null;
  if (rel === YARD) return dice === 6 || (rules.exitOnOne && dice === 1) ? 0 : null;
  const t = rel + dice;
  if (t > HOME) return rules.exactHome ? null : HOME;
  return t;
}

export function legalTokens(s: LudoState): number[] {
  if (s.phase !== "move" || s.dice === null || s.winner) return [];
  const mine = s.tokens[s.players[s.turn]]!;
  return mine.flatMap((rel, i) => (target(s.rules, rel, s.dice!) !== null ? [i] : []));
}

export const ludo: GameLogic<LudoState, LudoMove, LudoView, LudoConfig> = {
  id: "ludo",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  moveSchema,
  configSchema: configSchema as unknown as z.ZodType<LudoConfig>,
  rules: {
    summary: "Race all four of your tokens around the board and into home before your partner does.",
    sections: [
      { title: "Getting out", body: ["Roll a six to bring a token out of your yard onto your start square."] },
      { title: "Moving", body: ["Roll, then pick a token to move that many squares. Sixes earn another roll.", "Three sixes in a row and your turn is over. Greed has consequences."] },
      { title: "Capturing", body: ["Land exactly on your partner's token to send it back to their yard, and roll again.", "Start squares and stars are safe: nobody gets captured there."] },
      { title: "Home", body: ["After a lap, turn up your coloured column. You need the exact roll to get home.", "First with all four home wins."] },
    ],
  },

  initialState(seed, players, config) {
    const rules = ludoRulesSchema.parse(config);
    const rng = makeRng(seed);
    const first = config.firstPlayer ?? (rng.int(2) as 0 | 1);
    return {
      players,
      seed,
      rngCursor: rng.cursor(),
      rules,
      tokens: { [players[0]]: [YARD, YARD, YARD, YARD], [players[1]]: [YARD, YARD, YARD, YARD] },
      turn: first,
      firstTurn: first,
      phase: "roll",
      dice: null,
      rollId: 0,
      sixes: 0,
      last: null,
      winner: null,
    };
  },

  validateMove(s, move, by) {
    if (s.winner || s.players[s.turn] !== by) return false;
    if (move.type === "roll") return s.phase === "roll";
    return s.phase === "move" && legalTokens(s).includes(move.token);
  },

  applyMove(s, move, by) {
    if (move.type === "roll") {
      const rng = makeRng(s.seed, s.rngCursor);
      const value = rng.int(6) + 1;
      const sixes = value === 6 ? s.sixes + 1 : 0;
      const base = { ...s, rngCursor: rng.cursor(), dice: value, rollId: s.rollId + 1 };
      if (s.rules.threeSixes && sixes === 3) {
        return { ...base, phase: "roll", sixes: 0, turn: other(s.turn), last: { kind: "roll", by, value, forfeited: true } };
      }
      const next: LudoState = { ...base, phase: "move", sixes };
      if (legalTokens(next).length === 0) {
        // Nothing to move. A six still earns the re-roll; otherwise the turn passes.
        return { ...next, phase: "roll", turn: value === 6 ? s.turn : other(s.turn), sixes: value === 6 ? sixes : 0, last: { kind: "roll", by, value, noMoves: true } };
      }
      return { ...next, last: { kind: "roll", by, value } };
    }

    const seat = seatOf(s, by);
    const opp = s.players[other(seat)];
    const from = s.tokens[by]![move.token]!;
    const to = target(s.rules, from, s.dice!)!;
    const mine = [...s.tokens[by]!];
    mine[move.token] = to;
    const theirs = [...s.tokens[opp]!];

    const captured: { owner: PlayerId; token: number }[] = [];
    if (to <= LAST_TRACK) {
      const sq = absolute(seat, to);
      if (!SAFE.has(sq)) {
        theirs.forEach((rel, i) => {
          if (rel >= 0 && rel <= LAST_TRACK && absolute(other(seat), rel) === sq) {
            theirs[i] = YARD;
            captured.push({ owner: opp, token: i });
          }
        });
      }
    }

    const tokens = { ...s.tokens, [by]: mine, [opp]: theirs };
    const won = mine.every((r) => r === HOME);
    const bonus = s.rules.bonusRolls && (captured.length > 0 || (to === HOME && from !== HOME));
    const again = !won && (s.dice === 6 || bonus);
    return {
      ...s,
      tokens,
      phase: "roll",
      turn: again ? s.turn : other(s.turn),
      sixes: again && s.dice === 6 ? s.sixes : 0,
      last: { kind: "move", by, token: move.token, from, to, ...(captured.length ? { captured } : {}) },
      winner: won ? by : null,
    };
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  // The seed and cursor stay server-side: with them a client could predict every future roll.
  viewFor(s, player) {
    const { seed: _seed, rngCursor: _cursor, ...rest } = s;
    return { ...rest, me: player, legal: s.players[s.turn] === player ? legalTokens(s) : [] };
  },
};
