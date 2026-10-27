import { Chess, type Square } from "chess.js";
import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

/** Piece codes as the board shows them: colour + piece, e.g. "wK", "bp". */
export type Piece = `${"w" | "b"}${"p" | "n" | "b" | "r" | "q" | "k"}`;
export type Promo = "q" | "r" | "b" | "n";
export type EndReason = "checkmate" | "stalemate" | "insufficient" | "threefold" | "fifty" | "agreed";

export type ChessState = {
  players: Players;
  /** Index into players of the person playing white. */
  white: 0 | 1;
  /** Every move so far, in long algebraic form ("e2e4", "e7e8q"). Replayed to rebuild the position. */
  moves: string[];
  /** Standard notation for the move list ("Nf3", "O-O", "Qxf7#"). */
  san: string[];
  drawOffer: PlayerId | null;
  winner: PlayerId | "tie" | null;
  reason: EndReason | null;
};

export type ChessMove =
  | { kind: "move"; from: string; to: string; promotion?: Promo }
  | { kind: "draw"; action: "offer" | "accept" | "decline" };

export type ChessConfig = { firstPlayer?: 0 | 1 };

export type LegalMove = { from: string; to: string; promotion: boolean };

export type ChessView = {
  players: Players;
  /** 64 squares, a8 first, then b8 … h1 (as white sees the board top to bottom). */
  board: (Piece | null)[];
  turn: "w" | "b";
  myColor: "w" | "b";
  /** Only on your turn: every legal move, promotions listed once (you pick the piece after). */
  legal: LegalMove[];
  last: { from: string; to: string } | null;
  check: string | null;
  san: string[];
  captured: { w: Piece[]; b: Piece[] };
  drawOffer: PlayerId | null;
  winner: PlayerId | "tie" | null;
  reason: EndReason | null;
};

const square = z.string().regex(/^[a-h][1-8]$/);
const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), from: square, to: square, promotion: z.enum(["q", "r", "b", "n"]).optional() }),
  z.object({ kind: z.literal("draw"), action: z.enum(["offer", "accept", "decline"]) }),
]) as z.ZodType<ChessMove>;
const configSchema = z.object({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional() });

export const FILES = "abcdefgh";
/** Square name for board index i (a8 = 0, h1 = 63). */
export const squareAt = (i: number) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;

/** Rebuild the game from its move list (keeps repetition history, which a single position can't). */
export function replay(moves: readonly string[]): Chess {
  const g = new Chess();
  for (const m of moves) g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return g;
}

const colorOf = (s: ChessState, p: PlayerId): "w" | "b" => (s.players[s.white] === p ? "w" : "b");
const playerOf = (s: ChessState, c: "w" | "b"): PlayerId => s.players[c === "w" ? s.white : s.white === 0 ? 1 : 0];

function ending(g: Chess): EndReason | null {
  if (g.isCheckmate()) return "checkmate";
  if (g.isStalemate()) return "stalemate";
  if (g.isInsufficientMaterial()) return "insufficient";
  if (g.isThreefoldRepetition()) return "threefold";
  if (g.isDrawByFiftyMoves()) return "fifty";
  return null;
}

export const chess: GameLogic<ChessState, ChessMove, ChessView, ChessConfig> = {
  id: "chess",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  moveSchema,
  configSchema,
  rules: {
    summary: "Classic chess. Checkmate your partner's king to win.",
    sections: [
      { title: "On your turn", body: ["Tap one of your pieces to see where it can go, then tap a square.", "Only legal moves are shown, so you can't make an illegal one by accident."] },
      { title: "Winning", body: ["Checkmate wins: their king is in check and has no way out.", "Stalemate, three repeats of a position, 50 moves with no capture or pawn move, or too few pieces to mate are all draws."] },
      { title: "Special moves", body: ["Castling, en passant and promotion all work. When a pawn reaches the far side, you choose its new piece."] },
      { title: "Draws and resigning", body: ["Offer a draw any time. Your partner can accept or play on.", "Resigning gives your partner the win."] },
      { title: "Rematches", body: ["You swap colours in the rematch, so everyone gets to go first."] },
    ],
  },

  initialState(seed, players, config) {
    const white = config.firstPlayer ?? (makeRng(seed).int(2) as 0 | 1);
    return { players, white, moves: [], san: [], drawOffer: null, winner: null, reason: null };
  },

  validateMove(state, move, by) {
    if (state.winner || !state.players.includes(by)) return false;
    if (move.kind === "draw") {
      if (move.action === "offer") return state.drawOffer === null;
      return state.drawOffer !== null && state.drawOffer !== by;
    }
    const g = replay(state.moves);
    if (g.turn() !== colorOf(state, by)) return false;
    return g.moves({ square: move.from as Square, verbose: true }).some((m) => m.to === move.to && (!m.promotion || !!move.promotion));
  },

  applyMove(state, move, by) {
    if (move.kind === "draw") {
      if (move.action === "offer") return { ...state, drawOffer: by };
      if (move.action === "decline") return { ...state, drawOffer: null };
      return { ...state, drawOffer: null, winner: "tie", reason: "agreed" };
    }
    const g = replay(state.moves);
    const m = g.move({ from: move.from, to: move.to, promotion: move.promotion });
    const reason = ending(g);
    return {
      ...state,
      moves: [...state.moves, m.lan],
      san: [...state.san, m.san],
      // Playing a move answers any draw offer with "no thanks".
      drawOffer: null,
      reason,
      winner: reason === "checkmate" ? playerOf(state, m.color) : reason ? "tie" : null,
    };
  },

  isOver(state): Outcome {
    return state.winner ? { over: true, winner: state.winner } : { over: false };
  },

  // Nothing hidden in chess: the view adds what the board needs to draw itself.
  viewFor(state, player) {
    const g = replay(state.moves);
    const myColor = colorOf(state, player);
    const board = g.board().flat().map((sq) => (sq ? (`${sq.color}${sq.type}` as Piece) : null));
    const hist = g.history({ verbose: true });
    // Pieces each colour has lost, in the order they were taken.
    const captured = { w: [] as Piece[], b: [] as Piece[] };
    for (const m of hist) {
      if (!m.captured) continue;
      const lost = m.color === "w" ? "b" : "w";
      captured[lost].push(`${lost}${m.captured}` as Piece);
    }
    const legal: LegalMove[] = [];
    if (!state.winner && g.turn() === myColor) {
      const keys = new Set<string>();
      for (const m of g.moves({ verbose: true })) {
        const key = m.from + m.to;
        if (keys.has(key)) continue;
        keys.add(key);
        legal.push({ from: m.from, to: m.to, promotion: !!m.promotion });
      }
    }
    const lastMove = hist[hist.length - 1];
    let check: string | null = null;
    if (g.inCheck()) {
      const i = board.findIndex((p) => p === `${g.turn()}k`);
      check = i >= 0 ? squareAt(i) : null;
    }
    return {
      players: state.players,
      board,
      turn: g.turn(),
      myColor,
      legal,
      last: lastMove ? { from: lastMove.from, to: lastMove.to } : null,
      check,
      san: state.san,
      captured,
      drawOffer: state.drawOffer,
      winner: state.winner,
      reason: state.reason,
    };
  },
};
