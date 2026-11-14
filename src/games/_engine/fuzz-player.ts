import type { z } from "zod";
import { replay } from "@/games/chess/logic";
import type { AnyGameLogic } from "./types";

/**
 * A test player for any game, including those without a bot. It reads the game's move schema
 * and tries random moves of the right shape until one is legal: crude, but it plays every game
 * to the end without knowing its rules. Chess gets real legal moves, since random squares are
 * almost never legal. Tests only.
 */
type Rand = () => number;
type Def = { type: string; [k: string]: unknown };
const defOf = (s: unknown): Def => (s as { _zod: { def: Def } })._zod.def;

export type FuzzHints = { players: string[]; words: string[] };

function bounds(def: Def): { min: number; max: number } {
  let min = -2;
  let max = 20;
  for (const c of (def.checks as { _zod: { def: { check: string; value: number; inclusive?: boolean } } }[] | undefined) ?? []) {
    const d = c._zod.def;
    if (d.check === "greater_than") min = d.value + (d.inclusive ? 0 : 1);
    if (d.check === "less_than") max = d.value - (d.inclusive ? 0 : 1);
  }
  return { min, max: Math.min(max, min + 120) };
}

export function randomOf(schema: unknown, rand: Rand, hints: FuzzHints, depth = 0): unknown {
  const def = defOf(schema);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  switch (def.type) {
    case "literal":
      return pick(def.values as unknown[]);
    case "enum":
      return pick(Object.values(def.entries as Record<string, unknown>));
    case "boolean":
      return rand() < 0.5;
    case "number":
    case "int": {
      const { min, max } = bounds(def);
      // Mostly small numbers: indexes, columns, choices.
      const hi = rand() < 0.8 ? Math.min(max, min + 10) : max;
      return min + Math.floor(rand() * (hi - min + 1));
    }
    case "string": {
      if (def.format === "uuid" || def.format === "guid") return pick(hints.players);
      const r = rand();
      return r < 0.45 ? pick(hints.words) : r < 0.75 ? pick(["yes", "no", "a", "ok", "test answer", "Jollof", "Lagos"]) : pick(hints.words).toUpperCase();
    }
    case "optional":
      return rand() < 0.4 ? undefined : randomOf(def.innerType, rand, hints, depth + 1);
    case "nullable":
      return rand() < 0.2 ? null : randomOf(def.innerType, rand, hints, depth + 1);
    case "default":
    case "prefault":
    case "readonly":
    case "catch":
      return randomOf(def.innerType, rand, hints, depth + 1);
    case "pipe":
      return randomOf(def.in, rand, hints, depth + 1);
    case "union":
      return randomOf(pick(def.options as unknown[]), rand, hints, depth + 1);
    case "array": {
      let lo = 1;
      let hi = 3;
      for (const c of (def.checks as { _zod: { def: { check: string; minimum?: number; maximum?: number; length?: number } } }[] | undefined) ?? []) {
        const d = c._zod.def;
        if (d.check === "min_length" && d.minimum != null) lo = d.minimum;
        if (d.check === "max_length" && d.maximum != null) hi = d.maximum;
        if (d.check === "length_equals" && d.length != null) lo = hi = d.length;
      }
      hi = Math.max(lo, Math.min(hi, lo + 2));
      const n = depth > 3 ? lo : lo + Math.floor(rand() * (hi - lo + 1));
      return Array.from({ length: n }, () => randomOf(def.element, rand, hints, depth + 1));
    }
    case "tuple":
      return (def.items as unknown[]).map((i) => randomOf(i, rand, hints, depth + 1));
    case "object": {
      const shape = def.shape as Record<string, unknown>;
      return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, randomOf(v, rand, hints, depth + 1)]).filter(([, v]) => v !== undefined));
    }
    case "record":
      return {};
    default:
      return undefined;
  }
}

/** A legal move for `by`, or null if none was found. */
export function fuzzMove(logic: AnyGameLogic, s: unknown, by: string, ctx: { now: number }, rand: Rand, hints: FuzzHints, tries = 300): unknown | null {
  if (logic.id === "chess") {
    const st = s as { moves: string[]; players: string[]; white: number };
    const board = replay(st.moves);
    const mover = st.players[board.turn() === "w" ? st.white : 1 - st.white];
    if (mover !== by) return null;
    const legal = board.moves({ verbose: true });
    if (!legal.length) return null;
    const m = legal[Math.floor(rand() * legal.length)]!;
    return { kind: "move", from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) };
  }
  const schema = logic.moveSchema as z.ZodType;
  for (let i = 0; i < tries; i++) {
    const raw = randomOf(schema, rand, hints);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) continue;
    try {
      if (logic.validateMove(s as never, parsed.data as never, by, ctx as never)) return parsed.data;
    } catch {
      // Not legal here.
    }
  }
  return null;
}
