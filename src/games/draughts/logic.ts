import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

/**
 * International draughts (the 10 by 10 game Nigerians call "draft").
 * Squares are numbered 1 to 50 the standard way: 1 is top left on black's side, 50 bottom right on
 * white's. Men move one step forward, capture forwards and backwards; kings fly. Capturing is
 * compulsory and you must take the most pieces possible.
 */

/** "w"/"b" men, "W"/"B" kings. Index 0 is square 1. */
export type Cell = "w" | "b" | "W" | "B" | null;
export type Color = "w" | "b";
export type EndReason = "no-moves" | "threefold" | "quiet" | "endgame" | "agreed";

export type DraughtsState = {
  players: Players;
  /** Index into players of the person playing white (white moves first). */
  white: 0 | 1;
  board: Cell[];
  turn: Color;
  /** Move list in standard notation ("32-28", "28x19"). */
  notation: string[];
  last: Step | null;
  /** Positions since the last man move or capture, for the threefold rule. */
  seen: string[];
  /** Plies in a row of king moves with no capture (50 = 25 moves each = draw). */
  quiet: number;
  /** Plies played in a lone-king endgame (see ENDGAME_LIMIT). */
  endgame: number;
  drawOffer: PlayerId | null;
  winner: PlayerId | "tie" | null;
  reason: EndReason | null;
};

/** One legal move: the squares the piece stops on (start first), and the squares it captures. */
export type Step = { path: number[]; captured: number[] };

export type DraughtsMove = { kind: "move"; path: number[] } | { kind: "draw"; action: "offer" | "accept" | "decline" };
export type DraughtsConfig = { firstPlayer?: 0 | 1 };

export type DraughtsView = {
  players: Players;
  board: Cell[];
  turn: Color;
  myColor: Color;
  /** Only on your turn. */
  legal: Step[];
  mustCapture: boolean;
  last: Step | null;
  notation: string[];
  pieces: { w: number; b: number };
  drawOffer: PlayerId | null;
  winner: PlayerId | "tie" | null;
  reason: EndReason | null;
};

export const QUIET_LIMIT = 50;

const sqNum = z.number().int().min(1).max(50);
const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), path: z.array(sqNum).min(2).max(25) }),
  z.object({ kind: z.literal("draw"), action: z.enum(["offer", "accept", "decline"]) }),
]) as z.ZodType<DraughtsMove>;
const configSchema = z.object({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional() });

/** Row (0 top) and column (0 left) of square n. */
export function rc(n: number): [number, number] {
  const r = Math.floor((n - 1) / 5);
  const k = (n - 1) % 5;
  return [r, r % 2 === 0 ? 2 * k + 1 : 2 * k];
}
/** Square number at row r, column c, or null if it's a light square or off the board. */
export function sqAt(r: number, c: number): number | null {
  if (r < 0 || r > 9 || c < 0 || c > 9 || (r + c) % 2 === 0) return null;
  return r * 5 + Math.floor(c / 2) + 1;
}

const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

const colorOf = (p: Cell): Color | null => (p ? (p.toLowerCase() as Color) : null);
const isKing = (p: Cell) => p === "W" || p === "B";
const other = (c: Color): Color => (c === "w" ? "b" : "w");
const get = (board: readonly Cell[], n: number) => board[n - 1] ?? null;

export function startBoard(): Cell[] {
  return Array.from({ length: 50 }, (_, i) => (i < 20 ? "b" : i >= 30 ? "w" : null));
}

/** Every capture sequence starting from square `from`. */
function captures(board: readonly Cell[], from: number): Step[] {
  const piece = get(board, from);
  const me = colorOf(piece);
  if (!me) return [];
  const king = isKing(piece);
  const out: Step[] = [];
  // The moving piece has left its start square; captured pieces stay on the board until the end.
  const empty = (n: number) => n === from || get(board, n) === null;

  const walk = (at: number, path: number[], taken: number[]) => {
    let extended = false;
    const [r, c] = rc(at);
    for (const [dr, dc] of DIRS) {
      let i = 1;
      if (king) while (sqAt(r + dr * i, c + dc * i) !== null && empty(sqAt(r + dr * i, c + dc * i)!)) i++;
      const mid = sqAt(r + dr * i, c + dc * i);
      if (mid === null || taken.includes(mid) || colorOf(get(board, mid)) !== other(me)) continue;
      for (let j = i + 1; ; j++) {
        const land = sqAt(r + dr * j, c + dc * j);
        if (land === null || !empty(land)) break;
        extended = true;
        walk(land, [...path, land], [...taken, mid]);
        if (!king) break;
      }
    }
    if (!extended && taken.length) out.push({ path, captured: taken });
  };
  walk(from, [from], []);
  return out;
}

/** Plain (non-capturing) moves from square `from`. */
function slides(board: readonly Cell[], from: number): Step[] {
  const piece = get(board, from);
  const me = colorOf(piece);
  if (!me) return [];
  const [r, c] = rc(from);
  const out: Step[] = [];
  for (const [dr, dc] of DIRS) {
    if (!isKing(piece) && dr !== (me === "w" ? -1 : 1)) continue;
    for (let i = 1; ; i++) {
      const to = sqAt(r + dr * i, c + dc * i);
      if (to === null || get(board, to) !== null) break;
      out.push({ path: [from, to], captured: [] });
      if (!isKing(piece)) break;
    }
  }
  return out;
}

/** All legal moves for `color`: if any capture exists, only the ones taking the most pieces. */
export function legalMoves(board: readonly Cell[], color: Color): Step[] {
  const mine: number[] = [];
  for (let n = 1; n <= 50; n++) if (colorOf(get(board, n)) === color) mine.push(n);
  const caps = mine.flatMap((n) => captures(board, n));
  if (caps.length) {
    const most = Math.max(...caps.map((m) => m.captured.length));
    return caps.filter((m) => m.captured.length === most);
  }
  return mine.flatMap((n) => slides(board, n));
}

export function play(board: readonly Cell[], step: Step): Cell[] {
  const next = [...board];
  const from = step.path[0]!;
  const to = step.path[step.path.length - 1]!;
  let piece = next[from - 1]!;
  next[from - 1] = null;
  for (const n of step.captured) next[n - 1] = null;
  // A man becomes a king only if it finishes its move on the far row.
  const [row] = rc(to);
  if (piece === "w" && row === 0) piece = "W";
  if (piece === "b" && row === 9) piece = "B";
  next[to - 1] = piece;
  return next;
}

const key = (board: readonly Cell[], turn: Color) => board.map((p) => p ?? ".").join("") + turn;
const samePath = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const count = (board: readonly Cell[], c: Color) => board.filter((p) => colorOf(p) === c).length;

/** A lone king against a few pieces is a draw unless the stronger side wins quickly. */
function endgameLimit(board: readonly Cell[]): number | null {
  for (const c of ["w", "b"] as const) {
    const weak = board.filter((p) => colorOf(p) === c);
    const strong = board.filter((p) => colorOf(p) === other(c));
    if (weak.length === 1 && isKing(weak[0]!) && strong.length <= 3 && strong.some(isKing)) return strong.length <= 2 ? 10 : 32;
  }
  return null;
}

const playerOf = (s: DraughtsState, c: Color): PlayerId => s.players[c === "w" ? s.white : s.white === 0 ? 1 : 0];
const myColorOf = (s: DraughtsState, p: PlayerId): Color => (s.players[s.white] === p ? "w" : "b");

export const draughts: GameLogic<DraughtsState, DraughtsMove, DraughtsView, DraughtsConfig> = {
  id: "draughts",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  moveSchema,
  configSchema,
  rules: {
    summary: "Ten by ten draughts with flying kings. Take all their pieces, or leave them with no move.",
    sections: [
      { title: "Moving", body: ["Men move one square diagonally forward. White moves first.", "Tap a piece, then tap where it goes. Only legal moves are shown."] },
      { title: "Capturing", body: ["Jump over a piece next to you onto the empty square beyond. Men can capture backwards too.", "Capturing is compulsory, and you must take the most pieces you can. Keep jumping in one turn while you can."] },
      { title: "Kings", body: ["A man that ends its move on the far row becomes a king.", "Kings fly: they move any distance along a diagonal, and can capture from far away, landing on any empty square past the piece."] },
      { title: "Winning", body: ["You win when your partner has no pieces left, or no legal move.", "Repeating the same position three times, 25 king moves each with no capture, or a lone king holding out long enough are draws."] },
      { title: "Draws and rematches", body: ["Offer a draw any time. You swap colours in the rematch."] },
    ],
  },

  initialState(seed, players, config) {
    const white = config.firstPlayer ?? (makeRng(seed).int(2) as 0 | 1);
    const board = startBoard();
    return { players, white, board, turn: "w", notation: [], last: null, seen: [key(board, "w")], quiet: 0, endgame: 0, drawOffer: null, winner: null, reason: null };
  },

  validateMove(state, move, by) {
    if (state.winner || !state.players.includes(by)) return false;
    if (move.kind === "draw") {
      if (move.action === "offer") return state.drawOffer === null;
      return state.drawOffer !== null && state.drawOffer !== by;
    }
    if (myColorOf(state, by) !== state.turn) return false;
    return legalMoves(state.board, state.turn).some((m) => samePath(m.path, move.path));
  },

  applyMove(state, move, by) {
    if (move.kind === "draw") {
      if (move.action === "offer") return { ...state, drawOffer: by };
      if (move.action === "decline") return { ...state, drawOffer: null };
      return { ...state, drawOffer: null, winner: "tie", reason: "agreed" };
    }
    const step = legalMoves(state.board, state.turn).find((m) => samePath(m.path, move.path))!;
    const moved = get(state.board, step.path[0]!);
    const board = play(state.board, step);
    const turn = other(state.turn);
    const from = step.path[0]!;
    const to = step.path[step.path.length - 1]!;
    const notation = [...state.notation, `${from}${step.captured.length ? "x" : "-"}${to}`];

    const irreversible = step.captured.length > 0 || !isKing(moved);
    const k = key(board, turn);
    const seen = irreversible ? [k] : [...state.seen, k];
    const quiet = irreversible ? 0 : state.quiet + 1;
    const limit = endgameLimit(board);
    const endgame = limit === null || step.captured.length ? 0 : state.endgame + 1;

    let winner: DraughtsState["winner"] = null;
    let reason: EndReason | null = null;
    if (!legalMoves(board, turn).length) {
      winner = playerOf(state, state.turn);
      reason = "no-moves";
    } else if (seen.filter((x) => x === k).length >= 3) reason = "threefold";
    else if (quiet >= QUIET_LIMIT) reason = "quiet";
    else if (limit !== null && endgame >= limit) reason = "endgame";
    if (reason && !winner) winner = "tie";

    return { ...state, board, turn, notation, last: step, seen, quiet, endgame, drawOffer: null, winner, reason };
  },

  isOver(state): Outcome {
    return state.winner ? { over: true, winner: state.winner } : { over: false };
  },

  viewFor(state, player) {
    const myColor = myColorOf(state, player);
    const legal = !state.winner && state.turn === myColor ? legalMoves(state.board, myColor) : [];
    return {
      players: state.players,
      board: state.board,
      turn: state.turn,
      myColor,
      legal,
      mustCapture: legal.some((m) => m.captured.length > 0),
      last: state.last,
      notation: state.notation,
      pieces: { w: count(state.board, "w"), b: count(state.board, "b") },
      drawOffer: state.drawOffer,
      winner: state.winner,
      reason: state.reason,
    };
  },
};
