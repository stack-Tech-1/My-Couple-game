import { makeRng } from "@/games/_engine/rng";

/**
 * Bash Am: brick breaker. Keep the ball up with your plank and break every brick on the street.
 * Each street is a new wall; tough bricks take two hits. Gold capsules fall from some bricks:
 * GEN (a wider plank), Go slow (a slower ball) and, now and then, an extra ball to keep.
 *
 * Pure and seeded, stepped on a fixed clock. The plank's position is an input to each step.
 */
export const W = 358;
export const H = 560;
export const COLS = 7;
export const BRICK_W = 44;
export const BRICK_H = 20;
export const GAP = 6;
export const TOP = 70;
export const PLANK_Y = 505;
export const PLANK_W = 84;
export const WIDE_W = 126;
export const BALL_R = 8.5;
export const STEP = 1 / 120;
export const START_LIVES = 3;

export const PAINTS = ["#e8563a", "#e9b13c", "#3f74d8", "#2f8a4e", "#f2a7a0", "#b48cff", "#f6efe6"] as const;
export const STREETS = ["Ikeja", "Yaba", "Surulere", "Lekki", "Ajah", "Ikorodu", "Festac", "Oshodi", "Obalende", "Victoria Island"];

export type Brick = { col: number; row: number; hp: number; tough: boolean; paint: number };
export type Capsule = { kind: "gen" | "slow" | "life"; x: number; y: number };
export type BashState = {
  bricks: Brick[];
  ball: { x: number; y: number; vx: number; vy: number };
  launched: boolean;
  plank: number; // centre x
  lives: number;
  level: number;
  score: number;
  combo: number;
  capsules: Capsule[];
  wideFor: number; // seconds left
  slowFor: number;
  cursor: number;
  time: number;
  over: boolean;
};

/** What happened in a step, for sounds and effects. */
export type BashEvents = { hits: { x: number; y: number; paint: number; broke: boolean }[]; plank: boolean; wall: boolean; lost: boolean; cleared: boolean; caught: Capsule["kind"] | null };

export const brickX = (b: Pick<Brick, "col">) => 7 + b.col * (BRICK_W + GAP);
export const brickY = (b: Pick<Brick, "row">) => TOP + b.row * (BRICK_H + 6);
export const plankWidth = (s: Pick<BashState, "wideFor">) => (s.wideFor > 0 ? WIDE_W : PLANK_W);
const baseSpeed = (level: number) => Math.min(470, 300 + (level - 1) * 22);

/** A street's wall: more rows and more tough bricks as you go, with a few gaps for character. */
export function wall(seed: string, level: number): Brick[] {
  const rng = makeRng(`${seed}:street:${level}`);
  const rows = Math.min(7, 3 + level);
  const toughRows = Math.min(rows - 1, Math.floor((level - 1) / 2) + (level > 1 ? 1 : 0));
  const shape = level === 1 ? 0 : rng.int(4);
  const out: Brick[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < COLS; col++) {
      // Shapes: full wall, pyramid, checker, or a wall with a window.
      if (shape === 1 && (col < row - rows + 4 || col > COLS - 1 - (row - rows + 4)) && row < rows - 1) continue;
      if (shape === 2 && (row + col) % 2 === 1 && row < rows - 2) continue;
      if (shape === 3 && row >= 1 && row <= 2 && col >= 2 && col <= 4) continue;
      if (level > 1 && rng.next() < 0.06) continue;
      const tough = row < toughRows;
      out.push({ col, row, hp: tough ? 2 : 1, tough, paint: (row + (col > 3 ? 1 : 0) + level) % PAINTS.length });
    }
  return out;
}

function resetBall(s: BashState): BashState {
  return { ...s, launched: false, ball: { x: s.plank, y: PLANK_Y - BALL_R - 1, vx: 0, vy: 0 } };
}

export function newBash(seed: string): BashState {
  const rng = makeRng(seed);
  return resetBall({ bricks: wall(seed, 1), ball: { x: 0, y: 0, vx: 0, vy: 0 }, launched: false, plank: W / 2, lives: START_LIVES, level: 1, score: 0, combo: 0, capsules: [], wideFor: 0, slowFor: 0, cursor: rng.cursor(), time: 0, over: false });
}

export function launch(seed: string, s: BashState): BashState {
  if (s.launched || s.over) return s;
  const rng = makeRng(seed, s.cursor);
  const speed = baseSpeed(s.level);
  const a = (rng.next() - 0.5) * 0.8; // up, a little left or right
  return { ...s, launched: true, ball: { ...s.ball, vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed }, cursor: rng.cursor() };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** One fixed step. `plankX` is where the player wants the plank (its centre). */
export function stepBash(seed: string, s0: BashState, plankX: number): { state: BashState; ev: BashEvents } {
  const ev: BashEvents = { hits: [], plank: false, wall: false, lost: false, cleared: false, caught: null };
  if (s0.over) return { state: s0, ev };
  let s: BashState = { ...s0, time: s0.time + STEP, wideFor: Math.max(0, s0.wideFor - STEP), slowFor: Math.max(0, s0.slowFor - STEP) };
  const pw = plankWidth(s);
  s.plank = clamp(plankX, pw / 2, W - pw / 2);
  if (!s.launched) return { state: { ...s, ball: { ...s.ball, x: s.plank } }, ev };

  const slow = s.slowFor > 0 ? 0.68 : 1;
  const b = { ...s.ball };
  b.x += b.vx * STEP * slow;
  b.y += b.vy * STEP * slow;
  // Walls and ceiling.
  if (b.x < BALL_R) [b.x, b.vx, ev.wall] = [BALL_R, Math.abs(b.vx), true];
  if (b.x > W - BALL_R) [b.x, b.vx, ev.wall] = [W - BALL_R, -Math.abs(b.vx), true];
  if (b.y < BALL_R + 8) [b.y, b.vy, ev.wall] = [BALL_R + 8, Math.abs(b.vy), true];

  // Bricks: the first one the ball overlaps, bounced off its nearest face.
  let bricks = s.bricks;
  const rng = makeRng(seed, s.cursor);
  let capsules = s.capsules;
  for (let i = 0; i < bricks.length; i++) {
    const k = bricks[i]!;
    const x0 = brickX(k), y0 = brickY(k);
    const nx = clamp(b.x, x0, x0 + BRICK_W), ny = clamp(b.y, y0, y0 + BRICK_H);
    const dx = b.x - nx, dy = b.y - ny;
    if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
    const overlapX = Math.min(b.x + BALL_R - x0, x0 + BRICK_W - (b.x - BALL_R));
    const overlapY = Math.min(b.y + BALL_R - y0, y0 + BRICK_H - (b.y - BALL_R));
    if (overlapX < overlapY) b.vx = b.x < x0 + BRICK_W / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
    else b.vy = b.y < y0 + BRICK_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
    const hp = k.hp - 1;
    const combo = Math.min(8, s.combo + 1);
    s = { ...s, combo, score: s.score + (hp <= 0 ? 10 * s.level * combo : 5) };
    ev.hits.push({ x: x0 + BRICK_W / 2, y: y0 + BRICK_H / 2, paint: k.tough ? -1 : k.paint, broke: hp <= 0 });
    if (hp <= 0) {
      bricks = bricks.filter((_, j) => j !== i);
      const roll = rng.next();
      if (roll < 0.13) {
        const kind: Capsule["kind"] = roll < 0.015 ? "life" : roll < 0.075 ? "gen" : "slow";
        capsules = [...capsules, { kind, x: x0 + BRICK_W / 2, y: y0 + BRICK_H / 2 }];
      }
    } else bricks = bricks.map((o, j) => (j === i ? { ...o, hp } : o));
    break;
  }
  s = { ...s, bricks, capsules, cursor: rng.cursor() };

  // The plank: where it hits decides the angle back up.
  if (b.vy > 0 && b.y + BALL_R >= PLANK_Y && b.y + BALL_R <= PLANK_Y + 16 && Math.abs(b.x - s.plank) <= pw / 2 + BALL_R * 0.6) {
    const off = clamp((b.x - s.plank) / (pw / 2), -1, 1);
    const speed = Math.min(baseSpeed(s.level) + 90, Math.hypot(b.vx, b.vy) * 1.012);
    const a = off * (Math.PI / 3);
    b.vx = Math.sin(a) * speed;
    b.vy = -Math.cos(a) * speed;
    b.y = PLANK_Y - BALL_R;
    ev.plank = true;
    s = { ...s, combo: 0 };
  }
  // Never let the ball get stuck going sideways forever.
  if (Math.abs(b.vy) < 60) b.vy = b.vy < 0 ? -60 : 60;
  s = { ...s, ball: b };

  // Capsules fall; the plank catches them.
  const fallen: Capsule[] = [];
  for (const c of s.capsules) {
    const y = c.y + 130 * STEP;
    if (y >= PLANK_Y - 6 && y <= PLANK_Y + 18 && Math.abs(c.x - s.plank) <= pw / 2 + 14) {
      ev.caught = c.kind;
      if (c.kind === "gen") s = { ...s, wideFor: 14 };
      else if (c.kind === "slow") s = { ...s, slowFor: 10 };
      else s = { ...s, lives: Math.min(5, s.lives + 1) };
      s = { ...s, score: s.score + 50 };
    } else if (y < H) fallen.push({ ...c, y });
  }
  s = { ...s, capsules: fallen };

  // Lost the ball.
  if (b.y - BALL_R > H) {
    ev.lost = true;
    const lives = s.lives - 1;
    s = resetBall({ ...s, lives, combo: 0, capsules: [], wideFor: 0, slowFor: 0 });
    if (lives <= 0) s = { ...s, over: true };
  }
  // Street cleared: on to the next one.
  if (!s.bricks.length && !s.over) {
    ev.cleared = true;
    const level = s.level + 1;
    s = resetBall({ ...s, level, bricks: wall(seed, level), score: s.score + 500 * s.level, capsules: [], combo: 0 });
  }
  return { state: s, ev };
}
