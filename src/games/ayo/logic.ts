import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

/**
 * Ayo (Ayò Olópón), played with the common Nigerian capture rules.
 * Pits 0..5 belong to seat 0, 6..11 to seat 1. Sowing runs counter-clockwise (index + 1).
 */
export const PITS = 12;
export const START_SEEDS = 4;
export const TOTAL = PITS * START_SEEDS;
export const TO_WIN = TOTAL / 2 + 1; // 25
export const STALL_LIMIT = 80; // moves without a capture before the board is split

export const ayoRulesSchema = z.object({
  /** Capturing every seed on your partner's side is allowed (otherwise it captures nothing). */
  grandSlam: z.boolean().default(false),
});
export type AyoRules = z.infer<typeof ayoRulesSchema>;
const configSchema = ayoRulesSchema.extend({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional() });
export type AyoConfig = z.input<typeof configSchema>;

export type AyoLast = { by: PlayerId; from: number; sown: number[]; captured: number[]; seedsCaptured: number };

export type AyoState = {
  players: Players;
  rules: AyoRules;
  pits: number[];
  stores: Record<PlayerId, number>;
  turn: 0 | 1;
  firstTurn: 0 | 1;
  sinceCapture: number;
  last: AyoLast | null;
  ended: "score" | "starved" | "stalled" | null;
  winner: PlayerId | "tie" | null;
};

/** `pit` is 0..5, counted from the mover's own left. */
export type AyoMove = { pit: number };
export type AyoView = AyoState & { me: PlayerId; mySeat: 0 | 1; legal: number[] };

const moveSchema = z.object({ pit: z.number().int().min(0).max(5) });
const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);
const rowOf = (i: number): 0 | 1 => (i < 6 ? 0 : 1);
const sideSum = (pits: number[], seat: 0 | 1) => pits.slice(seat * 6, seat * 6 + 6).reduce((a, b) => a + b, 0);

/** Pure sowing + capture for one move. */
export function sow(pits: readonly number[], from: number, rules: AyoRules) {
  const next = [...pits];
  let seeds = next[from]!;
  next[from] = 0;
  const sown: number[] = [];
  let pos = from;
  while (seeds > 0) {
    pos = (pos + 1) % PITS;
    if (pos === from) continue; // a lap skips the pit you emptied
    next[pos]!++;
    sown.push(pos);
    seeds--;
  }

  const mover = rowOf(from);
  const captured: number[] = [];
  let p = pos;
  while (rowOf(p) !== mover && (next[p] === 2 || next[p] === 3)) {
    captured.push(p);
    p = (p - 1 + PITS) % PITS;
  }

  const oppSeat = other(mover);
  const took = captured.reduce((a, i) => a + next[i]!, 0);
  const grandSlam = took > 0 && took === sideSum(next, oppSeat);
  if (grandSlam && !rules.grandSlam) return { pits: next, sown, captured: [], seedsCaptured: 0 };
  for (const i of captured) next[i] = 0;
  return { pits: next, sown, captured, seedsCaptured: took };
}

export function legalPits(s: AyoState): number[] {
  if (s.winner) return [];
  const seat = s.turn;
  const base = seat * 6;
  const opp = other(seat);
  const candidates = [0, 1, 2, 3, 4, 5].filter((i) => s.pits[base + i]! > 0);
  // Must-feed: if your partner has nothing, you must play a move that gives them seeds.
  if (sideSum(s.pits, opp) === 0) {
    const feeding = candidates.filter((i) => sideSum(sow(s.pits, base + i, s.rules).pits, opp) > 0);
    if (feeding.length) return feeding;
    return [];
  }
  return candidates;
}

function finish(s: AyoState): AyoState {
  const [a, b] = s.players;
  const sa = s.stores[a]!;
  const sb = s.stores[b]!;
  if (sa >= TO_WIN) return { ...s, ended: s.ended ?? "score", winner: a };
  if (sb >= TO_WIN) return { ...s, ended: s.ended ?? "score", winner: b };
  if (s.ended) return { ...s, winner: sa === sb ? "tie" : sa > sb ? a : b };
  return s;
}

/** Ends the game by giving each player the seeds on their own side. */
function splitBoard(s: AyoState, why: "starved" | "stalled"): AyoState {
  const [a, b] = s.players;
  return finish({
    ...s,
    stores: { [a]: s.stores[a]! + sideSum(s.pits, 0), [b]: s.stores[b]! + sideSum(s.pits, 1) },
    pits: Array<number>(PITS).fill(0),
    ended: why,
  });
}

export const ayo: GameLogic<AyoState, AyoMove, AyoView, AyoConfig> = {
  id: "ayo",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 12,
  moveSchema,
  configSchema: configSchema as unknown as z.ZodType<AyoConfig>,
  rules: {
    summary: "Sow seeds around the board and capture from your partner's side. First to 25 seeds wins.",
    sections: [
      { title: "Sowing", body: ["Pick up every seed from one of your six pits and drop them one at a time, counter-clockwise.", "If you have twelve or more, you'll lap the board, skipping the pit you started from."] },
      { title: "Capturing", body: ["If your last seed lands on your partner's side and makes that pit 2 or 3, you take them.", "Then look at the pit before it: if it's also 2 or 3 on their side, take that too, and so on."] },
      { title: "Fair play", body: ["If your partner's side is empty, you must make a move that gives them seeds.", "A move that would capture every seed on their side captures nothing instead."] },
      { title: "The end", body: ["25 seeds wins. 24 each is a tie.", "If nobody can feed anyone, or there's been a long stretch with no captures, each player keeps the seeds on their own side."] },
    ],
  },

  initialState(seed, players, config) {
    const rules = ayoRulesSchema.parse(config);
    const first = config.firstPlayer ?? (makeRng(seed).int(2) as 0 | 1);
    return {
      players,
      rules,
      pits: Array<number>(PITS).fill(START_SEEDS),
      stores: { [players[0]]: 0, [players[1]]: 0 },
      turn: first,
      firstTurn: first,
      sinceCapture: 0,
      last: null,
      ended: null,
      winner: null,
    };
  },

  validateMove(s, move, by) {
    return !s.winner && s.players[s.turn] === by && legalPits(s).includes(move.pit);
  },

  applyMove(s, move, by) {
    const from = s.turn * 6 + move.pit;
    const r = sow(s.pits, from, s.rules);
    let next: AyoState = {
      ...s,
      pits: r.pits,
      stores: { ...s.stores, [by]: s.stores[by]! + r.seedsCaptured },
      turn: other(s.turn),
      sinceCapture: r.seedsCaptured > 0 ? 0 : s.sinceCapture + 1,
      last: { by, from, sown: r.sown, captured: r.captured, seedsCaptured: r.seedsCaptured },
    };
    next = finish(next);
    if (next.winner) return next;
    if (next.sinceCapture >= STALL_LIMIT) return splitBoard(next, "stalled");
    // The next player can't move (empty side, or nothing that feeds): split the board.
    if (legalPits(next).length === 0) return splitBoard(next, "starved");
    return next;
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const mySeat: 0 | 1 = s.players[0] === player ? 0 : 1;
    return { ...s, me: player, mySeat, legal: s.players[s.turn] === player ? legalPits(s) : [] };
  },
};
