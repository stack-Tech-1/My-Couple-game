import { makeRng } from "@/games/_engine/rng";

/**
 * Mama Put: a 90-second lunch rush at the buka. Customers come to the counter with an order; dish
 * it onto their plate and serve it before they lose patience. Right plate: you're paid, plus a tip
 * for being quick. Wrong plate: they leave without paying. Dodo has to be fried first, and it burns
 * if you leave it. Orders get bigger and patience shorter as the rush goes on.
 *
 * Pure and seeded. Time moves in `tick`.
 */
export const SPOTS = 3;
export const RUSH_SECONDS = 90;
export const FRY_SECONDS = 3;
export const BURN_AFTER = 7;
export const LEAVE_SECONDS = 0.8;

export const ITEMS = ["jollof", "rice", "eba", "stew", "egusi", "beef", "chicken", "fish", "dodo", "moin", "drink"] as const;
export type Item = (typeof ITEMS)[number];
export const ITEM_NAME: Record<Item, string> = { jollof: "Jollof", rice: "White rice", eba: "Eba", stew: "Stew", egusi: "Egusi", beef: "Beef", chicken: "Chicken", fish: "Fish", dodo: "Dodo", moin: "Moin moin", drink: "Cold drink" };
export const PRICE: Record<Item, number> = { jollof: 500, rice: 400, eba: 300, stew: 200, egusi: 300, beef: 300, chicken: 500, fish: 400, dodo: 200, moin: 250, drink: 300 };

export type Look = { skin: number; style: number; cloth: number };
export type Customer = { id: number; order: Item[]; patience: number; max: number; look: Look; arrived: number; leaving: { at: number; paid: number } | null };
export type Fry = { stage: "idle" | "frying" | "ready" | "burnt"; t: number };
export type MamaState = {
  time: number;
  spots: (Customer | null)[];
  plates: Item[][];
  selected: number;
  fry: Fry;
  money: number;
  served: number;
  lost: number;
  nextArrival: number;
  nextId: number;
  cursor: number;
  over: boolean;
};

export function newMama(seed: string): MamaState {
  return { time: 0, spots: [null, null, null], plates: [[], [], []], selected: 0, fry: { stage: "idle", t: 0 }, money: 0, served: 0, lost: 0, nextArrival: 0.8, nextId: 1, cursor: makeRng(seed).cursor(), over: false };
}

/** How far into the rush, 0 to 1. */
const progress = (s: Pick<MamaState, "time">) => Math.min(1, s.time / RUSH_SECONDS);

function makeOrder(rng: { next: () => number; int: (n: number) => number }, p: number): Item[] {
  const base = (["jollof", "rice", "eba"] as const)[rng.int(p < 0.15 ? 2 : 3)]!;
  const out: Item[] = [base];
  if (base === "rice") out.push("stew");
  if (base === "eba") out.push("egusi");
  out.push((["beef", "chicken", "fish"] as const)[rng.int(3)]!);
  if (rng.next() < 0.25 + p * 0.4) out.push("dodo");
  if (rng.next() < p * 0.35) out.push("moin");
  if (rng.next() < 0.1 + p * 0.35) out.push("drink");
  return out;
}

const sameOrder = (a: Item[], b: Item[]) => a.length === b.length && a.every((x) => b.includes(x));
export const orderPrice = (o: Item[]) => o.reduce((t, x) => t + PRICE[x], 0);

/** Time passes: patience runs down, the pan fries, customers come and go. */
export function tick(seed: string, s0: MamaState, dt: number): MamaState {
  if (s0.over) return s0;
  const s: MamaState = { ...s0, time: s0.time + dt, spots: [...s0.spots] };
  // Customers.
  for (let i = 0; i < SPOTS; i++) {
    const c = s.spots[i];
    if (!c) continue;
    if (c.leaving) {
      if (s.time - c.leaving.at >= LEAVE_SECONDS) s.spots[i] = null;
      continue;
    }
    const patience = c.patience - dt;
    if (patience <= 0) {
      s.spots[i] = { ...c, patience: 0, leaving: { at: s.time, paid: 0 } };
      s.lost++;
      s.plates = s.plates.map((pl, j) => (j === i ? [] : pl));
    } else s.spots[i] = { ...c, patience };
  }
  // The frying pan.
  const f = s.fry;
  if (f.stage === "frying") s.fry = f.t + dt >= FRY_SECONDS ? { stage: "ready", t: 0 } : { stage: "frying", t: f.t + dt };
  else if (f.stage === "ready") s.fry = f.t + dt >= BURN_AFTER ? { stage: "burnt", t: 0 } : { stage: "ready", t: f.t + dt };
  // Someone new walks in.
  const free = s.spots.findIndex((c) => !c);
  if (free >= 0 && s.time >= s.nextArrival && s.time < RUSH_SECONDS - 6) {
    const rng = makeRng(seed, s.cursor);
    const p = progress(s);
    const max = 30 - p * 12;
    const order = makeOrder(rng, p);
    s.spots[free] = { id: s.nextId, order, patience: max + order.length * 2, max: max + order.length * 2, look: { skin: rng.int(4), style: rng.int(4), cloth: rng.int(6) }, arrived: s.time, leaving: null };
    s.nextId++;
    s.nextArrival = s.time + (6.5 - p * 3.5) * (0.7 + rng.next() * 0.6);
    s.cursor = rng.cursor();
    if (!s.spots[s.selected] || s.spots[s.selected]!.leaving) s.selected = free;
  }
  if (s.time >= RUSH_SECONDS) s.over = true;
  return s;
}

export const waiting = (c: Customer | null | undefined): c is Customer => !!c && !c.leaving;

export function select(s: MamaState, i: number): MamaState {
  return i >= 0 && i < SPOTS ? { ...s, selected: i } : s;
}

/** Put something on the selected plate. Dodo has to be fried and ready. */
export function add(s: MamaState, item: Item): { state: MamaState; ok: boolean; why?: "fry" | "full" | "twice" } {
  if (s.over) return { state: s, ok: false };
  const plate = s.plates[s.selected]!;
  if (plate.includes(item)) return { state: s, ok: false, why: "twice" };
  if (plate.length >= 6) return { state: s, ok: false, why: "full" };
  let fry = s.fry;
  if (item === "dodo") {
    if (fry.stage !== "ready") return { state: s, ok: false, why: "fry" };
    fry = { stage: "idle", t: 0 };
  }
  const plates = s.plates.map((p, j) => (j === s.selected ? [...p, item] : p));
  return { state: { ...s, plates, fry }, ok: true };
}

/** Start frying (a burnt batch goes in the bin first). */
export function fry(s: MamaState): MamaState {
  if (s.fry.stage === "idle" || s.fry.stage === "burnt") return { ...s, fry: { stage: "frying", t: 0 } };
  return s;
}

export function bin(s: MamaState): MamaState {
  return { ...s, plates: s.plates.map((p, j) => (j === s.selected ? [] : p)) };
}

/** Hand plate i to the customer in front of it. Paid (with a tip for speed) only if it's right. */
export function serve(s: MamaState, i: number): { state: MamaState; paid: number; tip: number; right: boolean } {
  const c = s.spots[i];
  const plate = s.plates[i]!;
  if (!waiting(c) || !plate.length || s.over) return { state: s, paid: 0, tip: 0, right: false };
  const right = sameOrder(plate, c.order);
  const price = right ? orderPrice(c.order) : 0;
  const tip = right ? Math.round((price * 0.3 * (c.patience / c.max)) / 50) * 50 : 0;
  const spots = s.spots.map((x, j) => (j === i ? { ...c, leaving: { at: s.time, paid: price + tip } } : x));
  const plates = s.plates.map((p, j) => (j === i ? [] : p));
  // Move the selection to someone still waiting.
  const next = spots.findIndex((x, j) => j !== i && waiting(x));
  return {
    state: { ...s, spots, plates, money: s.money + price + tip, served: s.served + (right ? 1 : 0), lost: s.lost + (right ? 0 : 1), selected: next >= 0 ? next : s.selected },
    paid: price,
    tip,
    right,
  };
}

/** Stars for the day's takings. */
export const STAR_AT = [4000, 9000, 15000] as const;
export const stars = (money: number) => STAR_AT.filter((x) => money >= x).length;
