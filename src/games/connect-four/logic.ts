import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

export const COLS = 7;
export const ROWS = 6;

/** Board is row-major from the TOP: index = row * COLS + col. 0 empty, 1 = players[0], 2 = players[1]. */
export type Cell = 0 | 1 | 2;

export type C4State = {
  players: Players;
  board: Cell[];
  turn: 0 | 1;
  moves: number;
  last: { col: number; row: number } | null;
  winLine: number[] | null;
  winner: PlayerId | "tie" | null;
};

export type C4Move = { col: number };
export type C4Config = { firstPlayer?: 0 | 1 };
export type C4View = C4State & { you: 1 | 2 };

const moveSchema = z.object({ col: z.number().int().min(0).max(COLS - 1) });
const configSchema = z.object({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional() });

export const idx = (row: number, col: number) => row * COLS + col;

export function dropRow(board: readonly Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (board[idx(r, col)] === 0) return r;
  return -1;
}

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** Returns the winning cells through (row, col), or null. Lines longer than four are fully included. */
export function findLine(board: readonly Cell[], row: number, col: number): number[] | null {
  const who = board[idx(row, col)];
  if (!who) return null;
  for (const [dr, dc] of DIRS) {
    const line = [idx(row, col)];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[idx(r, c)] === who) {
        line.push(idx(r, c));
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line.sort((a, b) => a - b);
  }
  return null;
}

export const connectFour: GameLogic<C4State, C4Move, C4View, C4Config> = {
  id: "connect-four",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 6,
  moveSchema,
  configSchema,
  rules: {
    summary: "Take turns dropping discs into the frame. First to line up four in a row, in any direction, wins.",
    sections: [
      { title: "On your turn", body: ["Pick a column and drop one disc. It falls to the lowest empty space.", "You can't pass, and you can't drop into a full column."] },
      { title: "Winning", body: ["Four of your discs in a line: across, up and down, or diagonally.", "If the frame fills up with no line of four, it's a tie."] },
      { title: "Rematches", body: ["Whoever went second goes first in the rematch. Fair's fair."] },
    ],
  },

  initialState(seed, players, config) {
    const first = config.firstPlayer ?? (makeRng(seed).int(2) as 0 | 1);
    return { players, board: Array<Cell>(ROWS * COLS).fill(0), turn: first, moves: 0, last: null, winLine: null, winner: null };
  },

  validateMove(state, move, by) {
    if (state.winner) return false;
    if (state.players[state.turn] !== by) return false;
    return dropRow(state.board, move.col) !== -1;
  },

  applyMove(state, move) {
    const row = dropRow(state.board, move.col);
    const board = [...state.board];
    const piece: Cell = state.turn === 0 ? 1 : 2;
    board[idx(row, move.col)] = piece;
    const winLine = findLine(board, row, move.col);
    const moves = state.moves + 1;
    const winner = winLine ? state.players[state.turn] : moves === ROWS * COLS ? "tie" : null;
    return {
      ...state,
      board,
      moves,
      last: { col: move.col, row },
      winLine,
      winner,
      turn: winner ? state.turn : state.turn === 0 ? 1 : 0,
    };
  },

  isOver(state): Outcome {
    return state.winner ? { over: true, winner: state.winner } : { over: false };
  },

  // No hidden information in Connect Four; the view just tells you which colour you are.
  viewFor(state, player) {
    return { ...state, you: state.players[0] === player ? 1 : 2 };
  },
};