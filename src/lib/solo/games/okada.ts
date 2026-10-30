import { makeRng } from "@/games/_engine/rng";

/**
 * Okada Rush: steer an okada round a grid of Lagos road. Each passenger you pick up rides along
 * behind you (the trail grows). Hit the edge, your own trail, or traffic and it's over. It speeds
 * up as you go, and more danfos and kekes pull in. Pure and seeded.
 */
export const COLS = 15;
export const ROWS = 21;
export type Dir = "up" | "down" | "left" | "right";
export type Vehicle = { cells: number[]; kind: "danfo" | "keke" };
export type OkadaState = {
  body: number[]; // head first
  dir: Dir;
  queued: Dir[];
  rider: number; // passenger waiting
  traffic: Vehicle[];
  score: number;
  cursor: number;
  over: boolean;
  steps: number;
};

const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const at = (r: number, c: number) => r * COLS + c;

function free(s: Pick<OkadaState, "body" | "traffic" | "rider">, i: number) {
  return !s.body.includes(i) && !s.traffic.some((v) => v.cells.includes(i)) && s.rider !== i;
}

function spawnRider(seed: string, s: OkadaState): OkadaState {
  const rng = makeRng(seed, s.cursor);
  for (let tries = 0; tries < 400; tries++) {
    const i = rng.int(COLS * ROWS);
    if (free({ ...s, rider: -1 }, i)) return { ...s, rider: i, cursor: rng.cursor() };
  }
  return { ...s, cursor: rng.cursor() };
}

/** A danfo (two squares) or keke (one), parked away from the okada's nose. */
function spawnTraffic(seed: string, s: OkadaState): OkadaState {
  const rng = makeRng(seed, s.cursor);
  const head = s.body[0]!;
  const hr = Math.floor(head / COLS);
  const hc = head % COLS;
  for (let tries = 0; tries < 400; tries++) {
    const kind = rng.next() < 0.6 ? "danfo" : "keke";
    const r = rng.int(ROWS);
    const c = rng.int(COLS - 1);
    const cells = kind === "danfo" ? [at(r, c), at(r, c + 1)] : [at(r, c)];
    if (Math.abs(r - hr) + Math.abs(c - hc) < 5) continue;
    if (cells.every((i) => free(s, i))) return { ...s, traffic: [...s.traffic, { cells, kind }], cursor: rng.cursor() };
  }
  return { ...s, cursor: rng.cursor() };
}

export function newOkada(seed: string): OkadaState {
  const mid = Math.floor(COLS / 2);
  const start: OkadaState = { body: [at(ROWS - 4, mid), at(ROWS - 3, mid), at(ROWS - 2, mid)], dir: "up", queued: [], rider: -1, traffic: [], score: 0, cursor: 0, over: false, steps: 0 };
  return spawnRider(seed, spawnTraffic(seed, start));
}

/** Milliseconds between steps: starts gentle, speeds up with every passenger. */
export const stepMs = (s: OkadaState) => Math.max(70, 190 - s.score * 4);

/** Queue a turn (at most two ahead, never straight back on yourself). */
export function turn(s: OkadaState, d: Dir): OkadaState {
  const last = s.queued[s.queued.length - 1] ?? s.dir;
  if (d === last || d === opposite[last] || s.queued.length >= 2) return s;
  return { ...s, queued: [...s.queued, d] };
}

export function step(seed: string, s: OkadaState): { state: OkadaState; picked: boolean } {
  if (s.over) return { state: s, picked: false };
  const [next, ...rest] = s.queued;
  const dir = next ?? s.dir;
  const head = s.body[0]!;
  const r = Math.floor(head / COLS);
  const c = head % COLS;
  const nr = r + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
  const nc = c + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
  const base = { ...s, dir, queued: rest, steps: s.steps + 1 };
  if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) return { state: { ...base, over: true }, picked: false };
  const ni = at(nr, nc);
  const picked = ni === s.rider;
  // The tail moves out of the way this step unless we're growing.
  const body = picked ? s.body : s.body.slice(0, -1);
  if (body.includes(ni) || s.traffic.some((v) => v.cells.includes(ni))) return { state: { ...base, over: true }, picked: false };
  let out: OkadaState = { ...base, body: [ni, ...body] };
  if (picked) {
    out = { ...out, score: s.score + 1, rider: -1 };
    if (out.score % 3 === 0) out = spawnTraffic(seed, out);
    out = spawnRider(seed, out);
  }
  return { state: out, picked };
}
