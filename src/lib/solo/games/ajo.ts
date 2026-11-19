import { makeRng } from "@/games/_engine/rng";

/**
 * Ajo: a 4×4 board of naira. Swipe to slide every tile; two matching tiles merge into the next
 * one up, from ₦5 to ₦1,000 notes and beyond. Pure and seeded.
 */
export const N = 4;
/** Tile levels, 1-based: level 1 is ₦5. */
export const NOTES = ["₦5", "₦10", "₦20", "₦50", "₦100", "₦200", "₦500", "₦1,000", "₦2k", "₦5k", "₦10k", "₦20k", "₦50k", "₦100k", "₦1m"];
export const noteOf = (level: number) => NOTES[level - 1] ?? `L${level}`;
/** Points for making a tile: doubles each level, like the notes roughly do. */
export const pointsOf = (level: number) => 2 ** level;

/** The last game's top note and moves, kept for the finish screen (which only gets the score). */
export type AjoLast = { best: number; moves: number };
export const AJO_LAST = "amah:ajo:last";

export type Dir = "up" | "down" | "left" | "right";
export type AjoState = { tiles: number[]; score: number; cursor: number; best: number; moves: number; won: boolean };

function spawn(seed: string, s: AjoState): AjoState {
  const empty = s.tiles.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return s;
  const rng = makeRng(seed, s.cursor);
  const at = empty[rng.int(empty.length)]!;
  const level = rng.next() < 0.9 ? 1 : 2;
  const tiles = [...s.tiles];
  tiles[at] = level;
  return { ...s, tiles, cursor: rng.cursor() };
}

export function newAjo(seed: string): AjoState {
  return spawn(seed, spawn(seed, { tiles: Array(N * N).fill(0), score: 0, cursor: 0, best: 0, moves: 0, won: false }));
}

/** Slide one line toward its start; returns the new line and points made. */
function slideLine(line: number[]): { line: number[]; points: number; best: number; merged: number[] } {
  const vals = line.filter((v) => v);
  const out: number[] = [];
  const merged: number[] = [];
  let points = 0;
  let best = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      const lv = vals[i]! + 1;
      merged.push(out.length);
      out.push(lv);
      points += pointsOf(lv);
      best = Math.max(best, lv);
      i++;
    } else out.push(vals[i]!);
  }
  while (out.length < N) out.push(0);
  return { line: out, points, best, merged };
}

const index = (dir: Dir, line: number, k: number) => {
  switch (dir) {
    case "left":
      return line * N + k;
    case "right":
      return line * N + (N - 1 - k);
    case "up":
      return k * N + line;
    case "down":
      return (N - 1 - k) * N + line;
  }
};

/**
 * One swipe. Null when nothing would move. `mergedAt` is where merges landed and `spawnedAt` where
 * the new note appeared (for the stamp and the pop-in on screen).
 */
export function move(seed: string, s: AjoState, dir: Dir): { state: AjoState; points: number; merged: number; mergedAt: number[]; spawnedAt: number | null } | null {
  const tiles = [...s.tiles];
  const mergedAt: number[] = [];
  let points = 0;
  let best = 0;
  let changed = false;
  for (let line = 0; line < N; line++) {
    const idx = Array.from({ length: N }, (_, k) => index(dir, line, k));
    const before = idx.map((i) => tiles[i]!);
    const r = slideLine(before);
    r.line.forEach((v, k) => {
      if (tiles[idx[k]!] !== v) changed = true;
      tiles[idx[k]!] = v;
    });
    for (const k of r.merged) mergedAt.push(idx[k]!);
    points += r.points;
    best = Math.max(best, r.best);
  }
  if (!changed) return null;
  const top = Math.max(s.best, best, ...tiles);
  const next = spawn(seed, { ...s, tiles, score: s.score + points, best: top, moves: s.moves + 1, won: s.won || top >= 8 });
  const spawnedAt = next.tiles.findIndex((v, i) => v && !tiles[i]);
  return { state: next, points, merged: best, mergedAt, spawnedAt: spawnedAt >= 0 ? spawnedAt : null };
}

export function canMove(s: AjoState): boolean {
  if (s.tiles.some((v) => !v)) return true;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = s.tiles[r * N + c];
      if (c < N - 1 && v === s.tiles[r * N + c + 1]) return true;
      if (r < N - 1 && v === s.tiles[(r + 1) * N + c]) return true;
    }
  return false;
}
