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
/** `twoDice` is the start-screen mode, not a house rule. Absent on older sessions: one die. */
export type LudoRules = z.infer<typeof ludoRulesSchema> & { twoDice?: boolean };
const configSchema = ludoRulesSchema.extend({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional(), twoDice: z.boolean().optional() });
export type LudoConfig = z.input<typeof configSchema>;

export type LudoEvent =
  | { kind: "roll"; by: PlayerId; value: number; pair?: [number, number]; forfeited?: boolean; noMoves?: boolean }
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
  /** One die: the roll. Two dice: the first die still to use (kept for older clients). */
  dice: number | null;
  /** Two dice only: what was rolled, the dice still to use, and whether the turn has earned another roll. */
  pair?: [number, number] | null;
  left?: number[];
  again?: boolean;
  rollId: number;
  /** Sixes in a row; with two dice, double sixes in a row. */
  sixes: number;
  last: LudoEvent | null;
  winner: PlayerId | null;
};

/** With two dice, `use` picks a die (index into `left`) or "both" for the sum. */
export type DieUse = 0 | 1 | "both";
export type LudoMove = { type: "roll" } | { type: "move"; token: number; use?: DieUse };
export type LudoOption = { token: number; use: DieUse };
export type LudoView = Omit<LudoState, "seed" | "rngCursor"> & { me: PlayerId; legal: number[]; options?: LudoOption[] };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("move"), token: z.number().int().min(0).max(3), use: z.union([z.literal(0), z.literal(1), z.literal("both")]).optional() }),
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

/** How far a choice moves, or null if it isn't available. The sum never brings a token out. */
const valueOf = (s: LudoState, use: DieUse): number | null => {
  const left = s.left ?? [];
  if (use === "both") return left.length === 2 ? left[0]! + left[1]! : null;
  return left[use] ?? null;
};
function targetFor(s: LudoState, rel: number, use: DieUse): number | null {
  const v = valueOf(s, use);
  if (v === null || (use === "both" && rel === YARD)) return null;
  return target(s.rules, rel, v);
}

/** Two dice: every (token, die) pair that can move. */
export function legalOptions(s: LudoState): LudoOption[] {
  if (!s.rules.twoDice || s.phase !== "move" || s.winner) return [];
  const mine = s.tokens[s.players[s.turn]!]!;
  const uses: DieUse[] = (s.left ?? []).length === 2 ? [0, 1, "both"] : [0];
  return mine.flatMap((rel, token) => uses.flatMap((use) => (targetFor(s, rel, use) !== null ? [{ token, use }] : [])));
}

export function legalTokens(s: LudoState): number[] {
  if (s.rules.twoDice) return [...new Set(legalOptions(s).map((o) => o.token))];
  if (s.phase !== "move" || s.dice === null || s.winner) return [];
  const mine = s.tokens[s.players[s.turn]!]!;
  return mine.flatMap((rel, i) => (target(s.rules, rel, s.dice!) !== null ? [i] : []));
}

/** A move without `use` (older clients) takes the first die that works for that token. */
const resolveUse = (s: LudoState, token: number, use: DieUse | undefined): DieUse | null => {
  const opts = legalOptions(s).filter((o) => o.token === token);
  if (use === undefined) return opts[0]?.use ?? null;
  return opts.some((o) => o.use === use) ? use : null;
};

/** Moves a token and sends back anyone it lands on (off a safe square). */
function land(s: LudoState, by: PlayerId, token: number, to: number) {
  const seat = s.players.indexOf(by);
  const mine = [...s.tokens[by]!];
  mine[token] = to;
  const tokens: Record<PlayerId, number[]> = { ...s.tokens, [by]: mine };
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
  return { tokens, mine, captured };
}

/** Two dice: the dice are spent (or stuck). Roll again if earned, else pass. */
const endTurn = (s: LudoState): LudoState => ({
  ...s,
  phase: "roll",
  left: [],
  dice: null,
  again: false,
  turn: s.again ? s.turn : nextSeat(s),
  sixes: s.again && s.pair?.[0] === 6 && s.pair[1] === 6 ? s.sixes : 0,
});

export const ludo: GameLogic<LudoState, LudoMove, LudoView, LudoConfig, PlayerList> = {
  id: "ludo",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: 20,
  moveSchema,
  configSchema: configSchema as unknown as z.ZodType<LudoConfig>,
  rematchKeeps: ["twoDice"],
  rules: {
    summary: "Race all four of your tokens around the board and into home before anyone else does.",
    sections: [
      { title: "Getting out", body: ["Roll a six to bring a token out of your yard onto your start square."] },
      {
        title: "Two dice",
        body: [
          "Playing with two dice? Use each die on any token, or add them together for one token.",
          "A six on either die brings a token out, and the other die can move any token, even the one that just came out.",
          "Double six earns another roll. Three double sixes in a row and your turn is over.",
        ],
      },
      { title: "Moving", body: ["Roll, then pick a token to move that many squares. Sixes earn another roll.", "Three sixes in a row and your turn is over. Greed has consequences."] },
      { title: "Capturing", body: ["Land exactly on someone else's token to send it back to their yard, and roll again.", "Start squares and stars are safe: nobody gets captured there."] },
      { title: "Three or four players", body: ["In a friend room, up to four can play, one colour each. Turns go round the board in order."] },
      { title: "Home", body: ["After a lap, turn up your coloured column. You need the exact roll to get home.", "First with all four home wins."] },
    ],
  },

  initialState(seed, players, config) {
    const rules: LudoRules = { ...ludoRulesSchema.parse(config), ...(config.twoDice ? { twoDice: true } : {}) };
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
      ...(rules.twoDice ? { pair: null, left: [], again: false } : {}),
      rollId: 0,
      sixes: 0,
      last: null,
      winner: null,
    };
  },

  validateMove(s, move, by) {
    if (s.winner || s.players[s.turn] !== by) return false;
    if (move.type === "roll") return s.phase === "roll";
    if (s.rules.twoDice) return s.phase === "move" && resolveUse(s, move.token, move.use) !== null;
    return s.phase === "move" && legalTokens(s).includes(move.token);
  },

  applyMove(s, move, by) {
    if (s.rules.twoDice) return applyTwoDice(s, move, by);
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

    const from = s.tokens[by]![move.token]!;
    const to = target(s.rules, from, s.dice!)!;
    const { tokens, mine, captured } = land(s, by, move.token, to);

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
    const mine = s.players[s.turn] === player;
    return { ...rest, me: player, legal: mine ? legalTokens(s) : [], ...(s.rules.twoDice ? { options: mine ? legalOptions(s) : [] } : {}) };
  },
};

function applyTwoDice(s: LudoState, move: LudoMove, by: PlayerId): LudoState {
  if (move.type === "roll") {
    const rng = makeRng(s.seed, s.rngCursor);
    const pair: [number, number] = [rng.int(6) + 1, rng.int(6) + 1];
    const double = pair[0] === 6 && pair[1] === 6;
    const sixes = double ? s.sixes + 1 : 0;
    const base: LudoState = { ...s, rngCursor: rng.cursor(), pair, left: [...pair], dice: pair[0], rollId: s.rollId + 1, again: double, sixes };
    const last = { kind: "roll" as const, by, value: pair[0] + pair[1], pair };
    if (s.rules.threeSixes && sixes === 3) {
      return { ...endTurn({ ...base, again: false }), last: { ...last, forfeited: true } };
    }
    const next: LudoState = { ...base, phase: "move" };
    if (legalOptions(next).length === 0) return { ...endTurn(next), last: { ...last, noMoves: true } };
    return { ...next, last };
  }

  const use = resolveUse(s, move.token, move.use)!;
  const from = s.tokens[by]![move.token]!;
  const to = targetFor(s, from, use)!;
  const { tokens, mine, captured } = land(s, by, move.token, to);
  const left = use === "both" ? [] : (s.left ?? []).filter((_, i) => i !== use);
  const won = mine.every((r) => r === HOME);
  const bonus = s.rules.bonusRolls && (captured.length > 0 || (to === HOME && from !== HOME));
  const last: LudoEvent = { kind: "move", by, token: move.token, from, to, ...(captured.length ? { captured } : {}) };
  if (won) return { ...s, tokens, phase: "roll", left: [], dice: null, again: false, last, winner: by };
  const next: LudoState = { ...s, tokens, left, dice: left[0] ?? null, again: !!s.again || bonus, last };
  return left.length && legalOptions(next).length ? next : endTurn(next);
}
