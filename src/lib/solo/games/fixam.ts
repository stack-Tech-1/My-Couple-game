import { makeRng } from "@/games/_engine/rng";

/**
 * Fix Am: a photo cut into n×n tiles with one gap. Slide tiles into the gap until the picture is
 * whole. The shuffle is made by sliding from the solved picture, so it can always be solved.
 */
export type FixState = { n: number; tiles: number[]; moves: number };

/** The last puzzle's moves and time, kept for the finish screen (which only gets the score). */
export type FixLast = { moves: number; seconds: number };
export const FIX_LAST = "amah:fixam:last";

/** Tile values 0..n²-1; the last value is the gap. */
export const gapOf = (s: FixState) => s.tiles.indexOf(s.n * s.n - 1);

const neighbours = (i: number, n: number) => {
  const r = Math.floor(i / n);
  const c = i % n;
  return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((x) => x >= 0);
};

export function newFix(seed: string, n: number): FixState {
  const tiles = Array.from({ length: n * n }, (_, i) => i);
  const rng = makeRng(seed);
  let gap = n * n - 1;
  let prev = -1;
  for (let k = 0; k < n * n * 40; k++) {
    const opts = neighbours(gap, n).filter((x) => x !== prev);
    const pick = opts[rng.int(opts.length)]!;
    tiles[gap] = tiles[pick]!;
    tiles[pick] = n * n - 1;
    prev = gap;
    gap = pick;
  }
  // Never hand over an already-solved board.
  if (tiles.every((v, i) => v === i)) return newFix(`${seed}+`, n);
  return { n, tiles, moves: 0 };
}

export const canSlide = (s: FixState, i: number) => neighbours(gapOf(s), s.n).includes(i);

export function slide(s: FixState, i: number): FixState | null {
  if (!canSlide(s, i)) return null;
  const g = gapOf(s);
  const tiles = [...s.tiles];
  tiles[g] = tiles[i]!;
  tiles[i] = s.n * s.n - 1;
  return { ...s, tiles, moves: s.moves + 1 };
}

export const solved = (s: FixState) => s.tiles.every((v, i) => v === i);

/** Score: bigger boards pay more; every move and second costs a little. */
export function fixScore(n: number, moves: number, seconds: number): number {
  const base = n === 3 ? 3000 : n === 4 ? 6000 : 10000;
  return Math.max(100, Math.round(base - moves * (n === 3 ? 20 : n === 4 ? 10 : 6) - seconds * 3));
}
