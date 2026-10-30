import { makeRng } from "@/games/_engine/rng";

/**
 * Blend Am: an 8×8 board, three pieces offered at a time. Fill a whole row or column to clear it.
 * Game over when none of the pieces left can fit. Pure: the same seed always deals the same pieces.
 */
export const SIZE = 8;

export type Cell = readonly [number, number];
export type Piece = { id: number; cells: Cell[]; color: number };

/** Every shape, as cells from its top-left. */
const SHAPES: Cell[][] = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 1], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 0]],
  [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [1, 1]],
  [[0, 1], [1, 0]],
];
export const COLORS = ["#2a4a8a", "#e8563a", "#3f8a5c", "#e9b13c", "#7a3a6a", "#1d6870"];

export type BlendState = {
  board: number[]; // 0 empty, else colour index + 1
  tray: (Piece | null)[];
  cursor: number; // RNG position, so a saved game deals the same next pieces
  score: number;
  combo: number;
  placed: number;
  lines: number;
  nextId: number;
};

function deal(seed: string, s: BlendState): BlendState {
  const rng = makeRng(seed, s.cursor);
  const tray = [0, 1, 2].map((i) => {
    const shape = SHAPES[rng.int(SHAPES.length)]!;
    return { id: s.nextId + i, cells: shape, color: rng.int(COLORS.length) } as Piece;
  });
  return { ...s, tray, cursor: rng.cursor(), nextId: s.nextId + 3 };
}

export function newBlend(seed: string): BlendState {
  return deal(seed, { board: Array(SIZE * SIZE).fill(0), tray: [], cursor: 0, score: 0, combo: 0, placed: 0, lines: 0, nextId: 1 });
}

export function fits(board: number[], piece: Piece, r: number, c: number): boolean {
  return piece.cells.every(([dr, dc]) => {
    const rr = r + dr;
    const cc = c + dc;
    return rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE && board[rr * SIZE + cc] === 0;
  });
}

export function canFitAnywhere(board: number[], piece: Piece): boolean {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (fits(board, piece, r, c)) return true;
  return false;
}

export function isOver(s: BlendState): boolean {
  return s.tray.every((p) => !p || !canFitAnywhere(s.board, p));
}

/** Rows and columns that would be full with this board. */
export function fullLines(board: number[]): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    if ([...Array(SIZE).keys()].every((j) => board[i * SIZE + j] !== 0)) rows.push(i);
    if ([...Array(SIZE).keys()].every((j) => board[j * SIZE + i] !== 0)) cols.push(i);
  }
  return { rows, cols };
}

export type PlaceResult = { state: BlendState; cleared: number; points: number; clearedCells: number[] };

/** Put the tray piece at `slot` with its top-left on (r, c). Null if it doesn't fit. */
export function place(seed: string, s: BlendState, slot: number, r: number, c: number): PlaceResult | null {
  const piece = s.tray[slot];
  if (!piece || !fits(s.board, piece, r, c)) return null;
  const board = [...s.board];
  for (const [dr, dc] of piece.cells) board[(r + dr) * SIZE + (c + dc)] = piece.color + 1;
  const { rows, cols } = fullLines(board);
  const clearedCells = new Set<number>();
  for (const row of rows) for (let j = 0; j < SIZE; j++) clearedCells.add(row * SIZE + j);
  for (const col of cols) for (let j = 0; j < SIZE; j++) clearedCells.add(j * SIZE + col);
  for (const i of clearedCells) board[i] = 0;
  const cleared = rows.length + cols.length;
  const combo = cleared ? s.combo + 1 : 0;
  // A point per cell placed; clearing pays more for several lines at once, and more for a streak.
  const points = piece.cells.length + (cleared ? cleared * cleared * 10 * combo : 0);
  const tray = s.tray.map((p, i) => (i === slot ? null : p));
  let next: BlendState = { ...s, board, tray, score: s.score + points, combo, placed: s.placed + 1, lines: s.lines + cleared };
  if (tray.every((p) => !p)) next = deal(seed, next);
  return { state: next, cleared, points, clearedCells: [...clearedCells] };
}
