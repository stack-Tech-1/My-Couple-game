import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

/**
 * Token progress is relative to its owner: -1 yard, 0..50 main track, 51..55 home
 * column, 56 home. The board has four colours (corners), clockwise, starting on track
 * squares 0, 13, 26 and 39. Two players sit opposite (colours 0 and 2); three or four
 * take the colours in order.
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
  players: PlayerList;
  /** Board colour of each seat. Absent on older (two-player) sessions: [0, 2]. */
  colours?: number[];
  seed: string;
  rngCursor: number;
  rules: LudoRules;
  tokens: Record<PlayerId, number[]>;
  turn: number;
  firstTurn: number;
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

/** Where a colour's track starts, and a token's absolute track square. */
export const colourStart = (colour: number) => colour * 13;
export const absoluteFor = (colour: number, rel: number) => (colourStart(colour) + rel) % 52;
/** Two-player seats (0 and 1 sit on colours 0 and 2). */
export const absolute = (seat: 0 | 1, rel: number) => (START[seat] + rel) % 52;
export const coloursFor = (n: number) => (n === 2 ? [0, 2] : Array.from({ length: n }, (_, i) => i));
export const colourOf = (s: Pick<LudoState, "colours" | "players">, seat: number) => s.colours?.[seat] ?? coloursFor(s.players.length)[seat]!;
const nextSeat = (s: LudoState) => (s.turn + 1) % s.players.length;

export function target(rules: LudoRules, rel: number, dice: number): number | null {
  if (rel === HOME) return null;
  if (rel === YARD) return dice === 6 || (rules.exitOnOne && dice === 1) ? 0 : null;
  const t = rel + dice;
  if (t > HOME) return rules.exactHome ? null : HOME;
  return t;
}

export function legalTokens(s: LudoState): number[] {
  if (s.phase !== "move" || s.dice === null || s.winner) return [];
  const mine = s.tokens[s.players[s.turn]!]!;
  return mine.flatMap((rel, i) => (target(s.rules, rel, s.dice!) !== null ? [i] : []));
}

export const ludo: GameLogic<LudoState, LudoMove, LudoView, LudoConfig, PlayerList> = {
  id: "ludo",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: 20,
  moveSchema,
  configSchema: configSchema as unknown as z.ZodType<LudoConfig>,
  rules: {
    summary: "Race all four of your tokens around the board and into home before anyone else does.",
    sections: [
      { title: "Getting out", body: ["Roll a six to bring a token out of your yard onto your start square."] },
      { title: "Moving", body: ["Roll, then pick a token to move that many squares. Sixes earn another roll.", "Three sixes in a row and your turn is over. Greed has consequences."] },
      { title: "Capturing", body: ["Land exactly on someone else's token to send it back to their yard, and roll again.", "Start squares and stars are safe: nobody gets captured there."] },
      { title: "Three or four players", body: ["In a friend room, up to four can play, one colour each. Turns go round the board in order."] },
      { title: "Home", body: ["After a lap, turn up your coloured column. You need the exact roll to get home.", "First with all four home wins."] },
    ],
  },

  initialState(seed, players, config) {
    const rules = ludoRulesSchema.parse(config);
    const rng = makeRng(seed);
    const first = players.length === 2 ? (config.firstPlayer ?? rng.int(2)) : rng.int(players.length);
    return {
      players: [...players],
      ...(players.length === 2 ? {} : { colours: coloursFor(players.length) }),
      seed,
      rngCursor: rng.cursor(),
      rules,
      tokens: Object.fromEntries(players.map((p) => [p, [YARD, YARD, YARD, YARD]])),
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
        return { ...base, phase: "roll", sixes: 0, turn: nextSeat(s), last: { kind: "roll", by, value, forfeited: true } };
      }
      const next: LudoState = { ...base, phase: "move", sixes };
      if (legalTokens(next).length === 0) {
        // Nothing to move. A six still earns the re-roll; otherwise the turn passes.
        return { ...next, phase: "roll", turn: value === 6 ? s.turn : nextSeat(s), sixes: value === 6 ? sixes : 0, last: { kind: "roll", by, value, noMoves: true } };
      }
      return { ...next, last: { kind: "roll", by, value } };
    }

    const seat = s.players.indexOf(by);
    const from = s.tokens[by]![move.token]!;
    const to = target(s.rules, from, s.dice!)!;
    const mine = [...s.tokens[by]!];
    mine[move.token] = to;
    const tokens: Record<PlayerId, number[]> = { ...s.tokens, [by]: mine };

    // Landing on anyone else's token (off a safe square) sends it back to their yard.
    const captured: { owner: PlayerId; token: number }[] = [];
    if (to <= LAST_TRACK) {
      const sq = absoluteFor(colourOf(s, seat), to);
      if (!SAFE.has(sq)) {
        s.players.forEach((owner, oSeat) => {
          if (owner === by) return;
          const theirs = [...s.tokens[owner]!];
          theirs.forEach((rel, i) => {
            if (rel >= 0 && rel <= LAST_TRACK && absoluteFor(colourOf(s, oSeat), rel) === sq) {
              theirs[i] = YARD;
              captured.push({ owner, token: i });
            }
          });
          tokens[owner] = theirs;
        });
      }
    }

    const won = mine.every((r) => r === HOME);
    const bonus = s.rules.bonusRolls && (captured.length > 0 || (to === HOME && from !== HOME));
    const again = !won && (s.dice === 6 || bonus);
    return {
      ...s,
      tokens,
      phase: "roll",
      turn: again ? s.turn : nextSeat(s),
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
