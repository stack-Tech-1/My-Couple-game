import { makeRng } from "@/games/_engine/rng";

/**
 * Mama Put: a 90-second lunch rush at the buka. Customers come to the counter with an order; dish
 * it onto their plate and serve it before they lose patience. Right plate: you're paid, plus a tip
 * for being quick. Wrong plate: they leave without paying. Dodo has to be fried first, and it burns
 * if you leave it, and the gas runs out: a new cylinder comes out of the day's takings. Orders get
 * bigger and patience shorter as the rush goes on. A first-ever day starts with a tutorial: one
 * customer, no clock, until they're served.
 *
 * Pure and seeded. Time moves in `tick`.
 */
export const SPOTS = 4;
export const RUSH_SECONDS = 90;
export const FRY_SECONDS = 3;
export const BURN_AFTER = 7;
export const LEAVE_SECONDS = 0.8;
/** Seconds of flame in a full cylinder, and what a refill costs (Yaba prices). */
export const GAS_SECONDS = 30;
export const GAS_PRICE = 800;
/** The tutorial customer's order: one of everything on day 1's menu. */
export const TUTORIAL_ORDER = ["jollof", "chicken", "drink"] as const;

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
  /** Seconds of flame in a cylinder, and a refill's price. */
  gas?: number;
  gasPrice?: number;
  /** Start with the one-customer tutorial. */
  tutorial?: boolean;
};

/**
 * Shop upgrades, bought with Mama Put savings (all the naira you've taken in). Each area is its
 * own restaurant, so each starts bare and is kitted out on its own, at that area's prices. They
 * only count in the career: quick rushes are the same for everyone, so their leaderboards stay
 * fair. Ambience keeps customers patient (half strength in Yaba, three quarters in Ikeja, in
 * full from Surulere); kitchen upgrades help every day.
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

/** Which area a career day is in: 0 Yaba … 4 Victoria Island. */
export const areaIndex = (day: number) => Math.max(0, Math.min(AREAS.length - 1, Math.floor((day - 1) / 6)));
/** Upgrades cost more in the fancier areas. */
export const AREA_PRICE = [1, 1.5, 2, 3, 4] as const;
export const upgradePrice = (area: number, id: UpgradeId) => Math.round((UPGRADES.find((u) => u.id === id)!.price * (AREA_PRICE[area] ?? 1)) / 500) * 500;
/** How much ambience counts in each area. */
const AREA_VIBE = [0.5, 0.75, 1, 1, 1] as const;
export const vibeWeight = (day: number) => AREA_VIBE[areaIndex(day)] ?? 1;
/** Career days that never use a free play: the whole of Yaba, so new players can get hooked. */
export const FREE_CAREER_MODES = ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6"] as const;
/** A career day opens once the day before has at least one star. */
export const dayOpen = (day: number, best: (day: number) => number | undefined) => day <= 1 || (best(day - 1) ?? 0) >= careerDay(day - 1).stars[0];

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
  // Measured with the test player like the career days (see DAY_STARS).
  easy: { seconds: 90, menu: FULL_MENU, patience: 1.7, pace: 1.45, extras: 0.6, stars: [8600, 11600, 14500] },
  normal: { seconds: 90, menu: FULL_MENU, patience: 1.25, pace: 1.2, extras: 1, stars: [6600, 12100, 17300] },
  hard: { seconds: 90, menu: FULL_MENU, patience: 0.95, pace: 1, extras: 1.3, stars: [5600, 9700, 16100] },
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
  return { seconds, menu, patience: 1.6 - t * 0.55, pace: 1.5 - t * 0.45, extras: 0.5 + t * 0.9, stars: DAY_STARS[d - 1]!, gasPrice: Math.round((GAS_PRICE * (AREA_PRICE[areaIndex(d)] ?? 1)) / 100) * 100 };
}

/**
 * Star targets per day, measured by playing every day with the test player in mama-levels.test
 * (four customers at the counter, gas included): one star for a slow player (1.3s a tap), two for
 * a good one (1s), three for a sharp one (0.7s), kept so two stars sit at 60 to 80% of three and
 * one star at 35 to 60%. Through Ikeja, one star is also in reach of a very slow player (1.6s).
 * Days 1 to 3 are learning days and ask 20% less. Re-measure if the rules above change.
 */
const DAY_STARS: readonly (readonly [number, number, number])[] = [
  [4400, 5800, 7300], [4000, 5400, 6700], [4200, 5500, 6900], [6800, 9100, 11400], [7300, 9800, 12200], [7300, 9800, 12200],
  [7500, 10000, 12500], [7500, 10000, 12500], [7000, 10500, 13100], [6900, 10500, 13100], [6900, 10500, 13100], [6300, 10700, 14200],
  [7900, 12700, 15900], [7000, 11600, 14800], [7000, 12500, 15600], [7600, 12100, 15900], [7600, 12700, 17000], [8000, 12600, 17000],
  [7600, 12600, 17300], [6600, 12600, 17000], [6900, 11500, 17100], [6900, 11300, 17100], [6800, 11400, 15600], [5900, 12100, 16700],
  [6000, 10300, 17200], [6000, 10600, 17200], [5600, 10600, 16100], [6200, 10800, 17600], [5700, 9700, 16200], [6100, 10400, 17400],
];

/**
 * The rules for a mode: "easy" | "normal" | "hard" | "day-N". Anything else plays Normal. Shop
 * upgrades only apply to career days.
 */
export function configFor(mode: string, owned: readonly string[] = [], opts: { tutorial?: boolean } = {}): MamaConfig {
  const day = /^day-(\d{1,2})$/.exec(mode);
  if (day) {
    const cfg = withUpgrades(careerDay(Number(day[1])), Number(day[1]), owned);
    // The tutorial only ever runs on a first go at day 1.
    return opts.tutorial && Number(day[1]) === 1 ? { ...cfg, tutorial: true } : cfg;
  }
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
  /** Seconds of flame left in the cylinder (missing: full). */
  gas?: number;
  /** Cylinders bought today. */
  refills?: number;
  /** In the tutorial; and how long it took, which doesn't count against the rush. */
  tut?: boolean;
  tutTime?: number;
};

export const rulesOf = (s: Pick<MamaState, "cfg">): MamaConfig => s.cfg ?? QUICK.normal;
export const rushSeconds = (s: Pick<MamaState, "cfg">) => rulesOf(s).seconds;

export function newMama(seed: string, cfg: MamaConfig = QUICK.normal): MamaState {
  const spots: (Customer | null)[] = Array.from({ length: SPOTS }, () => null);
  return { time: 0, spots, plates: spots.map(() => []), selected: 0, fry: { stage: "idle", t: 0 }, money: 0, served: 0, lost: 0, nextArrival: 0.8, nextId: 1, cursor: makeRng(seed).cursor(), over: false, cfg, gas: cfg.gas ?? GAS_SECONDS, refills: 0, tut: !!cfg.tutorial, tutTime: 0 };
}

/** Rush seconds gone (the tutorial's time doesn't count). */
export const rushTime = (s: Pick<MamaState, "time" | "tutTime">) => s.time - (s.tutTime ?? 0);
/** How far into the rush, 0 to 1. */
const progress = (s: Pick<MamaState, "time" | "cfg" | "tutTime">) => Math.min(1, rushTime(s) / rushSeconds(s));

export const gasMax = (s: Pick<MamaState, "cfg">) => rulesOf(s).gas ?? GAS_SECONDS;
export const gasLeft = (s: Pick<MamaState, "cfg" | "gas">) => s.gas ?? gasMax(s);
export const gasPrice = (s: Pick<MamaState, "cfg">) => rulesOf(s).gasPrice ?? GAS_PRICE;
/** The flame burns while dodo is frying or waiting in the pan. */
const flameOn = (f: Fry) => f.stage === "frying" || f.stage === "ready";

/** Buy a new cylinder out of today's takings. */
export function buyGas(s: MamaState): { state: MamaState; ok: boolean } {
  const price = gasPrice(s);
  if (s.over || s.money < price || gasLeft(s) >= gasMax(s)) return { state: s, ok: false };
  return { state: { ...s, money: s.money - price, gas: gasMax(s), refills: (s.refills ?? 0) + 1 }, ok: true };
}

/** The tutorial's next step, for the hints: null once it's over. */
export function tutorialStep(s: MamaState): { kind: "wait" } | { kind: "plate" } | { kind: "add"; item: Item } | { kind: "bin" } | { kind: "serve" } | null {
  if (!s.tut) return null;
  const c = s.spots[0];
  if (!waiting(c)) return { kind: "wait" };
  if (s.selected !== 0) return { kind: "plate" };
  const plate = s.plates[0]!;
  if (plate.some((it) => !c.order.includes(it))) return { kind: "bin" };
  const missing = c.order.find((it) => !plate.includes(it));
  return missing ? { kind: "add", item: missing } : { kind: "serve" };
}

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
  // The tutorial: time doesn't count, and nobody loses patience.
  if (s.tut) s.tutTime = (s.tutTime ?? 0) + dt;
  // Customers.
  for (let i = 0; i < SPOTS; i++) {
    const c = s.spots[i];
    if (!c) continue;
    if (c.leaving) {
      if (s.time - c.leaving.at >= LEAVE_SECONDS) s.spots[i] = null;
      continue;
    }
    const patience = s.tut ? c.patience : c.patience - dt;
    if (patience <= 0) {
      s.spots[i] = { ...c, patience: 0, leaving: { at: s.time, paid: 0 } };
      s.lost++;
      s.plates = s.plates.map((pl, j) => (j === i ? [] : pl));
    } else s.spots[i] = { ...c, patience };
  }
  // The frying pan: only moves while there's gas for the flame.
  const f = s.fry;
  const rules = rulesOf(s);
  const gas = gasLeft(s);
  if (flameOn(f) && gas > 0) {
    s.gas = Math.max(0, gas - dt);
    if (f.stage === "frying") s.fry = f.t + dt >= (rules.fry ?? FRY_SECONDS) ? { stage: "ready", t: 0 } : { stage: "frying", t: f.t + dt };
    else s.fry = f.t + dt >= (rules.burn ?? BURN_AFTER) ? { stage: "burnt", t: 0 } : { stage: "ready", t: f.t + dt };
  }
  // Someone new walks in. In the tutorial, just the one customer at the first place.
  const cfg = rulesOf(s);
  const free = s.tut ? (s.spots[0] ? -1 : 0) : s.spots.findIndex((c) => !c);
  if (free >= 0 && (s.tut || (s.time >= s.nextArrival && rushTime(s) < cfg.seconds - 6))) {
    const rng = makeRng(seed, s.cursor);
    const p = progress(s);
    const order: Item[] = s.tut ? [...TUTORIAL_ORDER] : makeOrder(rng, p, cfg);
    const max = (30 - p * 12 + order.length * 2) * cfg.patience;
    s.spots[free] = { id: s.nextId, order, patience: max, max, look: { skin: rng.int(4), style: rng.int(4), cloth: rng.int(6) }, arrived: s.time, leaving: null };
    s.nextId++;
    s.nextArrival = s.time + (6.5 - p * 3.5) * (0.7 + rng.next() * 0.6) * cfg.pace;
    s.cursor = rng.cursor();
    if (!s.spots[s.selected] || s.spots[s.selected]!.leaving) s.selected = free;
  }
  if (!s.tut && rushTime(s) >= cfg.seconds) s.over = true;
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

/** Start frying (a burnt batch goes in the bin first). Needs gas. */
export function fry(s: MamaState): MamaState {
  if ((s.fry.stage === "idle" || s.fry.stage === "burnt") && gasLeft(s) > 0) return { ...s, fry: { stage: "frying", t: 0 } };
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
    state: {
      ...s,
      spots,
      plates,
      money: s.money + price + tip,
      served: s.served + (right ? 1 : 0),
      lost: s.lost + (right ? 0 : 1),
      selected: next >= 0 ? next : s.selected,
      // The tutorial ends with the first right plate; the rush starts a moment later.
      ...(s.tut && right ? { tut: false, nextArrival: s.time + 1.5 } : {}),
    },
    paid: price,
    tip,
    right,
  };
}

/** Stars for the day's takings (Normal quick rush, unless a rush's own rules are given). */
export const STAR_AT = QUICK.normal.stars;
export const stars = (money: number, cfg: MamaConfig = QUICK.normal) => cfg.stars.filter((x) => money >= x).length;
