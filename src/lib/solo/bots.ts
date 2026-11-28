import type { AnyGameLogic, MoveContext, PlayerId } from "@/games/_engine/types";
import { legalMoves, type Cell as DCell, type DraughtsState } from "@/games/draughts/logic";
import type { TttState } from "@/games/tic-tac-toe/logic";
import type { C4State } from "@/games/connect-four/logic";
import type { AyoState } from "@/games/ayo/logic";
import { HOME, YARD, type LudoState } from "@/games/ludo/logic";
import type { WhotState } from "@/games/whot/logic";
import { boxAm, boxesBy, type BoxMove, type BoxState } from "@/games/box-am/logic";
import type { BotLevel } from "./catalog";

/**
 * Computer opponents for the free board and card games. They reuse each game's own rules: a bot
 * only ever picks a move the rules accept. Easy plays at random; Steady thinks one move ahead;
 * Boss searches deeper on the games where everything is on the table (no peeking at hidden cards).
 */
type Any = unknown;
type Base = "whot" | "ludo" | "ayo" | "draughts" | "tic-tac-toe" | "connect-four" | "box-am";

const SHAPE_NAMES = ["circle", "triangle", "cross", "square", "star"] as const;

/** Whose move it is, or null if anyone can send it (X and O's "next round"). */
function turnOf(base: Base, s: Any): PlayerId | null {
  switch (base) {
    case "tic-tac-toe": {
      const t = s as TttState;
      return t.roundResult ? null : t.players[t.turn];
    }
    case "draughts": {
      const d = s as DraughtsState;
      return d.players[d.turn === "w" ? d.white : ((1 - d.white) as 0 | 1)];
    }
    default: {
      const g = s as { players: readonly PlayerId[]; turn: number };
      return g.players[g.turn] ?? null;
    }
  }
}

/** Every move the bot might make here (the rules then weed out the illegal ones). */
function candidates(base: Base, s: Any, bot: PlayerId): unknown[] {
  switch (base) {
    case "tic-tac-toe":
      return (s as TttState).roundResult ? [{ kind: "next" }] : Array.from({ length: 9 }, (_, cell) => ({ kind: "mark", cell }));
    case "connect-four":
      return Array.from({ length: 7 }, (_, col) => ({ col }));
    case "box-am": {
      const b = s as BoxState;
      return [...b.h.flatMap((o, i) => (o < 0 ? [{ kind: "line", dir: "h", i }] : [])), ...b.v.flatMap((o, i) => (o < 0 ? [{ kind: "line", dir: "v", i }] : []))];
    }
    case "ayo":
      return Array.from({ length: 6 }, (_, pit) => ({ pit }));
    case "draughts": {
      const d = s as DraughtsState;
      if (d.drawOffer && d.drawOffer !== bot) return [{ kind: "draw", action: "decline" }];
      const color = d.players.indexOf(bot) === d.white ? "w" : "b";
      return legalMoves(d.board as readonly DCell[], color).map((m) => ({ kind: "move", path: m.path }));
    }
    case "ludo": {
      const l = s as LudoState;
      if (l.phase === "roll") return [{ type: "roll" }];
      const out: unknown[] = [];
      for (let token = 0; token < 4; token++) for (const use of [undefined, 0, 1, "both"] as const) out.push(use === undefined ? { type: "move", token } : { type: "move", token, use });
      return out;
    }
    case "whot": {
      const w = s as WhotState;
      const hand = w.hands[bot] ?? [];
      const out: unknown[] = [{ type: "draw" }];
      for (const card of hand) {
        const lastCard = hand.length === 2 ? [false, true] : [false];
        const shapes = card.shape === "whot" ? SHAPE_NAMES : [undefined];
        for (const shape of shapes) for (const lc of lastCard) out.push({ type: "play", cardId: card.id, ...(shape ? { shape } : {}), ...(lc ? { lastCard: true } : {}) });
      }
      return out;
    }
  }
}

function legal(logic: AnyGameLogic, base: Base, s: Any, who: PlayerId, ctx: MoveContext): unknown[] {
  return candidates(base, s, who).filter((m) => {
    const p = logic.moveSchema.safeParse(m);
    if (!p.success) return false;
    try {
      return logic.validateMove(s, p.data, who, ctx);
    } catch {
      return false;
    }
  });
}

const other = (s: Any, me: PlayerId) => (s as { players: readonly PlayerId[] }).players.find((p) => p !== me)!;

/** How good this position is for `bot` (higher is better). */
function evaluate(base: Base, logic: AnyGameLogic, s: Any, bot: PlayerId): number {
  const out = logic.isOver(s);
  if (out.over && "winner" in out) return out.winner === bot ? 1e6 : out.winner === "tie" ? 0 : -1e6;
  const opp = other(s, bot);
  switch (base) {
    case "tic-tac-toe": {
      const t = s as TttState;
      if (t.roundResult) return t.roundResult.winner === null ? 0 : t.players[t.roundResult.winner] === bot ? 1000 : -1000;
      return 0;
    }
    case "box-am": {
      const b = s as BoxState;
      return (b.score[b.players.indexOf(bot)] ?? 0) - (b.score[b.players.indexOf(opp)] ?? 0);
    }
    case "connect-four":
      return c4Score(s as C4State, (s as C4State).players.indexOf(bot) + 1);
    case "ayo": {
      const a = s as AyoState;
      return (a.stores[bot] ?? 0) - (a.stores[opp] ?? 0);
    }
    case "draughts": {
      const d = s as DraughtsState;
      const mine = d.players.indexOf(bot) === d.white ? "w" : "b";
      let v = 0;
      for (const c of d.board) {
        if (!c) continue;
        const val = c === "W" || c === "B" ? 3 : 1;
        v += c.toLowerCase() === mine ? val : -val;
      }
      return v;
    }
    case "ludo": {
      const l = s as LudoState;
      const prog = (r: number) => (r === YARD ? -12 : r === HOME ? 70 : r);
      const mine = (l.tokens[bot] ?? []).reduce((a, r) => a + prog(r), 0);
      const theirs = (l.tokens[opp] ?? []).reduce((a, r) => a + prog(r), 0);
      return mine - theirs * 0.9;
    }
    case "whot": {
      const w = s as WhotState;
      const myHand = w.hands[bot] ?? [];
      const theirs = w.hands[opp]?.length ?? 0;
      const turnIsTheirs = w.players[w.turn] === opp;
      // Fewer cards is better; keep a Whot card for the end; punish them with picks when we can.
      return -myHand.length * 10 + theirs * 3 + myHand.filter((c) => c.shape === "whot").length * 4 + (turnIsTheirs ? w.pendingPick * 6 : -w.pendingPick * 6);
    }
  }
}

/** Connect Four: score every window of four. */
function c4Score(s: C4State, me: number): number {
  const R = 6;
  const C = 7;
  const at = (r: number, c: number) => s.board[r * C + c];
  let v = 0;
  const win = (cells: number[]) => {
    const mine = cells.filter((x) => x === me).length;
    const theirs = cells.filter((x) => x && x !== me).length;
    if (mine && theirs) return 0;
    return mine === 3 ? 5 : mine === 2 ? 2 : theirs === 3 ? -6 : theirs === 2 ? -2 : 0;
  };
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      if (c + 3 < C) v += win([0, 1, 2, 3].map((k) => at(r, c + k) as number));
      if (r + 3 < R) v += win([0, 1, 2, 3].map((k) => at(r + k, c) as number));
      if (r + 3 < R && c + 3 < C) v += win([0, 1, 2, 3].map((k) => at(r + k, c + k) as number));
      if (r + 3 < R && c - 3 >= 0) v += win([0, 1, 2, 3].map((k) => at(r + k, c - k) as number));
    }
  // The middle column is worth more.
  for (let r = 0; r < R; r++) if (at(r, 3) === me) v += 3;
  return v;
}

function search(logic: AnyGameLogic, base: Base, s: Any, bot: PlayerId, depth: number, alpha: number, beta: number, ctx: MoveContext): number {
  const who = turnOf(base, s);
  if (depth === 0 || logic.isOver(s).over || !who || (base === "tic-tac-toe" && (s as TttState).roundResult)) return evaluate(base, logic, s, bot);
  const moves = legal(logic, base, s, who, ctx);
  if (!moves.length) return evaluate(base, logic, s, bot);
  const maximizing = who === bot;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const next = logic.applyMove(s, logic.moveSchema.parse(m), who, ctx);
    const v = search(logic, base, next, bot, depth - 1, alpha, beta, ctx);
    if (maximizing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

const DEPTH: Record<Base, Record<Exclude<BotLevel, "easy">, number>> = {
  "tic-tac-toe": { medium: 2, hard: 9 },
  "connect-four": { medium: 2, hard: 5 },
  ayo: { medium: 1, hard: 4 },
  draughts: { medium: 1, hard: 3 },
  // Luck and hidden cards: one move ahead is all a fair bot can do.
  ludo: { medium: 1, hard: 1 },
  // Box Am has its own rules of thumb (boxBot); these aren't used.
  "box-am": { medium: 1, hard: 1 },
  whot: { medium: 1, hard: 1 },
};

/**
 * The bot's move, or null when it isn't the bot's turn (or it has none). `rand` is injectable so
 * tests are repeatable.
 */
export function botMove(base: Base, logic: AnyGameLogic, s: Any, bot: PlayerId, level: BotLevel, ctx: MoveContext, rand: () => number = Math.random): unknown | null {
  if (logic.isOver(s).over) return null;
  const who = turnOf(base, s);
  // A draw offer is answered whenever it comes.
  const offered = base === "draughts" && (s as DraughtsState).drawOffer && (s as DraughtsState).drawOffer !== bot;
  if (who !== bot && who !== null && !offered) return null;
  const moves = legal(logic, base, s, bot, ctx);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0]!;
  if (base === "box-am") return boxBot(s as BoxState, moves as BoxMove[], level, rand);
  if (level === "easy") {
    // Even the easy bot finishes a round and doesn't just draw cards forever.
    const sensible = base === "whot" && moves.length > 1 ? moves.filter((m) => (m as { type: string }).type !== "draw") : moves;
    return sensible[Math.floor(rand() * sensible.length)]!;
  }
  const depth = DEPTH[base][level];
  let best: unknown[] = [];
  let bestV = -Infinity;
  for (const m of moves) {
    const next = logic.applyMove(s, logic.moveSchema.parse(m), bot, ctx);
    const v = search(logic, base, next, bot, depth - 1, -Infinity, Infinity, ctx) + rand() * 0.01;
    if (v > bestV) {
      bestV = v;
      best = [m];
    } else if (v === bestV) best.push(m);
  }
  return best[Math.floor(rand() * best.length)] ?? moves[0]!;
}

export const BOT_ID = "amah-bot";
export type BotBase = Base;

/** Lines drawn around box (r, c). */
function sidesDrawn(b: Pick<BoxState, "n" | "h" | "v">, r: number, c: number): number {
  const n = b.n;
  return [b.h[r * n + c]!, b.h[(r + 1) * n + c]!, b.v[r * (n + 1) + c]!, b.v[r * (n + 1) + c + 1]!].filter((o) => o >= 0).length;
}

/** Boxes the next player could take in a row after this line (they close each one they can). */
function giveaway(b: BoxState, m: BoxMove): number {
  let cur = boxAm.applyMove(b, m, b.players[b.turn]!, { now: 0 });
  let taken = 0;
  for (let guard = 0; guard < 80 && !cur.winner; guard++) {
    const who = cur.players[cur.turn]!;
    const lines = candidates("box-am", cur, who) as BoxMove[];
    const closer = lines.find((l) => boxesBy(cur.n, l.dir, l.i).some(([r, c]) => sidesDrawn(cur, r, c) === 3));
    if (!closer) break;
    const before = cur.score.reduce((a, x) => a + x, 0);
    cur = boxAm.applyMove(cur, closer, who, { now: 0 });
    taken += cur.score.reduce((a, x) => a + x, 0) - before;
  }
  return taken;
}

/**
 * Box Am bot. Easy: often grabs a free box, otherwise anything. Steady: takes every free box and
 * never draws a third side if it can help it. Boss: the same, and when it must give boxes away it
 * gives the fewest.
 */
function boxBot(b: BoxState, moves: BoxMove[], level: BotLevel, rand: () => number): BoxMove {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const closes = moves.filter((m) => boxesBy(b.n, m.dir, m.i).some(([r, c]) => sidesDrawn(b, r, c) === 3));
  if (level === "easy") return closes.length && rand() < 0.6 ? pick(closes) : pick(moves);
  if (closes.length) return pick(closes);
  const safe = moves.filter((m) => boxesBy(b.n, m.dir, m.i).every(([r, c]) => sidesDrawn(b, r, c) < 2));
  if (safe.length) return pick(safe);
  if (level === "medium") return pick(moves);
  let best: BoxMove[] = [];
  let least = Infinity;
  for (const m of moves) {
    const g = giveaway(b, m);
    if (g < least) [least, best] = [g, [m]];
    else if (g === least) best.push(m);
  }
  return pick(best);
}
