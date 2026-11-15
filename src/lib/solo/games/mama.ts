import { makeRng } from "@/games/_engine/rng";

/**
 * Mama Put: a 90-second lunch rush. Customers come to the counter with an order; dish it onto
 * their plate and serve it before they lose patience. Right plate: you're paid, plus a tip for
 * being quick. Wrong plate: they leave without paying. One dish has to be cooked first (dodo in
 * the Yaba buka, amala in Ikeja, suya in Surulere…), it burns if you leave it, and the fuel runs
 * out: more comes out of the day's takings. Orders get bigger and patience shorter as the rush
 * goes on. A first-ever day starts with a tutorial: one customer, no clock, until they're served.
 *
 * The career moves across Lagos, and each area is its own restaurant with its own menu (see
 * KITCHENS). Quick rushes are always at the Yaba buka.
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

export const ITEMS = [
  // Yaba: the buka.
  "jollof", "rice", "eba", "stew", "egusi", "beef", "chicken", "fish", "dodo", "moin", "drink",
  // Ikeja: the amala joint.
  "amala", "ewedu", "gbegiri", "efo", "assorted", "ponmo", "goat", "water",
  // Surulere: the suya spot.
  "suya", "kilishi", "boli", "groundnut", "corn", "salad", "chapman",
  // Lekki: beach and small chops.
  "fried-rice", "asun", "grilled-fish", "snail", "samosa", "spring-roll", "puff-puff",
  // Victoria Island: fine dining.
  "ofada", "ayamase", "poundo", "nkwobi", "pepper-soup", "zobo",
] as const;
export type Item = (typeof ITEMS)[number];
export const ITEM_NAME: Record<Item, string> = {
  jollof: "Jollof", rice: "White rice", eba: "Eba", stew: "Stew", egusi: "Egusi", beef: "Beef", chicken: "Chicken", fish: "Fish", dodo: "Dodo", moin: "Moin moin", drink: "Cold drink",
  amala: "Amala", ewedu: "Ewedu", gbegiri: "Gbegiri", efo: "Efo riro", assorted: "Assorted meat", ponmo: "Ponmo", goat: "Goat meat", water: "Pure water",
  suya: "Suya", kilishi: "Kilishi", boli: "Boli", groundnut: "Groundnut", corn: "Roasted corn", salad: "Onions and tomatoes", chapman: "Chapman",
  "fried-rice": "Fried rice", asun: "Asun", "grilled-fish": "Grilled fish", snail: "Peppered snail", samosa: "Samosa", "spring-roll": "Spring rolls", "puff-puff": "Puff-puff",
  ofada: "Ofada rice", ayamase: "Ayamase", poundo: "Pounded yam", nkwobi: "Nkwobi", "pepper-soup": "Pepper soup", zobo: "Zobo",
};

/**
 * A restaurant: what it sells and how its customers order. An order is one base (a dish with its
 * partners, like rice with stew), then one main if the menu has any, then each side by chance:
 * [side, chance at the start of the rush, extra chance by the end].
 */
export type Kitchen = {
  /** On the signboard. */
  name: string;
  /** The dish that has to be cooked first, and how many plates one batch serves. */
  cook: Item;
  serves: number;
  fuel: "gas" | "charcoal";
  bases: readonly (readonly Item[])[];
  mains: readonly Item[];
  sides: readonly (readonly [Item, number, number])[];
  /** The career day each dish joins the menu; together, the whole menu. */
  unlock: Partial<Record<Item, number>>;
  price: Partial<Record<Item, number>>;
};

export const KITCHENS: readonly Kitchen[] = [
  {
    name: "Mama Put",
    cook: "dodo",
    serves: 1,
    fuel: "gas",
    bases: [["jollof"], ["rice", "stew"], ["eba", "egusi"]],
    mains: ["beef", "chicken", "fish"],
    sides: [["dodo", 0.25, 0.4], ["moin", 0, 0.35], ["drink", 0.1, 0.35]],
    unlock: { jollof: 1, chicken: 1, drink: 1, beef: 2, rice: 3, stew: 3, dodo: 4, fish: 5, moin: 5, eba: 6, egusi: 6 },
    price: { jollof: 500, rice: 400, eba: 300, stew: 200, egusi: 300, beef: 300, chicken: 500, fish: 400, dodo: 200, moin: 250, drink: 300 },
  },
  {
    name: "Mama Amala",
    cook: "amala",
    serves: 2,
    fuel: "gas",
    // Abula: amala with both ewedu and gbegiri.
    bases: [["amala", "ewedu"], ["amala", "gbegiri"], ["amala", "efo"], ["amala", "ewedu", "gbegiri"]],
    mains: ["assorted", "ponmo", "goat"],
    sides: [["water", 0.15, 0.4]],
    unlock: { amala: 7, ewedu: 7, assorted: 7, water: 7, gbegiri: 8, ponmo: 9, efo: 10, goat: 11 },
    price: { amala: 400, ewedu: 150, gbegiri: 150, efo: 350, assorted: 600, ponmo: 300, goat: 700, water: 100 },
  },
  {
    name: "Mama Suya",
    cook: "suya",
    serves: 1,
    fuel: "charcoal",
    bases: [["jollof"], ["boli", "groundnut"], ["corn"]],
    mains: ["suya", "kilishi"],
    sides: [["salad", 0.2, 0.4], ["chapman", 0.1, 0.35]],
    unlock: { jollof: 13, suya: 13, kilishi: 13, chapman: 13, boli: 14, groundnut: 14, salad: 15, corn: 16 },
    price: { jollof: 700, suya: 1200, kilishi: 900, boli: 400, groundnut: 200, corn: 400, salad: 200, chapman: 800 },
  },
  {
    name: "Mama Chops",
    cook: "puff-puff",
    serves: 1,
    fuel: "gas",
    bases: [["fried-rice"], ["samosa", "spring-roll"]],
    mains: ["asun", "grilled-fish", "snail"],
    sides: [["puff-puff", 0.25, 0.4], ["chapman", 0.1, 0.35]],
    unlock: { "fried-rice": 19, asun: 19, "puff-puff": 19, chapman: 19, "grilled-fish": 20, samosa: 21, "spring-roll": 21, snail: 22 },
    price: { "fried-rice": 1500, asun: 2000, "grilled-fish": 3000, snail: 2500, samosa: 600, "spring-roll": 600, "puff-puff": 500, chapman: 1200 },
  },
  {
    name: "Mama's Table",
    cook: "pepper-soup",
    serves: 1,
    fuel: "gas",
    bases: [["ofada", "ayamase"], ["jollof"], ["poundo", "egusi"]],
    mains: [],
    sides: [["pepper-soup", 0.3, 0.4], ["nkwobi", 0.1, 0.3], ["zobo", 0.1, 0.35]],
    unlock: { ofada: 25, ayamase: 25, jollof: 25, "pepper-soup": 25, zobo: 25, poundo: 26, egusi: 26, nkwobi: 27 },
    price: { ofada: 3000, ayamase: 2500, jollof: 3000, poundo: 2000, egusi: 2500, nkwobi: 4000, "pepper-soup": 3500, zobo: 1000 },
  },
];
/** Everything a restaurant sells. */
export const menuOf = (k: Kitchen) => ITEMS.filter((x) => k.unlock[x] != null);

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
  /** Which restaurant: 0 Yaba … 4 Victoria Island (missing: Yaba). */
  area?: number;
  /** Seconds for the cooked dish, and how long it waits before burning (kitchen upgrades). */
  fry?: number;
  burn?: number;
  /** Tip multiplier (the tip jar). */
  tips?: number;
  /** Shop upgrades in play, so the restaurant can show them. */
  owned?: readonly UpgradeId[];
  /** Seconds of flame in a cylinder (or a sack of charcoal), and a refill's price. */
  gas?: number;
  gasPrice?: number;
  /** Start with the one-customer tutorial. */
  tutorial?: boolean;
};

export const kitchenOf = (cfg: Pick<MamaConfig, "area"> | undefined) => KITCHENS[cfg?.area ?? 0] ?? KITCHENS[0]!;

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
export type Upgrade = { id: UpgradeId; name: string; price: number; kind: "vibe" | "kitchen"; patience: number; about: string };
export const isUpgrade = (id: string): id is UpgradeId => UPGRADES.some((u) => u.id === id);

/**
 * What each restaurant's version of an upgrade is called. Outside Yaba the non-stick pan's place
 * is taken by a plant (ambience), and the big pan is that kitchen's own bigger cooker.
 */
const UPGRADE_NAMES: readonly Partial<Record<UpgradeId, string>>[] = [
  {},
  { fan: "Ceiling fan", chairs: "Long bench", radio: "Speaker", tv: "Box TV with football", generator: "Generator", paint: "Green-white flags", "big-pan": "Big omorogun", "non-stick": "Rubber plant", "tip-jar": "Tip bowl" },
  { fan: "Rechargeable fan", chairs: "Plastic stools", radio: "Loudspeaker", tv: "Flat TV with football", generator: "Generator", paint: "Bulb lights", "big-pan": "Bigger grill", "non-stick": "Tyre planter", "tip-jar": "Tip box" },
  { fan: "Beach umbrella", chairs: "Deck chairs", radio: "DJ speaker", tv: "Wall TV with football", generator: "Quiet generator", paint: "Festoon lights", "big-pan": "Double fryer", "non-stick": "Potted palm", "tip-jar": "Tip jar" },
  { fan: "Air conditioner", chairs: "Dining chairs", radio: "Grand piano", tv: "Big screen with football", generator: "Inverter", paint: "Gold string lights", "big-pan": "Copper pot", "non-stick": "Plant in a gold pot", "tip-jar": "Tip folder" },
];

/** An upgrade as it is in one area's restaurant. */
export function upgradeFor(area: number, id: UpgradeId): Upgrade {
  const base: Upgrade = { ...UPGRADES.find((u) => u.id === id)! };
  if (area <= 0) return base;
  const name = UPGRADE_NAMES[area]?.[id] ?? base.name;
  const cook = ITEM_NAME[kitchenOf({ area }).cook];
  if (id === "non-stick") return { ...base, name, kind: "vibe", patience: 0.05, about: "Something green: 5% more patience." };
  if (id === "big-pan") return { ...base, name, about: `${cook} is ready a third faster.` };
  return { ...base, name };
}
export const upgradesFor = (area: number) => UPGRADES.map((u) => upgradeFor(area, u.id));

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
  const area = areaIndex(day);
  const have = UPGRADES.filter((u) => owned.includes(u.id)).map((u) => upgradeFor(area, u.id));
  if (!have.length) return cfg;
  const vibe = have.reduce((t, u) => t + u.patience, 0) * vibeWeight(day);
  return {
    ...cfg,
    patience: cfg.patience * (1 + vibe),
    fry: owned.includes("big-pan") ? FRY_SECONDS / 1.5 : cfg.fry,
    burn: owned.includes("non-stick") && area === 0 ? BURN_AFTER * 1.7 : cfg.burn,
    tips: owned.includes("tip-jar") ? 1.1 : cfg.tips,
    owned: have.map((u) => u.id),
  };
}

export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_NAME: Record<Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };

const FULL_MENU = menuOf(KITCHENS[0]!);
export const QUICK: Record<Difficulty, MamaConfig> = {
  // Measured with the test player like the career days (see DAY_STARS).
  easy: { seconds: 90, menu: FULL_MENU, patience: 1.7, pace: 1.45, extras: 0.6, stars: [8600, 11600, 14500] },
  normal: { seconds: 90, menu: FULL_MENU, patience: 1.25, pace: 1.2, extras: 1, stars: [6600, 12100, 17300] },
  hard: { seconds: 90, menu: FULL_MENU, patience: 0.95, pace: 1, extras: 1.3, stars: [5600, 9700, 16100] },
};

/** Career: 30 days across Lagos, six in each area. New dishes join the menu as you go; patience gets shorter. */
export const AREAS = ["Yaba", "Ikeja", "Surulere", "Lekki", "Victoria Island"] as const;
export const DAYS = 30;
export const newOnDay = (day: number) => {
  const k = KITCHENS[areaIndex(day)]!;
  return ITEMS.filter((x) => k.unlock[x] === day);
};
export const areaOf = (day: number) => AREAS[areaIndex(day)]!;

export function careerDay(day: number): MamaConfig {
  const d = Math.max(1, Math.min(DAYS, Math.round(day)));
  const t = (d - 1) / (DAYS - 1); // 0 on day 1, 1 on day 30
  const seconds = d <= 3 ? 60 : d <= 12 ? 75 : 90;
  const area = areaIndex(d);
  const k = KITCHENS[area]!;
  const menu = ITEMS.filter((x) => (k.unlock[x] ?? Infinity) <= d);
  return {
    seconds,
    menu,
    patience: 1.6 - t * 0.55,
    pace: 1.5 - t * 0.45,
    extras: 0.5 + t * 0.9,
    stars: DAY_STARS[d - 1]!,
    gasPrice: Math.round((GAS_PRICE * (AREA_PRICE[area] ?? 1)) / 100) * 100,
    ...(area ? { area } : {}),
  };
}

/**
 * Star targets per day, measured by playing every day with the test player in mama-levels.test
 * (run it with MAMA_CALIBRATE=1 to print a fresh table): one star for a slow player (1.3s a tap),
 * two for a good one (1s), three for a sharp one (0.7s), kept so two stars sit at 60 to 80% of
 * three and one star at 35 to 60%. Through Ikeja, one star is also in reach of a very slow player
 * (1.6s). Days 1 to 3 are learning days and ask 20% less. Re-measure if the rules above change.
 */
const DAY_STARS: readonly (readonly [number, number, number])[] = [
  // Yaba
  [4400, 5800, 7300], [4000, 5400, 6700], [4200, 5500, 6900], [8200, 11000, 13800], [6400, 11600, 14500], [6300, 11600, 14600],
  // Ikeja
  [5800, 10800, 13500], [4900, 11100, 13900], [3600, 9400, 11800], [5500, 10900, 13700], [6700, 12300, 15400], [5300, 12200, 15300],
  // Surulere
  [20000, 26700, 33400], [20000, 26700, 33400], [16700, 27000, 33800], [19300, 26000, 32600], [20600, 26600, 34400], [17700, 24400, 34700],
  // Lekki
  [40700, 59200, 74100], [47500, 56900, 81600], [32700, 59100, 77600], [28500, 60000, 76700], [27500, 59900, 76600], [26300, 59700, 75200],
  // Victoria Island
  [62400, 93100, 126800], [53900, 91500, 114400], [55500, 100800, 140400], [49000, 105700, 140200], [52900, 103300, 151300], [53600, 95500, 153300],
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
/** The cooker. `n`: plates the ready batch still serves (missing: one). */
export type Fry = { stage: "idle" | "frying" | "ready" | "burnt"; t: number; n?: number };
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
/** The dish this restaurant cooks first. */
export const cookOf = (s: Pick<MamaState, "cfg">) => kitchenOf(rulesOf(s)).cook;

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
/** The flame burns while the dish is cooking or waiting on it. */
const flameOn = (f: Fry) => f.stage === "frying" || f.stage === "ready";

/** Buy a new cylinder (or sack of charcoal) out of today's takings. */
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
  const k = kitchenOf(cfg);
  const on = (x: Item) => cfg.menu.includes(x);
  // A base only once all its partners are on the menu (rice comes with stew).
  const bases = k.bases.filter((b) => b.every(on));
  // Early in a full-menu rush, keep to the two simplest bases.
  const pool = bases.length >= 3 && p < 0.15 ? bases.slice(0, 2) : bases;
  const out: Item[] = [...(pool.length ? pool[rng.int(pool.length)]! : [cfg.menu[0] ?? "jollof"])];
  const mains = k.mains.filter(on);
  if (mains.length) out.push(mains[rng.int(mains.length)]!);
  for (const [side, start, more] of k.sides) if (on(side) && !out.includes(side) && rng.next() < (start + p * more) * cfg.extras) out.push(side);
  return out;
}

const sameOrder = (a: Item[], b: Item[]) => a.length === b.length && a.every((x) => b.includes(x));
/** What a dish costs at a restaurant (Yaba prices unless the rules say otherwise). */
export const priceOf = (x: Item, cfg?: MamaConfig) => kitchenOf(cfg).price[x] ?? KITCHENS[0]!.price[x] ?? 300;
export const orderPrice = (o: Item[], cfg?: MamaConfig) => o.reduce((t, x) => t + priceOf(x, cfg), 0);

/** Time passes: patience runs down, the cooker cooks, customers come and go. */
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
  // The cooker: only moves while there's fuel for the flame.
  const f = s.fry;
  const rules = rulesOf(s);
  const gas = gasLeft(s);
  if (flameOn(f) && gas > 0) {
    s.gas = Math.max(0, gas - dt);
    const serves = kitchenOf(rules).serves;
    if (f.stage === "frying") s.fry = f.t + dt >= (rules.fry ?? FRY_SECONDS) ? { stage: "ready", t: 0, ...(serves > 1 ? { n: serves } : {}) } : { stage: "frying", t: f.t + dt };
    else s.fry = f.t + dt >= (rules.burn ?? BURN_AFTER) ? { stage: "burnt", t: 0 } : { ...f, t: f.t + dt };
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

/** Put something on the selected plate. The cooked dish has to be ready. */
export function add(s: MamaState, item: Item): { state: MamaState; ok: boolean; why?: "fry" | "full" | "twice" } {
  if (s.over) return { state: s, ok: false };
  const plate = s.plates[s.selected]!;
  if (plate.includes(item)) return { state: s, ok: false, why: "twice" };
  if (plate.length >= 6) return { state: s, ok: false, why: "full" };
  let fry = s.fry;
  if (item === cookOf(s)) {
    if (fry.stage !== "ready") return { state: s, ok: false, why: "fry" };
    // A big batch (a pot of amala) serves more than one plate.
    fry = (fry.n ?? 1) > 1 ? { ...fry, n: fry.n! - 1 } : { stage: "idle", t: 0 };
  }
  const plates = s.plates.map((p, j) => (j === s.selected ? [...p, item] : p));
  return { state: { ...s, plates, fry }, ok: true };
}

/** Start cooking (a burnt batch goes in the bin first). Needs fuel. */
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
  const price = right ? orderPrice(c.order, rulesOf(s)) : 0;
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
