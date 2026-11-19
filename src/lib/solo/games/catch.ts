import { makeRng } from "@/games/_engine/rng";

/**
 * Catch Am: puff-puff and akara fall from the market stalls. Catch them in your basket; dodge the
 * peppers. Three good catches in a row start a combo that multiplies your points. A pepper in the
 * basket costs one of three lives. It gets faster and hotter as you go.
 *
 * Pure and seeded, stepped on a fixed clock. The basket's position is an input to each step.
 */
export const W = 358;
export const H = 560;
export const RIM_Y = 470;
export const BASKET_HALF = 58;
export const STEP = 1 / 60;
export const START_LIVES = 3;

export type ItemKind = "puff" | "akara" | "gold" | "pepper";
export const POINTS: Record<ItemKind, number> = { puff: 10, akara: 15, gold: 30, pepper: 0 };

export type Item = { id: number; kind: ItemKind; x: number; y: number; vy: number; rot: number; spin: number; sway: number };
export type CatchState = {
  items: Item[];
  basket: number;
  lives: number;
  score: number;
  combo: number;
  caught: number;
  time: number;
  nextSpawn: number;
  nextId: number;
  cursor: number;
  over: boolean;
};
export type CatchEvents = { caught: { kind: ItemKind; x: number; points: number }[]; missed: number; burned: boolean };

/** The last game's numbers, kept for the finish screen (which only gets the score). */
export type CatchLast = { caught: number; gold: number; bestCombo: number; seed: string };
export const CATCH_LAST = "amah:catch:last";

export const multiplier =(combo: number) => Math.min(5, 1 + Math.floor(combo / 3));

/** How hard it is after `t` seconds: gap between items, fall speed, and the share of peppers. */
export function pace(t: number) {
  const k = Math.min(1, t / 120);
  return { gap: 0.95 - 0.6 * k, speed: 150 + 260 * k, pepper: 0.1 + 0.2 * k };
}

export function newCatch(seed: string): CatchState {
  return { items: [], basket: W / 2, lives: START_LIVES, score: 0, combo: 0, caught: 0, time: 0, nextSpawn: 0.6, nextId: 1, cursor: makeRng(seed).cursor(), over: false };
}

export function stepCatch(seed: string, s0: CatchState, basketX: number): { state: CatchState; ev: CatchEvents } {
  const ev: CatchEvents = { caught: [], missed: 0, burned: false };
  if (s0.over) return { state: s0, ev };
  const s: CatchState = { ...s0, basket: Math.max(BASKET_HALF, Math.min(W - BASKET_HALF, basketX)), time: s0.time + STEP };
  const rng = makeRng(seed, s.cursor);
  const p = pace(s.time);

  let items = s.items;
  if (s.time >= s.nextSpawn) {
    const r = rng.next();
    const kind: ItemKind = r < p.pepper ? "pepper" : r < p.pepper + 0.05 ? "gold" : rng.next() < 0.6 ? "puff" : "akara";
    items = [...items, { id: s.nextId, kind, x: 26 + rng.next() * (W - 52), y: -20, vy: p.speed * (0.85 + rng.next() * 0.3), rot: rng.next() * 6, spin: (rng.next() - 0.5) * 4, sway: rng.next() * 6 }];
    s.nextId++;
    s.nextSpawn = s.time + p.gap * (0.7 + rng.next() * 0.6);
  }
  s.cursor = rng.cursor();

  const kept: Item[] = [];
  for (const it0 of items) {
    const it = { ...it0, y: it0.y + it0.vy * STEP, rot: it0.rot + it0.spin * STEP, sway: it0.sway + STEP * 3 };
    it.x += Math.sin(it.sway) * 0.25;
    const inBasket = it0.y < RIM_Y && it.y >= RIM_Y && Math.abs(it.x - s.basket) < BASKET_HALF - 4;
    if (inBasket) {
      if (it.kind === "pepper") {
        s.lives--;
        s.combo = 0;
        ev.burned = true;
      } else {
        s.combo++;
        s.caught++;
        const points = POINTS[it.kind] * multiplier(s.combo);
        s.score += points;
        ev.caught.push({ kind: it.kind, x: it.x, points });
      }
      continue;
    }
    if (it.y > H + 20) {
      if (it.kind !== "pepper") {
        ev.missed++;
        s.combo = 0;
      }
      continue;
    }
    kept.push(it);
  }
  s.items = kept;
  if (s.lives <= 0) s.over = true;
  return { state: s, ev };
}
