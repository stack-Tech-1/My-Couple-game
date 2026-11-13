import { makeRng } from "@/games/_engine/rng";

/**
 * Pump Am: the water ring toss. Rings float in a tank of water. Each pump sends a burst of water
 * up from its nozzle and the rings ride it, tumbling, then sink slowly. A ring that comes down
 * lying flat over a peg's tip slides onto it and stays. Hang all ten.
 *
 * Pure and seeded: the same seed starts the same rings. The game is stepped on a fixed clock
 * (STEP seconds), so it plays the same on every phone.
 */
export const TANK_W = 314;
export const TANK_H = 400;
export const RING_R = 22; // drawn radius
export const RINGS = 10;
export const STEP = 1 / 60;
export const TIME_LIMIT = 180; // seconds

export const PEGS = [
  { x: 96, tip: 150, base: 362 },
  { x: 222, tip: 186, base: 362 },
] as const;
export const NOZZLES = [{ x: 50 }, { x: 264 }] as const;

export const RING_COLORS = [
  ["#ff7eb6", "#c43c7c"],
  ["#7cd36b", "#2f8a3e"],
  ["#f6c453", "#b37d10"],
  ["#ff8a5b", "#c0461f"],
  ["#b48cff", "#6a3fc4"],
  ["#5fd4e8", "#1f8aa0"],
  ["#f6efe6", "#b9ad9f"],
  ["#ff7eb6", "#c43c7c"],
  ["#7cd36b", "#2f8a3e"],
  ["#f6c453", "#b37d10"],
] as const;

export type Ring = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Tumble: 0 or π means lying flat (seen edge-on), π/2 means standing up facing you. */
  tumble: number;
  spin: number;
  /** In-picture tilt, for looks. */
  tilt: number;
  /** Which peg it hangs on, if any. */
  peg: number | null;
  color: number;
};

export type PumpState = {
  rings: Ring[];
  time: number; // seconds played
  cursor: number;
  over: boolean;
  /** Rings that landed this step (for sounds and buzzes); cleared each step. */
  landed: number;
};

const COLLIDE_R = 15;
const GRAVITY = 95;
const DRAG = 1.1;
const CATCH_X = 13;
/** Jet strength, and how much a jet steers rings towards its own peg. Tuned so that steady
 * pumping hangs most rings in three minutes, and all ten takes some skill. */
const PUSH = 520;
const SPREAD = 0.3;

export function newPump(seed: string): PumpState {
  const rng = makeRng(seed);
  const rings: Ring[] = Array.from({ length: RINGS }, (_, i) => ({
    x: 40 + rng.next() * (TANK_W - 80),
    y: TANK_H - 30 - rng.next() * 50,
    vx: 0,
    vy: 0,
    tumble: 0.6 + rng.next() * 1.8,
    spin: 0,
    tilt: (rng.next() - 0.5) * 0.6,
    peg: null,
    color: i,
  }));
  return { rings, time: 0, cursor: rng.cursor(), over: false, landed: 0 };
}

export const hung = (s: PumpState) => s.rings.filter((r) => r.peg !== null).length;

/** How flat a ring is lying: 0 = perfectly flat, 1 = standing up. */
export const upright = (r: Ring) => Math.abs(Math.sin(r.tumble));

/** A pump press: a burst of water up from that side. `power` is 1 for a full press. */
export function pump(seed: string, s: PumpState, side: 0 | 1, power = 1): PumpState {
  if (s.over) return s;
  const rng = makeRng(seed, s.cursor);
  const nx = NOZZLES[side].x;
  const rings = s.rings.map((r) => {
    const dx = r.x - nx;
    const depth = TANK_H - r.y;
    const reach = Math.exp(-(dx * dx) / (2 * 85 * 85)) * Math.exp(-depth / 230);
    const push = PUSH * power * reach;
    if (push < 4) return r;
    if (r.peg !== null) {
      // A ring on a peg can be lifted a little, but never off.
      return { ...r, vy: r.vy - push * 0.35 };
    }
    return {
      ...r,
      vy: r.vy - push,
      vx: r.vx + ((PEGS[side].x - r.x) / 100) * push * SPREAD + (rng.next() - 0.5) * push * 0.22,
      spin: r.spin + (rng.next() - 0.5) * push * 0.05,
    };
  });
  return { ...s, rings, cursor: rng.cursor() };
}

/**
 * One fixed step. `tilt` is the phone's sideways lean, -1 (left) to 1 (right).
 */
export function stepPump(s: PumpState, tilt = 0): PumpState {
  if (s.over) return s;
  const dt = STEP;
  const damp = Math.exp(-DRAG * dt);
  let landed = 0;
  const pegCount = PEGS.map((_, p) => s.rings.filter((r) => r.peg === p).length);
  const rings = s.rings.map((r0) => {
    const r = { ...r0 };
    if (r.peg !== null) {
      // Threaded: slides down the peg to the top of its stack, lying flat.
      const peg = PEGS[r.peg]!;
      const below = s.rings.filter((o) => o.peg === r.peg && o !== r0 && o.y > r0.y).length;
      const floor = peg.base - 8 - below * 10;
      r.vy = (r.vy + GRAVITY * dt) * damp;
      r.y = Math.min(floor, Math.max(peg.tip + 14, r.y + r.vy * dt));
      if (r.y >= floor) r.vy = 0;
      r.x += (peg.x - r.x) * 0.3;
      r.vx = 0;
      r.tumble += (Math.round(r.tumble / Math.PI) * Math.PI - r.tumble) * 0.15;
      r.spin = 0;
      r.tilt *= 0.9;
      return r;
    }
    r.vx = (r.vx + tilt * 90 * dt) * damp;
    r.vy = (r.vy + GRAVITY * dt) * damp;
    const prevY = r.y;
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.tilt = Math.max(-0.7, Math.min(0.7, r.tilt + r.vx * 0.0006 - r.tilt * 0.02));
    // Tumbling slows down in water, and slow rings settle towards lying flat.
    r.spin *= Math.exp(-0.9 * dt);
    r.tumble += r.spin * dt;
    if (Math.abs(r.spin) < 1.2) r.tumble += (Math.round(r.tumble / Math.PI) * Math.PI - r.tumble) * 0.008;

    // Onto a peg: coming down over the tip, lying flat enough.
    for (let p = 0; p < PEGS.length; p++) {
      const peg = PEGS[p]!;
      if (r.vy > 0 && prevY <= peg.tip && r.y > peg.tip && Math.abs(r.x - peg.x) < CATCH_X && upright(r) < 0.7 && pegCount[p]! < RINGS) {
        r.peg = p;
        r.x = peg.x;
        landed++;
        return r;
      }
    }
    // Pegs are solid below the tip: a ring that isn't threaded bumps off the shaft.
    for (const peg of PEGS) {
      if (r.y > peg.tip + 2) {
        const dx = r.x - peg.x;
        const min = 6 + RING_R * 0.55;
        if (Math.abs(dx) < min) {
          r.x = peg.x + Math.sign(dx || 1) * min;
          r.vx = Math.sign(dx || 1) * Math.abs(r.vx) * 0.5;
        }
      }
    }
    // Walls.
    if (r.x < RING_R) [r.x, r.vx] = [RING_R, Math.abs(r.vx) * 0.5];
    if (r.x > TANK_W - RING_R) [r.x, r.vx] = [TANK_W - RING_R, -Math.abs(r.vx) * 0.5];
    if (r.y < RING_R) [r.y, r.vy] = [RING_R, Math.abs(r.vy) * 0.3];
    if (r.y > TANK_H - 10) [r.y, r.vy] = [TANK_H - 10, 0];
    return r;
  });

  // Free rings push each other apart.
  for (let i = 0; i < rings.length; i++) {
    const a = rings[i]!;
    if (a.peg !== null) continue;
    for (let j = i + 1; j < rings.length; j++) {
      const b = rings[j]!;
      if (b.peg !== null) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < COLLIDE_R * 2) {
        const push = (COLLIDE_R * 2 - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }

  const time = s.time + dt;
  const all = rings.every((r) => r.peg !== null);
  return { ...s, rings, time, landed, over: all || time >= TIME_LIMIT };
}

/** 100 a ring, plus a time bonus for hanging all ten. */
export function pumpScore(s: PumpState): number {
  const n = hung(s);
  const bonus = n === RINGS ? Math.max(0, Math.round((TIME_LIMIT - s.time) * 20)) : 0;
  return n * 100 + bonus;
}
