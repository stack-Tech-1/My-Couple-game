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

/**
 * How a rush plays. Quick rushes use a difficulty; career days each have their own. Kept inside
 * the state so a saved game carries its rules with it.
 */
export type MamaConfig = {
  /** Length of the rush in seconds. */
  seconds: number;
  /** What's cooking today: orders only use these. */
  menu: readonly Item[];
  /** Patience multiplier (1 = normal; higher is kinder). */
  patience: number;
  /** Time between customers multiplier (1 = normal; higher is calmer). */
  pace: number;
  /** Chance of sides (dodo, moin moin, a drink) multiplier. */
  extras: number;
  /** Naira for one, two and three stars. */
  stars: readonly [number, number, number];
  /** Seconds for dodo to fry, and how long it waits before burning (kitchen upgrades). */
  fry?: number;
  burn?: number;
  /** Tip multiplier (the tip jar). */
  tips?: number;
  /** Shop upgrades in play, so the buka can show them. */
  owned?: readonly UpgradeId[];
};

/**
 * Shop upgrades, bought with Mama Put savings (all the naira you've taken in). They only count
 * in the career: quick rushes are the same for everyone, so their leaderboards stay fair.
 * Ambience keeps customers patient on the harder days: no help in Yaba, growing through Ikeja
 * and Surulere, in full from Lekki. Kitchen upgrades help every day.
 */
export const UPGRADES = [
  { id: "fan", name: "Standing fan", price: 15000, kind: "vibe", patience: 0.05, about: "Cool breeze: customers wait 5% longer." },
  { id: "chairs", name: "Chairs and table", price: 25000, kind: "vibe", patience: 0.05, about: "A seat while they wait: 5% more patience." },
  { id: "radio", name: "Radio", price: 35000, kind: "vibe", patience: 0.06, about: "Music playing: 6% more patience." },
  { id: "tv", name: "TV with football", price: 60000, kind: "vibe", patience: 0.08, about: "Match on the screen: 8% more patience." },
  { id: "generator", name: "Generator", price: 90000, kind: "vibe", patience: 0.08, about: "Light no go off: 8% more patience." },
  { id: "paint", name: "Fresh paint and bunting", price: 120000, kind: "vibe", patience: 0.08, about: "A buka people love: 8% more patience." },
  { id: "big-pan", name: "Big frying pan", price: 30000, kind: "kitchen", patience: 0, about: "Dodo fries a third faster." },
  { id: "non-stick", name: "Non-stick pan", price: 45000, kind: "kitchen", patience: 0, about: "Dodo takes much longer to burn." },
  { id: "tip-jar", name: "Tip jar", price: 50000, kind: "kitchen", patience: 0, about: "10% more in tips." },
] as const;
export type UpgradeId = (typeof UPGRADES)[number]["id"];
export const isUpgrade = (id: string): id is UpgradeId => UPGRADES.some((u) => u.id === id);

/** How much ambience counts on a career day: 0 in Yaba, rising to full by Lekki (day 19). */
export const vibeWeight = (day: number) => (day <= 6 ? 0 : day >= 19 ? 1 : (day - 6) / 13);

/** A career day's rules with the shop's upgrades applied. */
export function withUpgrades(cfg: MamaConfig, day: number, owned: readonly string[]): MamaConfig {
  const have = UPGRADES.filter((u) => owned.includes(u.id));
  if (!have.length) return cfg;
  const vibe = have.reduce((t, u) => t + u.patience, 0) * vibeWeight(day);
  return {
    ...cfg,
    patience: cfg.patience * (1 + vibe),
    fry: owned.includes("big-pan") ? FRY_SECONDS / 1.5 : cfg.fry,
    burn: owned.includes("non-stick") ? BURN_AFTER * 1.7 : cfg.burn,
    tips: owned.includes("tip-jar") ? 1.1 : cfg.tips,
    owned: have.map((u) => u.id),
  };
}

export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_NAME: Record<Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };

const FULL_MENU = ITEMS;
export const QUICK: Record<Difficulty, MamaConfig> = {
  // Normal keeps the stars it has always had, so old scores still read the same.
  easy: { seconds: 90, menu: FULL_MENU, patience: 1.45, pace: 1.3, extras: 0.6, stars: [4000, 8000, 12000] },
  normal: { seconds: 90, menu: FULL_MENU, patience: 1, pace: 1, extras: 1, stars: [4000, 9000, 15000] },
  hard: { seconds: 90, menu: FULL_MENU, patience: 0.72, pace: 0.8, extras: 1.3, stars: [6000, 11000, 17000] },
};

/** Career: 30 days across Lagos. New dishes join the menu as you go; patience gets shorter. */
export const AREAS = ["Yaba", "Ikeja", "Surulere", "Lekki", "Victoria Island"] as const;
export const DAYS = 30;
/** The day each dish joins the menu. */
const UNLOCK: Record<Item, number> = { jollof: 1, chicken: 1, drink: 1, beef: 2, rice: 3, stew: 3, dodo: 5, fish: 7, eba: 9, egusi: 9, moin: 13 };
export const newOnDay = (day: number) => ITEMS.filter((x) => UNLOCK[x] === day);
export const areaOf = (day: number) => AREAS[Math.min(AREAS.length - 1, Math.floor((day - 1) / 6))]!;

export function careerDay(day: number): MamaConfig {
  const d = Math.max(1, Math.min(DAYS, Math.round(day)));
  const t = (d - 1) / (DAYS - 1); // 0 on day 1, 1 on day 30
  const seconds = d <= 3 ? 60 : d <= 12 ? 75 : 90;
  const menu = ITEMS.filter((x) => UNLOCK[x] <= d);
  return { seconds, menu, patience: 1.5 - t * 0.85, pace: 1.4 - t * 0.65, extras: 0.5 + t * 0.9, stars: DAY_STARS[d - 1]! };
}

/**
 * Star targets per day, measured by playing every day with the test player in mama-levels.test:
 * one star for a slow player (1.3s a tap), two for a good one (1s), three for a sharp one (0.7s),
 * kept so two stars sit at 60 to 80% of three and one star at 35 to 60%. Days 1 to 3 are
 * learning days and ask 20% less; days 10 to 12 ask ₦6,000 for one star, so even a slow player
 * can get through Yaba and Ikeja. Re-measure if the rules above change.
 */
const DAY_STARS: readonly (readonly [number, number, number])[] = [
  [4700, 6300, 7900], [4500, 5900, 7400], [4900, 6500, 8100],
  [7700, 10300, 12900], [8000, 10700, 13400], [8000, 10700, 13400], [8200, 10900, 13600], [8200, 11000, 13700], [8200, 11300, 14100],
  [6000, 11600, 14500], [6000, 11400, 15000], [6000, 12000, 15000], [9400, 14100, 17700], [8600, 14100, 18400], [8900, 14300, 19000],
  [8000, 13900, 18400], [9200, 13900, 18900], [8000, 13300, 19000], [7700, 13200, 19000], [7000, 13100, 18700], [7000, 12200, 18100],
  [6900, 11900, 18600], [6600, 12600, 18800], [6100, 10800, 17400], [6300, 10900, 18100], [6400, 11000, 18400], [6100, 10400, 17300],
  [6100, 10400, 17300], [6100, 10400, 17300], [6100, 10400, 17300],
];

/**
 * The rules for a mode: "easy" | "normal" | "hard" | "day-N". Anything else plays Normal. Shop
 * upgrades only apply to career days.
 */
export function configFor(mode: string, owned: readonly string[] = []): MamaConfig {
  const day = /^day-(\d{1,2})$/.exec(mode);
  if (day) return withUpgrades(careerDay(Number(day[1])), Number(day[1]), owned);
  return QUICK[(DIFFICULTIES as readonly string[]).includes(mode) ? (mode as Difficulty) : "normal"];
}

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
  /** Missing on games saved before difficulties existed: those play Normal. */
  cfg?: MamaConfig;
};

export const rulesOf = (s: Pick<MamaState, "cfg">): MamaConfig => s.cfg ?? QUICK.normal;
export const rushSeconds = (s: Pick<MamaState, "cfg">) => rulesOf(s).seconds;

export function newMama(seed: string, cfg: MamaConfig = QUICK.normal): MamaState {
  return { time: 0, spots: [null, null, null], plates: [[], [], []], selected: 0, fry: { stage: "idle", t: 0 }, money: 0, served: 0, lost: 0, nextArrival: 0.8, nextId: 1, cursor: makeRng(seed).cursor(), over: false, cfg };
}

/** How far into the rush, 0 to 1. */
const progress = (s: Pick<MamaState, "time" | "cfg">) => Math.min(1, s.time / rushSeconds(s));

function makeOrder(rng: { next: () => number; int: (n: number) => number }, p: number, cfg: MamaConfig): Item[] {
  const on = (x: Item) => cfg.menu.includes(x);
  // Rice comes with stew and eba with egusi, so each base needs its partner on the menu.
  const bases = (["jollof", "rice", "eba"] as const).filter((b) => on(b) && (b !== "rice" || on("stew")) && (b !== "eba" || on("egusi")));
  // Early in a full-menu rush, keep to the two simplest bases.
  const pool = bases.length === 3 && p < 0.15 ? bases.slice(0, 2) : bases;
  const base = pool.length ? pool[rng.int(pool.length)]! : "jollof";
  const out: Item[] = [base];
  if (base === "rice") out.push("stew");
  if (base === "eba") out.push("egusi");
  const proteins = (["beef", "chicken", "fish"] as const).filter(on);
  if (proteins.length) out.push(proteins[rng.int(proteins.length)]!);
  if (on("dodo") && rng.next() < (0.25 + p * 0.4) * cfg.extras) out.push("dodo");
  if (on("moin") && rng.next() < p * 0.35 * cfg.extras) out.push("moin");
  if (on("drink") && rng.next() < (0.1 + p * 0.35) * cfg.extras) out.push("drink");
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
  const rules = rulesOf(s);
  if (f.stage === "frying") s.fry = f.t + dt >= (rules.fry ?? FRY_SECONDS) ? { stage: "ready", t: 0 } : { stage: "frying", t: f.t + dt };
  else if (f.stage === "ready") s.fry = f.t + dt >= (rules.burn ?? BURN_AFTER) ? { stage: "burnt", t: 0 } : { stage: "ready", t: f.t + dt };
  // Someone new walks in.
  const free = s.spots.findIndex((c) => !c);
  const cfg = rulesOf(s);
  if (free >= 0 && s.time >= s.nextArrival && s.time < cfg.seconds - 6) {
    const rng = makeRng(seed, s.cursor);
    const p = progress(s);
    const order = makeOrder(rng, p, cfg);
    const max = (30 - p * 12 + order.length * 2) * cfg.patience;
    s.spots[free] = { id: s.nextId, order, patience: max, max, look: { skin: rng.int(4), style: rng.int(4), cloth: rng.int(6) }, arrived: s.time, leaving: null };
    s.nextId++;
    s.nextArrival = s.time + (6.5 - p * 3.5) * (0.7 + rng.next() * 0.6) * cfg.pace;
    s.cursor = rng.cursor();
    if (!s.spots[s.selected] || s.spots[s.selected]!.leaving) s.selected = free;
  }
  if (s.time >= cfg.seconds) s.over = true;
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
  const tip = right ? Math.round((price * 0.3 * (c.patience / c.max) * (rulesOf(s).tips ?? 1)) / 50) * 50 : 0;
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

/** Stars for the day's takings (Normal quick rush, unless a rush's own rules are given). */
export const STAR_AT = QUICK.normal.stars;
export const stars = (money: number, cfg: MamaConfig = QUICK.normal) => cfg.stars.filter((x) => money >= x).length;
