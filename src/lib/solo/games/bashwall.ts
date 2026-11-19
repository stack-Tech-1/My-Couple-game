import { makeRng } from "@/games/_engine/rng";
import { BALL_R, BRICK_H, BRICK_W, COLS, H, PLANK_W, PLANK_Y, STEP, W, WIDE_W, brickX, brickY } from "./bash";

/**
 * Bash Am's career: five sites of ten walls. Each site changes how the wall behaves and ends with
 * a boss. Fewer dropped balls earn more stars and pay, and the pay builds your street, whose
 * buildings help on the walls. (The endless game, Endless Street, lives in ./bash.)
 *
 * Pure and seeded, stepped on a fixed clock. The plank's position is an input to each step.
 */
export const WALLS_PER_SITE = 10;
export const SITES = [
  { name: "Compound Fence", place: "Yaba", about: "Learn the plank. Tough blocks take two hits.", boss: "The Iron Gate" },
  { name: "Market Stalls", place: "Balogun", about: "Rows of stalls slide left and right.", boss: "The Container" },
  { name: "Under the Bridge", place: "Oshodi", about: "Danfos cross the road and knock your ball off course.", boss: "Big Molue" },
  { name: "Glass Towers", place: "Victoria Island", about: "Glass shatters, and falling shards shrink your plank.", boss: "The Tower" },
  { name: "The Quarry", place: "Abeokuta", about: "Dynamite sets off chain blasts around solid rock.", boss: "The Crusher" },
] as const;
export const WALLS = SITES.length * WALLS_PER_SITE;
export const START_BALLS = 3;
export const STREAK = 8;
export const HOT_SECONDS = 4;
export const HAMMER_SECONDS = 6;
export const DANFO_Y = 352;
export const DANFO_W = 78;
export const DANFO_H = 34;
const SHRUNK_W = 60;

export const siteOf = (wall: number) => Math.floor((wall - 1) / WALLS_PER_SITE);
export const indexOf = (wall: number) => ((wall - 1) % WALLS_PER_SITE) + 1;
export const isBossWall = (wall: number) => indexOf(wall) === WALLS_PER_SITE;
export function wallOfMode(mode: string): number | null {
  const m = /^wall-(\d{1,2})$/.exec(mode);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= WALLS ? n : null;
}
/** Walls open in order, by clearing the one before. */
export const wallOpen = (wall: number, cleared: (n: number) => boolean) => wall === 1 || cleared(wall - 1);

/** Fewer dropped balls, more stars. */
export const starsFor = (dropped: number) => (dropped === 0 ? 3 : dropped === 1 ? 2 : 1);
export const wallPay = (wall: number) => 350 + wall * 30;
export const cleanBonus = (stars: number) => (stars === 3 ? 150 : stars === 2 ? 60 : 0);
/** A cleared wall pays this into your savings. It is also the wall's saved score. */
export const takings = (wall: number, dropped: number) => wallPay(wall) + cleanBonus(starsFor(dropped));
export function starsOfTakings(wall: number, score: number) {
  if (score <= 0) return 0;
  const bonus = score - wallPay(wall);
  return bonus >= cleanBonus(3) ? 3 : bonus >= cleanBonus(2) ? 2 : 1;
}

export const RANKS = [
  { name: "Site Boy", stars: 0 },
  { name: "Block Moulder", stars: 25 },
  { name: "Foreman", stars: 60 },
  { name: "Site Engineer", stars: 100 },
  { name: "Oga Contractor", stars: 135 },
] as const;
export function rankFor(stars: number) {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (stars >= r.stars) index = i;
  });
  return { ...RANKS[index]!, index, next: RANKS[index + 1] ?? null };
}

/** Your street: each building costs savings and helps on every wall. */
export const BUILDINGS = [
  { id: "shed", name: "Carpenter's Shed", about: "A longer plank from the start.", price: 5000 },
  { id: "generator", name: "Generator House", about: "GEN lasts longer.", price: 6000 },
  { id: "mechanic", name: "Mechanic Workshop", about: "Capsules fall more slowly.", price: 8000 },
  { id: "chemist", name: "Chemist", about: "Start every wall with an extra ball.", price: 10000 },
  { id: "welder", name: "Welder's Shop", about: "Tough blocks break in one hit.", price: 14000 },
] as const;
export type BuildingId = (typeof BUILDINGS)[number]["id"];
export const isBuilding = (id: string): id is BuildingId => BUILDINGS.some((b) => b.id === id);

export type BrickKind = "brick" | "tough" | "stall" | "glass" | "dynamite" | "rock";
export type WallBrick = { id: number; col: number; row: number; hp: number; kind: BrickKind; paint: number };
export type WallBall = { id: number; x: number; y: number; vx: number; vy: number };
export type CapsuleKind = "gen" | "slow" | "life" | "triple" | "hammer" | "floor";
export type WallCapsule = { kind: CapsuleKind; x: number; y: number };
export type Shard = { id: number; x: number; y: number };
export type Danfo = { id: number; x: number; vx: number };
export type BossState = { x: number; y: number; w: number; h: number; hp: number; max: number; phase: number; relays: number; cool: number };
export type WallState = {
  wall: number;
  gear: string[];
  bricks: WallBrick[];
  balls: WallBall[];
  launched: boolean;
  plank: number;
  lives: number;
  dropped: number;
  broken: number;
  score: number;
  combo: number;
  hot: number;
  wideFor: number;
  slowFor: number;
  hammerFor: number;
  shrinkFor: number;
  floor: boolean;
  capsules: WallCapsule[];
  shards: Shard[];
  danfos: Danfo[];
  nextDanfo: number;
  boss: BossState | null;
  nextId: number;
  cursor: number;
  time: number;
  over: boolean;
  won: boolean;
};
export type WallEvents = {
  hits: { x: number; y: number; kind: BrickKind; broke: boolean }[];
  plank: boolean;
  bounce: boolean;
  lost: boolean;
  saved: boolean;
  caught: CapsuleKind | null;
  hot: boolean;
  blasts: { x: number; y: number }[];
  horn: boolean;
  danfoHit: boolean;
  shard: boolean;
  bossHit: { x: number; y: number } | null;
  bossDown: boolean;
  relay: boolean;
  crushed: boolean;
  won: boolean;
};

const BOSSES = [
  { hp: 22, w: 170, h: 58, speed: 0.7, range: 70 },
  { hp: 28, w: 190, h: 56, speed: 1, range: 66 },
  { hp: 34, w: 150, h: 52, speed: 1.5, range: 96 },
  { hp: 38, w: 130, h: 70, speed: 0.9, range: 100 },
  { hp: 44, w: 220, h: 60, speed: 0.5, range: 50 },
] as const;
const BOSS_Y = 72;
const CRUSH_Y = 300;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const baseSpeed = (wall: number) => Math.min(430, 245 + siteOf(wall) * 22 + indexOf(wall) * 4);

/** Where a brick is right now: market stalls slide. */
export const brickLeft = (b: Pick<WallBrick, "col" | "row" | "kind">, time: number) => brickX(b) + (b.kind === "stall" ? Math.sin(time * 0.9 + b.row * 1.3) * (b.row % 2 ? 34 : -34) : 0);
export const brickTop = (b: Pick<WallBrick, "row">) => brickY(b);
export function plankSize(s: Pick<WallState, "wideFor" | "shrinkFor" | "gear">) {
  if (s.shrinkFor > 0) return SHRUNK_W;
  const extra = s.gear.includes("shed") ? 16 : 0;
  return (s.wideFor > 0 ? WIDE_W : PLANK_W) + extra;
}

/** One wall's bricks, the same for everyone on the same seed. */
export function buildWall(seed: string, wall: number, gear: readonly string[] = []): WallBrick[] {
  if (isBossWall(wall)) return siteOf(wall) === 4 ? [] : shieldRow(wall, gear, 1);
  const rng = makeRng(`${seed}:wall:${wall}`);
  const site = siteOf(wall);
  const i = indexOf(wall);
  const rows = Math.min(7, 3 + Math.ceil(i / 2));
  const shape = i === 1 ? 0 : rng.int(4);
  const out: WallBrick[] = [];
  let id = 1;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < COLS; col++) {
      if (site === 1 && (col === 0 || col === COLS - 1)) continue;
      if (shape === 1 && (col < row - rows + 4 || col > COLS - 1 - (row - rows + 4)) && row < rows - 1) continue;
      if (shape === 2 && (row + col) % 2 === 1 && row < rows - 2) continue;
      if (shape === 3 && row >= 1 && row <= 2 && col >= 2 && col <= 4) continue;
      let kind: BrickKind = "brick";
      if (site === 1) kind = "stall";
      else if (site === 3) kind = "glass";
      else if (site === 4 && i >= 2 && row === 2 && col % 2 === 0) kind = "rock";
      else if (site === 4 && rng.next() < 0.16) kind = "dynamite";
      else if (row < Math.floor(i / 3)) kind = "tough";
      out.push({ id: id++, col, row, hp: hpOf(kind, gear), kind, paint: (row * 2 + col) % 5 });
    }
  return out;
}
const hpOf = (kind: BrickKind, gear: readonly string[]) => (kind === "tough" && !gear.includes("welder") ? 2 : 1);

/** The row guarding a boss. Gaps let the ball through. */
function shieldRow(wall: number, gear: readonly string[], firstId: number): WallBrick[] {
  const site = siteOf(wall);
  const kind: BrickKind = site === 1 ? "stall" : site === 3 ? "glass" : "tough";
  const out: WallBrick[] = [];
  for (let col = 0; col < COLS; col++) {
    if (col % 3 === 2 || (site === 1 && (col === 0 || col === COLS - 1))) continue;
    out.push({ id: firstId + col, col, row: 5, hp: hpOf(kind, gear), kind, paint: col % 5 });
  }
  return out;
}

const restBall = (plank: number, id: number): WallBall => ({ id, x: plank, y: PLANK_Y - BALL_R - 1, vx: 0, vy: 0 });

export function newWall(seed: string, wall: number, gear: readonly string[] = []): WallState {
  const owned = gear.filter(isBuilding);
  const site = siteOf(wall);
  const b = BOSSES[site]!;
  return {
    wall,
    gear: owned,
    bricks: buildWall(seed, wall, owned),
    balls: [restBall(W / 2, 1)],
    launched: false,
    plank: W / 2,
    lives: START_BALLS + (owned.includes("chemist") ? 1 : 0),
    dropped: 0,
    broken: 0,
    score: 0,
    combo: 0,
    hot: 0,
    wideFor: 0,
    slowFor: 0,
    hammerFor: 0,
    shrinkFor: 0,
    floor: false,
    capsules: [],
    shards: [],
    danfos: [],
    nextDanfo: 3,
    boss: isBossWall(wall) ? { x: W / 2, y: BOSS_Y, w: b.w, h: b.h, hp: b.hp, max: b.hp, phase: 0, relays: 0, cool: 3 } : null,
    nextId: 100,
    cursor: makeRng(seed).cursor(),
    time: 0,
    over: false,
    won: false,
  };
}

export function launchWall(seed: string, s: WallState): WallState {
  if (s.launched || s.over) return s;
  const rng = makeRng(seed, s.cursor);
  const speed = baseSpeed(s.wall);
  const a = (rng.next() - 0.5) * 0.8;
  return { ...s, launched: true, balls: s.balls.map((b) => ({ ...b, vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed })), cursor: rng.cursor() };
}

const CAPSULE_ROLLS: [CapsuleKind, number][] = [["gen", 0.25], ["slow", 0.45], ["triple", 0.65], ["hammer", 0.8], ["floor", 0.92], ["life", 1]];

export function stepWall(seed: string, s0: WallState, plankX: number): { state: WallState; ev: WallEvents } {
  const ev: WallEvents = { hits: [], plank: false, bounce: false, lost: false, saved: false, caught: null, hot: false, blasts: [], horn: false, danfoHit: false, shard: false, bossHit: null, bossDown: false, relay: false, crushed: false, won: false };
  if (s0.over) return { state: s0, ev };
  const dt = STEP;
  const s: WallState = { ...s0, time: s0.time + dt, hot: Math.max(0, s0.hot - dt), wideFor: Math.max(0, s0.wideFor - dt), slowFor: Math.max(0, s0.slowFor - dt), hammerFor: Math.max(0, s0.hammerFor - dt), shrinkFor: Math.max(0, s0.shrinkFor - dt) };
  const pw = plankSize(s);
  s.plank = clamp(plankX, pw / 2, W - pw / 2);
  if (!s.launched) {
    s.balls = s.balls.map((b) => ({ ...b, x: s.plank }));
    return { state: s, ev };
  }
  const rng = makeRng(seed, s.cursor);
  const site = siteOf(s.wall);
  const slow = s.slowFor > 0 ? 0.68 : 1;

  const dropCapsule = (x: number, y: number) => {
    const roll = rng.next();
    if (roll >= 0.15) return;
    const pick = rng.next();
    s.capsules = [...s.capsules, { kind: CAPSULE_ROLLS.find(([, t]) => pick < t)![0], x, y }];
  };
  /** A brick breaks: pay, count the streak, and set off whatever it was. */
  const breakBrick = (k: WallBrick, chain: boolean) => {
    const x = brickLeft(k, s.time) + BRICK_W / 2;
    const y = brickTop(k) + BRICK_H / 2;
    s.bricks = s.bricks.filter((o) => o.id !== k.id);
    s.broken++;
    s.score += 10 * (site + 1) * Math.max(1, Math.min(STREAK, s.combo + 1));
    ev.hits.push({ x, y, kind: k.kind, broke: true });
    if (!chain && s.hot <= 0) {
      s.combo++;
      if (s.combo >= STREAK) {
        s.combo = 0;
        s.hot = HOT_SECONDS;
        ev.hot = true;
      }
    }
    if (k.kind === "glass" && rng.next() < 0.3) s.shards = [...s.shards, { id: s.nextId++, x, y }];
    dropCapsule(x, y);
    if (k.kind === "dynamite") {
      ev.blasts.push({ x, y });
      for (const o of s.bricks.filter((b) => b.kind !== "rock" && Math.abs(b.col - k.col) <= 1 && Math.abs(b.row - k.row) <= 1)) if (s.bricks.includes(o)) breakBrick(o, true);
    }
  };

  // Danfos cross the road under the bridge.
  if (site === 2) {
    if (s.time >= s.nextDanfo) {
      const left = rng.next() < 0.5;
      s.danfos = [...s.danfos, { id: s.nextId++, x: left ? -DANFO_W : W + DANFO_W, vx: (left ? 1 : -1) * (95 + indexOf(s.wall) * 5) }];
      s.nextDanfo = s.time + Math.max(3.5, 7 - indexOf(s.wall) * 0.3) * (0.8 + rng.next() * 0.4);
      ev.horn = true;
    }
    s.danfos = s.danfos.map((d) => ({ ...d, x: d.x + d.vx * dt })).filter((d) => d.x > -DANFO_W * 1.5 && d.x < W + DANFO_W * 1.5);
  }

  // The boss moves, and each one has its own way of making trouble.
  if (s.boss) {
    const spec = BOSSES[site]!;
    const b = { ...s.boss, phase: s.boss.phase + dt, cool: s.boss.cool - dt };
    b.x = W / 2 + Math.sin(b.phase * spec.speed) * spec.range;
    if (site === 3 && b.cool <= 0) {
      b.cool = 2.4;
      s.shards = [...s.shards, { id: s.nextId++, x: b.x, y: b.y + b.h }];
    }
    if (site === 4) {
      b.y += 4.5 * dt;
      if (b.y >= CRUSH_Y) {
        b.y = BOSS_Y;
        ev.crushed = true;
      }
    }
    s.boss = b;
  }

  // Every ball moves, bounces and breaks things.
  const kept: WallBall[] = [];
  for (const b0 of s.balls) {
    const b = { ...b0 };
    b.x += b.vx * dt * slow;
    b.y += b.vy * dt * slow;
    if (b.x < BALL_R) [b.x, b.vx, ev.bounce] = [BALL_R, Math.abs(b.vx), true];
    if (b.x > W - BALL_R) [b.x, b.vx, ev.bounce] = [W - BALL_R, -Math.abs(b.vx), true];
    if (b.y < BALL_R + 8) [b.y, b.vy, ev.bounce] = [BALL_R + 8, Math.abs(b.vy), true];

    for (const k of s.bricks) {
      const x0 = brickLeft(k, s.time);
      const y0 = brickTop(k);
      const nx = clamp(b.x, x0, x0 + BRICK_W);
      const ny = clamp(b.y, y0, y0 + BRICK_H);
      if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > BALL_R * BALL_R) continue;
      // A fire ball goes straight through anything but rock.
      if (s.hot <= 0 || k.kind === "rock") {
        const overlapX = Math.min(b.x + BALL_R - x0, x0 + BRICK_W - (b.x - BALL_R));
        const overlapY = Math.min(b.y + BALL_R - y0, y0 + BRICK_H - (b.y - BALL_R));
        if (overlapX < overlapY) b.vx = b.x < x0 + BRICK_W / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        else b.vy = b.y < y0 + BRICK_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
      }
      const smash = s.hammerFor > 0;
      if (k.kind === "rock" && !smash) {
        ev.hits.push({ x: x0 + BRICK_W / 2, y: y0 + BRICK_H / 2, kind: k.kind, broke: false });
        break;
      }
      const hp = smash || s.hot > 0 ? 0 : k.hp - 1;
      if (hp <= 0) breakBrick(k, false);
      else {
        s.bricks = s.bricks.map((o) => (o.id === k.id ? { ...o, hp } : o));
        s.score += 5;
        ev.hits.push({ x: x0 + BRICK_W / 2, y: y0 + BRICK_H / 2, kind: k.kind, broke: false });
      }
      break;
    }

    // Danfos knock the ball off course.
    for (const d of s.danfos) {
      const x0 = d.x - DANFO_W / 2;
      const nx = clamp(b.x, x0, x0 + DANFO_W);
      const ny = clamp(b.y, DANFO_Y, DANFO_Y + DANFO_H);
      if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > BALL_R * BALL_R) continue;
      const speed = Math.hypot(b.vx, b.vy);
      b.vy = b.y < DANFO_Y + DANFO_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
      b.y = b.vy < 0 ? DANFO_Y - BALL_R : DANFO_Y + DANFO_H + BALL_R;
      b.vx = clamp(b.vx + d.vx * 0.9, -speed * 0.85, speed * 0.85);
      const fix = speed / Math.hypot(b.vx, b.vy);
      b.vx *= fix;
      b.vy *= fix;
      ev.danfoHit = true;
      break;
    }

    // The boss takes the hit.
    if (s.boss) {
      const r = s.boss;
      const x0 = r.x - r.w / 2;
      const nx = clamp(b.x, x0, x0 + r.w);
      const ny = clamp(b.y, r.y, r.y + r.h);
      if ((b.x - nx) ** 2 + (b.y - ny) ** 2 <= BALL_R * BALL_R) {
        if (ny === r.y + r.h) [b.y, b.vy] = [r.y + r.h + BALL_R, Math.abs(b.vy)];
        else if (ny === r.y) [b.y, b.vy] = [r.y - BALL_R, -Math.abs(b.vy)];
        else [b.x, b.vx] = b.x < r.x ? [x0 - BALL_R, -Math.abs(b.vx)] : [x0 + r.w + BALL_R, Math.abs(b.vx)];
        const hp = r.hp - (s.hot > 0 ? 3 : s.hammerFor > 0 ? 2 : 1);
        s.boss = { ...r, hp, y: site === 4 ? Math.max(BOSS_Y, r.y - 5) : r.y };
        s.score += 20;
        ev.bossHit = { x: b.x, y: b.y };
        if (hp <= 0) {
          s.boss = null;
          ev.bossDown = true;
          s.score += 500 * (site + 1);
        } else if (site !== 4 && s.boss.relays < 2 && hp / r.max < 1 - (s.boss.relays + 1) / 3) {
          // Halfway through a fight, the boss's guard rebuilds.
          const taken = new Set(s.bricks.map((k) => k.col));
          const fresh = shieldRow(s.wall, s.gear, s.nextId).filter((k) => !taken.has(k.col));
          s.nextId += COLS;
          s.bricks = [...s.bricks, ...fresh];
          s.boss = { ...s.boss, relays: s.boss.relays + 1 };
          ev.relay = true;
        }
      }
    }

    // The plank: where the ball lands decides the angle back up.
    if (b.vy > 0 && b.y + BALL_R >= PLANK_Y && b.y + BALL_R <= PLANK_Y + 16 && Math.abs(b.x - s.plank) <= pw / 2 + BALL_R * 0.6) {
      const off = clamp((b.x - s.plank) / (pw / 2), -1, 1);
      const speed = Math.min(baseSpeed(s.wall) + 70, Math.hypot(b.vx, b.vy) * 1.01);
      const a = off * (Math.PI / 3);
      b.vx = Math.sin(a) * speed;
      b.vy = -Math.cos(a) * speed;
      b.y = PLANK_Y - BALL_R;
      ev.plank = true;
      s.combo = 0;
    }
    if (Math.abs(b.vy) < 60) b.vy = b.vy < 0 ? -60 : 60;

    if (b.y - BALL_R > H - 26 && s.floor) {
      // The cement floor saves one ball.
      s.floor = false;
      b.y = H - 26 + BALL_R;
      b.vy = -Math.abs(b.vy);
      ev.saved = true;
    }
    if (b.y - BALL_R <= H) kept.push(b);
  }
  s.balls = kept;

  // Capsules fall; the plank catches them.
  const fall = s.gear.includes("mechanic") ? 85 : 130;
  const capsules: WallCapsule[] = [];
  for (const c of s.capsules) {
    const y = c.y + fall * dt;
    if (y >= PLANK_Y - 6 && y <= PLANK_Y + 18 && Math.abs(c.x - s.plank) <= pw / 2 + 14) {
      ev.caught = c.kind;
      s.score += 50;
      if (c.kind === "gen") s.wideFor = s.gear.includes("generator") ? 22 : 14;
      else if (c.kind === "slow") s.slowFor = 10;
      else if (c.kind === "hammer") s.hammerFor = HAMMER_SECONDS;
      else if (c.kind === "floor") s.floor = true;
      else if (c.kind === "life") s.lives = Math.min(6, s.lives + 1);
      else if (s.balls.length) {
        const b = s.balls[0]!;
        s.balls = [...s.balls, ...[-0.45, 0.45].map((t) => ({ id: s.nextId++, x: b.x, y: b.y, vx: b.vx * Math.cos(t) - b.vy * Math.sin(t), vy: Math.min(-120, b.vx * Math.sin(t) + b.vy * Math.cos(t)) }))];
      }
    } else if (y < H) capsules.push({ ...c, y });
  }
  s.capsules = capsules;

  // Shards fall; catching one shrinks the plank for a while.
  const shards: Shard[] = [];
  for (const k of s.shards) {
    const y = k.y + 175 * dt;
    if (y >= PLANK_Y - 4 && y <= PLANK_Y + 16 && Math.abs(k.x - s.plank) <= pw / 2) {
      s.shrinkFor = 5;
      ev.shard = true;
    } else if (y < H) shards.push({ ...k, y });
  }
  s.shards = shards;
  s.cursor = rng.cursor();

  const cleared = s.boss === null && (isBossWall(s.wall) || !s.bricks.some((k) => k.kind !== "rock"));
  if (cleared) {
    s.won = true;
    s.over = true;
    ev.won = true;
    return { state: s, ev };
  }

  // Every ball gone, or the Crusher came all the way down: that's one ball dropped.
  if (!s.balls.length || ev.crushed) {
    ev.lost = true;
    s.lives--;
    s.dropped++;
    s.combo = 0;
    s.hot = 0;
    s.launched = false;
    s.capsules = [];
    s.shards = [];
    s.wideFor = 0;
    s.slowFor = 0;
    s.hammerFor = 0;
    s.shrinkFor = 0;
    s.balls = [restBall(s.plank, s.nextId++)];
    if (s.lives <= 0) s.over = true;
  }
  return { state: s, ev };
}
