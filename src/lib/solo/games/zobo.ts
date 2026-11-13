import { makeRng } from "@/games/_engine/rng";

/**
 * Zobo Sort: pour drinks between bottles until each bottle holds one drink. You can pour onto the
 * same drink or into an empty bottle, as much as fits. Levels add drinks as you go; every level
 * dealt is checked to be solvable. Pure and seeded.
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
export type ZoboState = { level: number; bottles: Bottle[]; moves: number; undo: Bottle[][]; undosLeft: number; won: boolean };

export const drinksFor = (level: number) => Math.min(DRINKS.length, 3 + Math.ceil(level / 2));

const solvedBottle = (b: Bottle) => b.length === 0 || (b.length === CAP && b.every((d) => d === b[0]));
export const isWon = (bottles: Bottle[]) => bottles.every(solvedBottle);

/** How many units would pour from one bottle to another (0 = not allowed). */
export function pourAmount(bottles: Bottle[], from: number, to: number): number {
  if (from === to) return 0;
  const a = bottles[from]!, b = bottles[to]!;
  if (!a.length || b.length >= CAP) return 0;
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

export function newZobo(seed: string, level: number): ZoboState {
  return { level, bottles: dealLevel(seed, level), moves: 0, undo: [], undosLeft: MAX_UNDO, won: false };
}

export function pour(s: ZoboState, from: number, to: number): ZoboState | null {
  if (s.won) return null;
  const n = pourAmount(s.bottles, from, to);
  if (!n) return null;
  const bottles = applyPour(s.bottles, from, to, n);
  return { ...s, bottles, moves: s.moves + 1, undo: [...s.undo, s.bottles].slice(-MAX_UNDO), won: isWon(bottles) };
}

export function undo(s: ZoboState): ZoboState | null {
  if (s.won || !s.undo.length || s.undosLeft <= 0) return null;
  return { ...s, bottles: s.undo[s.undo.length - 1]!, undo: s.undo.slice(0, -1), undosLeft: s.undosLeft - 1, moves: s.moves + 1 };
}

/** Bigger levels pay more; a tidy solve pays a little extra. */
export function zoboScore(s: ZoboState): number {
  const par = drinksFor(s.level) * 3;
  return s.level * 100 + Math.max(0, (par * 2 - s.moves) * 10);
}
