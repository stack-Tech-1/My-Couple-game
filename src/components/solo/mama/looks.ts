import { ITEM_NAME, KITCHENS, type Fry, type Item, type UpgradeId } from "@/lib/solo/games/mama";
import { RATIO } from "../games/mama-art";

/**
 * How each Mama Put restaurant looks: its painted scene, where things sit on the 800 × 400
 * stage, its kitchen stations, cooker, fuel and the upgrades on show. The art comes from
 * scripts/art/build-mama-put.mjs; Yaba's has no prefix, the others start ik-, su-, lk-, vi-.
 */
export const ART = "/games/mama-put/";
export const src = (name: string) => `${ART}${name}.webp`;
export const ratio = (name: string) => RATIO[name] ?? 1;

/** A kitchen station: [what, picture, centre x, bottom y, width, label]. */
export type Station = [Item | "fry" | "bin" | "gas", string, number, number, number, string];
/** An upgrade on show: [upgrade, picture, centre x, bottom y, width]. */
export type Decor = [UpgradeId, string, number, number, number];

export type Look = {
  pre: string;
  /** The sign's middle and its paint. */
  sign: readonly [number, number];
  signInk: string;
  /** The counter's back edge (it's drawn again from here down, over the customers), and the plates on it. */
  counterTop: number;
  plateY: number;
  customerBottom: number;
  /** Where food sits on the two kitchen shelves. */
  shelves: readonly [number, number];
  stations: Station[];
  /** Pots that steam. */
  steaming: ReadonlySet<string>;
  /** Upgrades on the wall (behind the customers) and on the counter (in front). */
  back: Decor[];
  counter: Decor[];
  /** The cooker: its width, and the words for using it. */
  cookWidth: number;
  verb: string;
  doing: string;
  fuel: { name: string; unit: string; pic: string; fresh: string; width: number };
};

const LOOK_ORDER = ["", "ik-", "su-", "lk-", "vi-"];
/** The fuel's picture: gas cylinders are shared, charcoal is Surulere's own. */
export const fuelPic = (pre: string, fuel: Look["fuel"], fresh: boolean) => `${fuel.pic === "gas" ? "" : pre}${fresh ? fuel.fresh : fuel.pic}`;

const ROW1 = (shelf: number, items: [Item, number, string?][], pre: string, from = 160, step = 96): Station[] => items.map(([it, w, label], i) => [it, `${pre}st-${it}`, from + i * step, shelf, w, label ?? ITEM_NAME[it]]);

/** Yaba's buka: the first restaurant, laid out by hand. */
const YABA: Look = {
  pre: "",
  sign: [382, 52],
  signInk: "#c43a22",
  counterTop: 173,
  plateY: 197,
  customerBottom: 210,
  shelves: [287, 361],
  stations: [
    ["jollof", "st-jollof", 56, 287, 62, "Jollof"],
    ["rice", "st-rice", 150, 287, 72, "White rice"],
    ["stew", "st-stew", 246, 287, 66, "Stew"],
    ["egusi", "st-egusi", 338, 287, 62, "Egusi"],
    ["beef", "st-beef", 438, 287, 84, "Beef"],
    ["chicken", "st-chicken", 536, 287, 82, "Chicken"],
    ["fish", "st-fish", 634, 287, 84, "Fish"],
    ["bin", "bin", 742, 287, 38, "Bin plate"],
    // The stove stands on the floor in front of the lower shelf, clear of the labels above.
    ["fry", "", 70, 397, 80, "Dodo"],
    ["gas", "gas", 168, 361, 40, "Gas"],
    ["eba", "st-eba", 264, 361, 68, "Eba"],
    ["moin", "st-moin", 362, 361, 70, "Moin moin"],
    ["drink", "st-drink", 462, 361, 70, "Cold drinks"],
  ],
  steaming: new Set(["jollof", "rice", "stew", "egusi"]),
  back: [
    ["paint", "up-bunting", 120, 30, 120],
    ["paint", "up-bunting", 660, 30, 120],
    ["tv", "up-tv", 54, 118, 66],
    ["generator", "up-generator", 742, 146, 44],
    ["chairs", "up-chairs", 36, 176, 56],
  ],
  counter: [
    ["fan", "up-fan", 22, 202, 30],
    ["radio", "up-radio", 400, 206, 36],
    ["tip-jar", "up-tipjar", 210, 210, 20],
    ["paint", "up-plant", 785, 210, 28],
  ],
  cookWidth: 80,
  verb: "fry",
  doing: "Frying",
  fuel: { name: "gas", unit: "cylinder", pic: "gas", fresh: "gas-new", width: 40 },
};

/** The other four: the cooker stands in the left-hand column, and the shelves fill to the right. */
function area(pre: string, o: Omit<Look, "pre" | "stations" | "plateY" | "customerBottom"> & { row1: [Item, number, string?][]; row2: [Item, number, string?][] }): Look {
  const { row1, row2, ...rest } = o;
  return {
    ...rest,
    pre,
    plateY: o.counterTop + 24,
    customerBottom: o.counterTop + 37,
    stations: [
      ...ROW1(o.shelves[0], row1, pre),
      ["bin", "bin", 742, o.shelves[0], 38, "Bin plate"],
      ["fry", "", 66, 397, o.cookWidth, ITEM_NAME[KITCHENS[LOOK_ORDER.indexOf(pre)]!.cook]],
      ["gas", fuelPic(pre, o.fuel, false), 172, o.shelves[1], o.fuel.width, o.fuel.name],
      ...ROW1(o.shelves[1], row2, pre, 272, 100),
    ],
  };
}

export const LOOKS: readonly Look[] = [
  YABA,
  area("ik-", {
    sign: [418, 33],
    signInk: "#1d4fa3",
    counterTop: 186,
    shelves: [304, 370],
    row1: [["ewedu", 66], ["gbegiri", 66], ["efo", 66, "Efo riro"], ["assorted", 82, "Assorted"], ["ponmo", 82], ["goat", 82]],
    row2: [["water", 64]],
    steaming: new Set(["ewedu", "gbegiri", "efo"]),
    back: [
      ["fan", "ik-up-fan", 140, 44, 140],
      ["paint", "ik-up-bunting", 200, 98, 110],
      ["paint", "ik-up-bunting", 560, 98, 110],
      ["tv", "ik-up-tv", 52, 132, 64],
      ["generator", "ik-up-generator", 752, 189, 46],
      ["chairs", "ik-up-chairs", 64, 189, 100],
    ],
    counter: [
      ["radio", "ik-up-radio", 400, 218, 40],
      ["tip-jar", "ik-up-tipjar", 210, 220, 28],
      ["non-stick", "ik-up-plant", 22, 216, 34],
    ],
    cookWidth: 84,
    verb: "turn",
    doing: "Turning",
    fuel: YABA.fuel,
  }),
  area("su-", {
    sign: [395, 41],
    signInk: "#8a2d10",
    counterTop: 186,
    shelves: [302, 370],
    row1: [["jollof", 66], ["kilishi", 82], ["boli", 82], ["groundnut", 70], ["corn", 82, "Corn"], ["salad", 70, "Onions"]],
    row2: [["chapman", 66]],
    steaming: new Set(["jollof"]),
    back: [
      ["paint", "su-up-bunting", 640, 20, 150],
      ["tv", "su-up-tv", 70, 132, 86],
      ["generator", "su-up-generator", 745, 186, 50],
      ["chairs", "su-up-chairs", 630, 189, 90],
      ["radio", "su-up-radio", 400, 189, 34],
    ],
    counter: [
      ["fan", "su-up-fan", 22, 214, 30],
      ["tip-jar", "su-up-tipjar", 210, 218, 30],
      ["non-stick", "su-up-plant", 785, 218, 34],
    ],
    cookWidth: 92,
    verb: "grill",
    doing: "Grilling",
    fuel: { name: "charcoal", unit: "sack", pic: "fuel", fresh: "fuel-new", width: 46 },
  }),
  area("lk-", {
    sign: [390, 49],
    signInk: "#0f6b6b",
    counterTop: 189,
    shelves: [300, 368],
    row1: [["fried-rice", 66], ["asun", 82], ["grilled-fish", 82, "Fish"], ["snail", 70, "Snail"], ["samosa", 82], ["spring-roll", 82, "Spring rolls"]],
    row2: [["chapman", 44]],
    steaming: new Set(["fried-rice"]),
    back: [
      ["paint", "lk-up-bunting", 104, 40, 150],
      ["paint", "lk-up-bunting", 706, 40, 150],
      ["fan", "lk-up-fan", 60, 192, 110],
      ["tv", "lk-up-tv", 470, 132, 76],
      ["generator", "lk-up-generator", 745, 192, 50],
      ["chairs", "lk-up-chairs", 640, 192, 100],
    ],
    counter: [
      ["radio", "lk-up-radio", 22, 220, 26],
      ["tip-jar", "lk-up-tipjar", 210, 222, 22],
      ["non-stick", "lk-up-plant", 785, 222, 40],
    ],
    cookWidth: 84,
    verb: "fry",
    doing: "Frying",
    fuel: YABA.fuel,
  }),
  area("vi-", {
    sign: [370, 30],
    signInk: "#1d4a33",
    counterTop: 174,
    shelves: [300, 367],
    row1: [["ofada", 70], ["ayamase", 66], ["jollof", 70], ["poundo", 66, "Pounded yam"], ["egusi", 66], ["nkwobi", 66]],
    row2: [["zobo", 44]],
    steaming: new Set(["ayamase", "egusi", "jollof"]),
    back: [
      ["fan", "vi-up-fan", 400, 74, 90],
      ["paint", "vi-up-bunting", 230, 20, 150],
      ["paint", "vi-up-bunting", 530, 20, 150],
      ["tv", "vi-up-tv", 108, 140, 92],
      ["radio", "vi-up-radio", 720, 177, 110],
      ["chairs", "vi-up-chairs", 30, 177, 44],
      ["generator", "vi-up-generator", 598, 177, 40],
    ],
    counter: [
      ["tip-jar", "vi-up-tipjar", 210, 206, 28],
      ["non-stick", "vi-up-plant", 785, 206, 36],
    ],
    cookWidth: 80,
    verb: "cook",
    doing: "Cooking",
    fuel: YABA.fuel,
  }),
];
export const lookOf = (area: number | undefined) => LOOKS[area ?? 0] ?? YABA;

/** The cooker's picture for a stage: off, warming up, the raw food going in, cooking, ready, burnt. */
export function cookPic(look: Look, f: Fry) {
  const k = f.stage === "idle" ? 0 : f.stage === "frying" ? (f.t < 0.5 ? 1 : f.t < 1.5 ? 2 : 3) : f.stage === "ready" ? 4 : 5;
  return look.pre ? `${look.pre}cook-${k}` : ["stove-off", "stove-oil", "stove-raw", "stove-frying", "stove-ready", "stove-burnt"][k]!;
}

/** A dish in the order bubble, and on the counter plate (lifted off its own plate where there is one). */
export const bubblePic = (look: Look, it: Item) => `${look.pre}p-${it}`;
export const platePic = (look: Look, it: Item) => (RATIO[`${look.pre}f-${it}`] ? `${look.pre}f-${it}` : `${look.pre}p-${it}`);
/** Drinks stand beside the plate rather than on it. */
export const DRINKS: ReadonlySet<Item> = new Set(["drink", "water", "chapman", "zobo"]);

/** Every picture a restaurant needs, to load before the rush. */
export function picturesFor(look: Look) {
  const mine = (n: string) => (look.pre ? n.startsWith(look.pre) : !/^(ik|su|lk|vi)-/.test(n));
  return Object.keys(RATIO).filter((n) => mine(n) || n.startsWith("cust-") || n === "coin" || n === "bin" || n === "mama-happy" || (look.fuel.pic === "gas" && n.startsWith("gas")));
}

/** An upgrade's picture in an area's shop. */
const UPGRADE_ART: Record<UpgradeId, string> = { fan: "up-fan", chairs: "up-chairs", radio: "up-radio", tv: "up-tv", generator: "up-generator", paint: "up-bunting", "big-pan": "up-pan", "non-stick": "up-plant", "tip-jar": "up-tipjar" };
export const upgradePic = (area: number, id: UpgradeId) => (area > 0 ? `${lookOf(area).pre}${UPGRADE_ART[id]}` : id === "non-stick" ? "pan-ready" : UPGRADE_ART[id]);
