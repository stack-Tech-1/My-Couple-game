import { makeRng } from "@/games/_engine/rng";
import { ZOBO_LEVELS } from "./zobo-levels";

/**
 * Zobo Sort: pour drinks between bottles until each bottle holds one drink. You can pour onto the
 * same drink or into an empty bottle, as much as fits.
 *
 * The career is five stalls of 20 levels, each adding one twist. Its levels are worked out ahead
 * of time by scripts/games/build-zobo-levels.ts, which solves each one, so none can be impossible
 * and every level has a fair target. Pure and seeded.
 */
export const CAP = 4;
export const MAX_UNDO = 5;

export const DRINKS = [
  { id: "zobo", name: "Zobo", dark: "#5a0b25", light: "#8f1d40" },
  { id: "kunu", name: "Kunu", dark: "#cdb98c", light: "#efe2c2" },
  { id: "orange", name: "Orange", dark: "#d9670a", light: "#ffa63d" },
  { id: "lime", name: "Lime", dark: "#4f9a1f", light: "#8fd14f" },
  { id: "chapman", name: "Chapman", dark: "#b8261a", light: "#f0603f" },
  { id: "malt", name: "Malt", dark: "#2e170a", light: "#6b3a1a" },
  { id: "pineapple", name: "Pineapple", dark: "#d9a90a", light: "#ffe266" },
  { id: "water", name: "Water", dark: "#3f8fc4", light: "#a8dcf5" },
  { id: "hibiscus", name: "Hibiscus", dark: "#c43c7c", light: "#f7a8cf" },
] as const;

export type Bottle = number[]; // drink indexes, bottom first
/** A bottle nailed shut until a whole bottle of `key` has been sorted. */
export type Crate = { bottle: number; key: number };
export type ZoboState = {
  level: number;
  bottles: Bottle[];
  moves: number;
  undo: Bottle[][];
  undosLeft: number;
  won: boolean;
  /** Balogun Market: how many layers at the bottom of each bottle are still covered. */
  covered?: number[];
  undoCovered?: number[][];
  /** Owambe Hall. */
  crates?: Crate[];
  /** Island Lounge: the most pours allowed. */
  limit?: number | null;
  /** The pours the solver needed, for the stars. */
  par?: number;
  /** An extra bottle was bought for this level. */
  extra?: boolean;
};

/* ---- The five stalls ---- */

export const LEVELS_PER_STALL = 20;
export const STALLS = [
  { name: "Mama's Kitchen", place: "Yaba", about: "Plain sorting, to learn the game." },
  { name: "Balogun Market", place: "Lagos Island", about: "Covered drinks stay dark until you pour off what's on top." },
  { name: "Owambe Hall", place: "Surulere", about: "Crated bottles open once you finish a named drink." },
  { name: "Bar Beach", place: "Victoria Island", about: "Only one spare bottle on the shelf." },
  { name: "Island Lounge", place: "Ikoyi", about: "Finish within a set number of pours." },
] as const;
export const LEVELS = STALLS.length * LEVELS_PER_STALL;

export const stallOf = (level: number) => Math.min(STALLS.length - 1, Math.floor((level - 1) / LEVELS_PER_STALL));
/** "lvl-27" is level 27; anything else isn't a career level. */
export const levelOfMode = (mode: string) => {
  const m = /^lvl-(\d{1,3})$/.exec(mode);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= LEVELS ? n : null;
};
/** Levels open in order: finish one to open the next. */
export const levelOpen = (level: number, cleared: (n: number) => boolean) => level <= 1 || cleared(level - 1);

/** What a level is made of, used to build the levels. */
export function levelSpec(level: number) {
  const stall = stallOf(level);
  const j = (level - 1) % LEVELS_PER_STALL;
  const climb = (from: number, steps: number) => from + Math.floor((j * steps) / LEVELS_PER_STALL);
  if (stall === 0) return { drinks: climb(3, 5), spares: 2, crates: 0 };
  if (stall === 1) return { drinks: climb(5, 4), spares: 2, crates: 0 };
  if (stall === 2) return { drinks: climb(5, 4), spares: 2, crates: j < 12 ? 1 : 2 };
  if (stall === 3) return { drinks: climb(4, 3), spares: 1, crates: 0 };
  return { drinks: climb(6, 4), spares: 2, crates: 0 };
}

/* ---- Pouring ---- */

export const drinksFor = (level: number) => Math.min(DRINKS.length, 3 + Math.ceil(level / 2));

const solvedBottle = (b: Bottle) => b.length === 0 || (b.length === CAP && b.every((d) => d === b[0]));
export const isWon = (bottles: Bottle[]) => bottles.every(solvedBottle);
export const isFull = (b: Bottle) => b.length === CAP && b.every((d) => d === b[0]);

/** Is this crate still shut? It opens when a whole bottle of its drink is sorted. */
export const crateShut = (bottles: Bottle[], c: Crate) => !bottles.some((b) => isFull(b) && b[0] === c.key);
const shut = (bottles: Bottle[], crates: Crate[] | undefined, i: number) => !!crates?.some((c) => c.bottle === i && crateShut(bottles, c));

/** How many units would pour from one bottle to another (0 = not allowed). */
export function pourAmount(bottles: Bottle[], from: number, to: number, crates?: Crate[]): number {
  if (from === to) return 0;
  const a = bottles[from]!, b = bottles[to]!;
  if (!a.length || b.length >= CAP) return 0;
  if (shut(bottles, crates, from) || shut(bottles, crates, to)) return 0;
  const top = a[a.length - 1]!;
  if (b.length && b[b.length - 1] !== top) return 0;
  let run = 0;
  for (let i = a.length - 1; i >= 0 && a[i] === top; i--) run++;
  return Math.min(run, CAP - b.length);
}

function applyPour(bottles: Bottle[], from: number, to: number, n: number): Bottle[] {
  const out = bottles.map((b) => [...b]);
  const moved = out[from]!.splice(out[from]!.length - n, n);
  out[to]!.push(...moved);
  return out;
}

/** Can this layout be finished? A depth-first search with a visited set and a node budget. */
export function solvable(bottles: Bottle[], budget = 60_000): boolean {
  const seen = new Set<string>();
  const key = (bs: Bottle[]) => bs.map((b) => b.join(",")).sort().join("|");
  const stack: Bottle[][] = [bottles];
  while (stack.length) {
    const cur = stack.pop()!;
    if (isWon(cur)) return true;
    const k = key(cur);
    if (seen.has(k)) continue;
    seen.add(k);
    if (seen.size > budget) return false;
    for (let f = 0; f < cur.length; f++)
      for (let t = 0; t < cur.length; t++) {
        const n = pourAmount(cur, f, t);
        if (!n) continue;
        // Pouring a whole single-drink bottle into an empty one never helps.
        if (!cur[t]!.length && cur[f]!.every((d) => d === cur[f]![0])) continue;
        stack.push(applyPour(cur, f, t, n));
      }
  }
  return false;
}

export type Move = [from: number, to: number];

/** How mixed-up a shelf is: every change of drink inside a bottle, and every bottle in use. */
function mess(bottles: Bottle[], crates?: Crate[]) {
  let h = 0;
  bottles.forEach((b, i) => {
    if (b.length) h += 1;
    for (let k = 1; k < b.length; k++) if (b[k] !== b[k - 1]) h += 2;
    if (shut(bottles, crates, i)) h += 1;
  });
  return h;
}

/**
 * A short way to finish from here, or null if none turned up. Keeps the `width` tidiest shelves at
 * each step: wide when building levels, narrow when a player asks for a hint on a phone.
 */
export function solve(bottles: Bottle[], crates?: Crate[], width = 250, maxDepth = 150): Move[] | null {
  type Node = { b: Bottle[]; up: Node | null; move: Move | null };
  // Crated bottles keep their place in the key; the rest are interchangeable.
  const fixed = new Set(crates?.map((c) => c.bottle));
  const keyOf = (bs: Bottle[]) => bs.map((b, i) => (fixed.has(i) ? `${i}:` : "") + b.join("")).sort().join("|");
  const path = (n: Node) => {
    const out: Move[] = [];
    for (let c: Node | null = n; c?.move; c = c.up) out.unshift(c.move);
    return out;
  };
  const first: Node = { b: bottles, up: null, move: null };
  if (isWon(bottles)) return [];
  const seen = new Set([keyOf(bottles)]);
  let frontier = [first];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: { n: Node; h: number }[] = [];
    for (const node of frontier) {
      const cur = node.b;
      for (let f = 0; f < cur.length; f++) {
        let triedEmpty = false;
        for (let t = 0; t < cur.length; t++) {
          const n = pourAmount(cur, f, t, crates);
          if (!n) continue;
          if (!cur[t]!.length) {
            // A bottle of one drink gains nothing from an empty one, and empties are all alike.
            if (triedEmpty || cur[f]!.every((d) => d === cur[f]![0])) continue;
            triedEmpty = true;
          }
          const b = applyPour(cur, f, t, n);
          const k = keyOf(b);
          if (seen.has(k)) continue;
          seen.add(k);
          const child: Node = { b, up: node, move: [f, t] };
          if (isWon(b)) return path(child);
          next.push({ n: child, h: mess(b, crates) });
        }
      }
    }
    next.sort((a, b) => a.h - b.h);
    frontier = next.slice(0, width).map((x) => x.n);
  }
  return null;
}

/** Deal a level: four of each drink, mixed into bottles, plus two empty bottles. */
export function dealLevel(seed: string, level: number): Bottle[] {
  const n = drinksFor(level);
  const rng = makeRng(`${seed}:zobo:${level}`);
  for (let attempt = 0; attempt < 40; attempt++) {
    const pool = Array.from({ length: n * CAP }, (_, i) => Math.floor(i / CAP));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const bottles: Bottle[] = Array.from({ length: n }, (_, i) => pool.slice(i * CAP, i * CAP + CAP));
    bottles.push([], []);
    if (!isWon(bottles) && solvable(bottles)) return bottles;
  }
  // Practically never reached; still a fair game: one drink per bottle except two swapped.
  const fallback: Bottle[] = Array.from({ length: n }, (_, i) => Array(CAP).fill(i));
  [fallback[0]![3], fallback[1]![3]] = [fallback[1]![3]!, fallback[0]![3]!];
  return [...fallback, [], []];
}

/** A game outside the career (an old challenge link): a dealt shelf with no stars. */
export function newZobo(seed: string, level: number): ZoboState {
  return { level, bottles: dealLevel(seed, level), moves: 0, undo: [], undosLeft: MAX_UNDO, won: false };
}

/** Island Lounge's pour limit: roomy at first, tight by the end. */
export const pourLimit = (level: number, par: number) => par + Math.max(2, Math.ceil(par * (0.4 - (0.25 * ((level - 1) % LEVELS_PER_STALL)) / (LEVELS_PER_STALL - 1))));

/** A career level, the same for everyone. */
export function newZoboLevel(level: number): ZoboState {
  const data = ZOBO_LEVELS[level - 1]!;
  const bottles: Bottle[] = data.b.split("|").map((x) => [...x].map(Number));
  const stall = stallOf(level);
  return {
    level,
    bottles,
    moves: 0,
    undo: [],
    undosLeft: MAX_UNDO,
    won: false,
    par: data.p,
    ...(stall === 1 ? { covered: bottles.map((b) => Math.max(0, b.length - 1)), undoCovered: [] } : {}),
    ...(data.c ? { crates: data.c.map(([bottle, key]) => ({ bottle, key })) } : {}),
    ...(stall === 4 ? { limit: pourLimit(level, data.p) } : {}),
  };
}

/** Out of pours (Island Lounge): the level has to start again. */
export const outOfPours = (s: ZoboState) => !s.won && s.limit != null && s.moves >= s.limit;

export function pour(s: ZoboState, from: number, to: number): ZoboState | null {
  if (s.won || outOfPours(s)) return null;
  const n = pourAmount(s.bottles, from, to, s.crates);
  if (!n) return null;
  const bottles = applyPour(s.bottles, from, to, n);
  const covered = s.covered?.map((c, i) => Math.min(c, Math.max(0, bottles[i]!.length - 1)));
  return {
    ...s,
    bottles,
    moves: s.moves + 1,
    undo: [...s.undo, s.bottles].slice(-MAX_UNDO),
    won: isWon(bottles),
    ...(covered ? { covered, undoCovered: [...(s.undoCovered ?? []), s.covered!].slice(-MAX_UNDO) } : {}),
  };
}

export function undo(s: ZoboState): ZoboState | null {
  if (s.won || outOfPours(s) || !s.undo.length || s.undosLeft <= 0) return null;
  return {
    ...s,
    bottles: s.undo[s.undo.length - 1]!,
    undo: s.undo.slice(0, -1),
    undosLeft: s.undosLeft - 1,
    moves: s.moves + 1,
    ...(s.covered && s.undoCovered?.length ? { covered: s.undoCovered[s.undoCovered.length - 1]!, undoCovered: s.undoCovered.slice(0, -1) } : {}),
  };
}

/** Bought helper: one more empty bottle for this level. Undo can't reach back past it. */
export function addBottle(s: ZoboState): ZoboState | null {
  if (s.extra || s.won) return null;
  return { ...s, bottles: [...s.bottles, []], extra: true, undo: [], ...(s.covered ? { covered: [...s.covered, 0], undoCovered: [] } : {}) };
}

/* ---- Stars, takings and ranks ---- */

/** Three stars for close to the solver's pours, two for a fair go. An extra bottle tops out at two. */
export function starsFor(par: number, moves: number, extra = false) {
  const s = moves <= par + Math.ceil(par * 0.15) ? 3 : moves <= par + Math.ceil(par * 0.5) ? 2 : 1;
  return extra ? Math.min(2, s) : s;
}

export const levelPay = (level: number) => 200 + level * 20;
/** What a finished level pays. Savings are the sum of these, and the stars can be read back from it. */
export const takings = (level: number, stars: number) => (levelPay(level) * [0, 2, 3, 4][stars]!) / 2;
export const starsOfTakings = (level: number, score: number) => (score >= takings(level, 3) ? 3 : score >= takings(level, 2) ? 2 : score > 0 ? 1 : 0);

/** Outside the career, a game pays by its size. */
export function zoboScore(s: ZoboState): number {
  const par = drinksFor(s.level) * 3;
  return s.level * 100 + Math.max(0, (par * 2 - s.moves) * 10);
}

export const RANKS = [
  { name: "Stall Helper", stars: 0 },
  { name: "Street Seller", stars: 20 },
  { name: "Market Favourite", stars: 60 },
  { name: "Owambe Supplier", stars: 130 },
  { name: "Zobo Chairman", stars: 220 },
] as const;
export const rankFor = (stars: number) => {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (stars >= RANKS[k]!.stars) i = k;
  return { index: i, ...RANKS[i]!, next: RANKS[i + 1] ?? null };
};

/* ---- Your stall: the shop ---- */

export const BOTTLE_LOOKS = [
  { id: "bottle-glass", name: "Clear glass", price: 0, glass: "rgba(220,240,240,.18)", edge: "rgba(40,60,60,.55)", cap: "rgba(200,225,225,.6)" },
  { id: "bottle-amber", name: "Amber", price: 3000, glass: "rgba(214,138,48,.26)", edge: "#7a4614", cap: "#c98a3c" },
  { id: "bottle-green", name: "Palm green", price: 6000, glass: "rgba(70,150,90,.24)", edge: "#245c38", cap: "#4f9a64" },
  { id: "bottle-blue", name: "Lagoon blue", price: 12000, glass: "rgba(70,140,200,.24)", edge: "#1f4f7d", cap: "#5a9bd0" },
  { id: "bottle-gold", name: "Gold rim", price: 25000, glass: "rgba(255,235,180,.2)", edge: "#b8860b", cap: "#f2b632" },
] as const;
export const SHELF_LOOKS = [
  { id: "shelf-wood", name: "Plain wood", price: 0, top: "#a36a33", bottom: "#6b3f17" },
  { id: "shelf-blue", name: "Painted blue", price: 3000, top: "#3f78a8", bottom: "#234b70" },
  { id: "shelf-iroko", name: "Dark iroko", price: 8000, top: "#5c3418", bottom: "#2f1a0b" },
  { id: "shelf-gold", name: "Gold trim", price: 18000, top: "#e0ae35", bottom: "#8f6512" },
] as const;
export const HELPERS = { hint: { name: "Hint", price: 200 }, bottle: { name: "Extra bottle", price: 500 } } as const;
export type HelperId = keyof typeof HELPERS;

const LOOKS = [...BOTTLE_LOOKS, ...SHELF_LOOKS];
/** The price of something in the shop, or null if it isn't sold. Free looks aren't for sale. */
export const lookPrice = (id: string) => {
  const p = LOOKS.find((l) => l.id === id)?.price;
  return p ? p : null;
};
