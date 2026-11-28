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

/** A new note in an empty square. `fixed` places it (the first game's lesson). */
function spawn(seed: string, s: AjoState, fixed?: { at: number; level: number }): AjoState {
  const empty = s.tiles.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return s;
  if (fixed && !s.tiles[fixed.at]) {
    const tiles = [...s.tiles];
    tiles[fixed.at] = fixed.level;
    return { ...s, tiles };
  }
  const rng = makeRng(seed, s.cursor);
  const at = empty[rng.int(empty.length)]!;
  const level = rng.next() < 0.9 ? 1 : 2;
  const tiles = [...s.tiles];
  tiles[at] = level;
  return { ...s, tiles, cursor: rng.cursor() };
}

/**
 * The first game teaches: three ₦5 notes on a set board, and three moves with the coach. Each
 * step says which way to swipe and where the next note lands, so the coach's words come true.
 */
export const LESSON: readonly { dir: Dir; spawn: { at: number; level: number } }[] = [
  { dir: "left", spawn: { at: 12, level: 1 } },
  { dir: "up", spawn: { at: 3, level: 1 } },
  { dir: "up", spawn: { at: 14, level: 1 } },
];
export function newAjoLesson(): AjoState {
  const tiles = Array(N * N).fill(0);
  tiles[0] = 1;
  tiles[2] = 1;
  tiles[11] = 1;
  return { tiles, score: 0, cursor: 0, best: 1, moves: 0, won: false };
}

export function newAjo(seed: string): AjoState {
  return spawn(seed, spawn(seed, { tiles: Array(N * N).fill(0), score: 0, cursor: 0, best: 0, moves: 0, won: false }));
}

/**
 * Slide one line toward its start; returns the new line and points made, and where each note
 * went (`from` and `to` are positions along the line), so the screen can show it gliding.
 */
function slideLine(line: number[]): { line: number[]; points: number; best: number; merged: number[]; went: { from: number; to: number; joined: boolean }[] } {
  const vals = line.map((v, k) => ({ v, k })).filter((x) => x.v);
  const out: number[] = [];
  const merged: number[] = [];
  const went: { from: number; to: number; joined: boolean }[] = [];
  let points = 0;
  let best = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i]!.v === vals[i + 1]?.v) {
      const lv = vals[i]!.v + 1;
      merged.push(out.length);
      went.push({ from: vals[i]!.k, to: out.length, joined: true }, { from: vals[i + 1]!.k, to: out.length, joined: true });
      out.push(lv);
      points += pointsOf(lv);
      best = Math.max(best, lv);
      i++;
    } else {
      went.push({ from: vals[i]!.k, to: out.length, joined: false });
      out.push(vals[i]!.v);
    }
  }
  while (out.length < N) out.push(0);
  return { line: out, points, best, merged, went };
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
export function move(
  seed: string,
  s: AjoState,
  dir: Dir,
  fixed?: { at: number; level: number },
): { state: AjoState; points: number; merged: number; mergedAt: number[]; spawnedAt: number | null; went: { from: number; to: number; joined: boolean }[] } | null {
  const tiles = [...s.tiles];
  const mergedAt: number[] = [];
  const went: { from: number; to: number; joined: boolean }[] = [];
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
    for (const w of r.went) went.push({ from: idx[w.from]!, to: idx[w.to]!, joined: w.joined });
    points += r.points;
    best = Math.max(best, r.best);
  }
  if (!changed) return null;
  const top = Math.max(s.best, best, ...tiles);
  const next = spawn(seed, { ...s, tiles, score: s.score + points, best: top, moves: s.moves + 1, won: s.won || top >= 8 }, fixed);
  const spawnedAt = next.tiles.findIndex((v, i) => v && !tiles[i]);
  return { state: next, points, merged: best, mergedAt, spawnedAt: spawnedAt >= 0 ? spawnedAt : null, went };
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
