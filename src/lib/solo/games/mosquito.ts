import { makeRng } from "@/games/_engine/rng";

/**
 * Mosquito Wahala: mosquitoes come in waves, zig-zagging down towards your bed. Your spray can
 * puffs by itself; slide it under them. A mosquito that reaches the bed bites you; five bites and
 * you're done for the night. Some mosquitoes drop power-ups: a coil (they slow down), a net (no
 * bites for a while) and a double spray.
 *
 * Pure and seeded, stepped on a fixed clock. The can's position is an input to each step.
 */
export const W = 358;
export const H = 560;
export const CAN_Y = 476;
export const BED_Y = 410;
export const STEP = 1 / 60;
export const START_BITES = 5;
export const POWER_SECONDS = 8;

export type Mosquito = { id: number; x: number; y: number; vx: number; vy: number; phase: number; hp: number; big: boolean };
export type Puff = { x: number; y: number; r: number; life: number };
export type Power = { kind: "coil" | "net" | "double"; x: number; y: number };
export type MosquitoState = {
  bugs: Mosquito[];
  puffs: Puff[];
  powers: Power[];
  can: number;
  bites: number;
  wave: number;
  toSpawn: number;
  nextSpawn: number;
  nextPuff: number;
  coil: number;
  net: number;
  double: number;
  score: number;
  kills: number;
  time: number;
  nextId: number;
  cursor: number;
  over: boolean;
};
export type MosquitoEvents = { hits: { x: number; y: number; killed: boolean; points: number }[]; bitten: boolean; blocked: boolean; wave: number | null; power: Power["kind"] | null };

export const waveSize = (wave: number) => 6 + wave * 2;

export function newMosquito(seed: string): MosquitoState {
  return { bugs: [], puffs: [], powers: [], can: W / 2, bites: START_BITES, wave: 1, toSpawn: waveSize(1), nextSpawn: 1, nextPuff: 0, coil: 0, net: 0, double: 0, score: 0, kills: 0, time: 0, nextId: 1, cursor: makeRng(seed).cursor(), over: false };
}

export function stepMosquito(seed: string, s0: MosquitoState, canX: number): { state: MosquitoState; ev: MosquitoEvents } {
  const ev: MosquitoEvents = { hits: [], bitten: false, blocked: false, wave: null, power: null };
  if (s0.over) return { state: s0, ev };
  const dt = STEP;
  const s: MosquitoState = { ...s0, can: Math.max(30, Math.min(W - 30, canX)), time: s0.time + dt, coil: Math.max(0, s0.coil - dt), net: Math.max(0, s0.net - dt), double: Math.max(0, s0.double - dt) };
  const rng = makeRng(seed, s.cursor);
  const speed = (58 + s.wave * 10) * (s.coil > 0 ? 0.5 : 1);

  // New mosquitoes fly in from the top and the sides.
  let bugs = s.bugs;
  if (s.toSpawn > 0 && s.time >= s.nextSpawn) {
    const big = s.wave >= 3 && rng.next() < 0.15 + s.wave * 0.02;
    bugs = [...bugs, { id: s.nextId, x: 20 + rng.next() * (W - 40), y: -10, vx: (rng.next() - 0.5) * 80, vy: speed, phase: rng.next() * 6, hp: big ? 3 : 1, big }];
    s.nextId++;
    s.toSpawn--;
    s.nextSpawn = s.time + Math.max(0.3, 1.1 - s.wave * 0.08) * (0.6 + rng.next() * 0.8);
  }

  // The can puffs on its own: a cloud that rises and spreads.
  let puffs = s.puffs;
  if (s.time >= s.nextPuff) {
    const spread = s.double > 0 ? [-14, 14] : [0];
    puffs = [...puffs, ...spread.map((d) => ({ x: s.can + d, y: CAN_Y - 30, r: 8, life: 1 }))];
    s.nextPuff = s.time + (s.double > 0 ? 0.14 : 0.2);
  }
  puffs = puffs.map((p) => ({ ...p, y: p.y - 430 * dt, r: p.r + 26 * dt, life: p.life - dt * 1.9 })).filter((p) => p.life > 0 && p.y > -20);

  // Mosquitoes zig-zag downwards; puffs hurt them.
  const kept: Mosquito[] = [];
  for (const b0 of bugs) {
    const b = { ...b0, phase: b0.phase + dt * 5 };
    const jitter = (rng.next() - 0.5) * (1100 + s.wave * 80) * dt;
    b.vx = Math.max(-170, Math.min(170, b.vx * 0.98 + jitter));
    b.x += (b.vx + Math.sin(b.phase) * 60) * dt;
    b.y += speed * (b.big ? 0.75 : 1) * (0.6 + Math.abs(Math.sin(b.phase * 0.5))) * dt;
    if (b.x < 14) [b.x, b.vx] = [14, Math.abs(b.vx)];
    if (b.x > W - 14) [b.x, b.vx] = [W - 14, -Math.abs(b.vx)];
    let hp = b.hp;
    puffs = puffs.filter((p) => {
      if (hp > 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + (b.big ? 11 : 6)) {
        hp--;
        return false;
      }
      return true;
    });
    if (hp < b.hp) {
      const killed = hp <= 0;
      const points = killed ? (b.big ? 60 : 25) * s.wave : 0;
      s.score += points;
      if (killed) {
        s.kills++;
        if (rng.next() < 0.09) {
          const r = rng.next();
          s.powers = [...s.powers, { kind: r < 0.34 ? "coil" : r < 0.67 ? "net" : "double", x: b.x, y: b.y }];
        }
      }
      ev.hits.push({ x: b.x, y: b.y, killed, points });
      if (killed) continue;
    }
    b.hp = hp;
    if (b.y >= BED_Y) {
      if (s.net > 0) ev.blocked = true;
      else {
        s.bites--;
        ev.bitten = true;
      }
      continue;
    }
    kept.push(b);
  }
  s.bugs = kept;
  s.puffs = puffs;

  // Power-ups drift down; the can collects them.
  const powers: Power[] = [];
  for (const p of s.powers) {
    const y = p.y + 90 * dt;
    if (y > CAN_Y - 40 && Math.abs(p.x - s.can) < 40) {
      ev.power = p.kind;
      if (p.kind === "coil") s.coil = POWER_SECONDS;
      else if (p.kind === "net") s.net = POWER_SECONDS;
      else s.double = POWER_SECONDS;
    } else if (y < H) powers.push({ ...p, y });
  }
  s.powers = powers;

  // Wave cleared: a short breather, then a bigger one.
  if (s.toSpawn === 0 && !s.bugs.length) {
    s.score += 200 * s.wave;
    s.wave++;
    s.toSpawn = waveSize(s.wave);
    s.nextSpawn = s.time + 2;
    ev.wave = s.wave;
  }
  s.cursor = rng.cursor();
  if (s.bites <= 0) s.over = true;
  return { state: s, ev };
}
