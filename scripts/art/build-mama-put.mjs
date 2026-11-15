/**
 * Builds Mama Put's game art from the AI-made sheets in "game images/".
 *
 *   python scripts/art/unbackdrop.py ...   (only for sheets read from "clean/", see CLEAN below)
 *   node scripts/art/build-mama-put.mjs
 *
 * Each sheet is cut into its items (see cutout.mjs). Items are named in reading order (top row
 * first, left to right); null skips one, { split: [names] } cuts one item into several side by
 * side, and { join: n, name } glues n pieces back into one. Everything is written to
 * public/games/mama-put/ as WebP, at twice the size it's shown on a phone, so it stays sharp and
 * small. The shape of every picture goes into src/components/solo/games/mama-art.ts for the game.
 *
 * Yaba's art has no prefix; the other restaurants' art starts ik- (Ikeja), su- (Surulere),
 * lk- (Lekki) and vi- (Victoria Island).
 */
import { mkdirSync, statSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cutSheet, joinItems, offThePlate, splitItem } from "./cutout.mjs";

const SRC = "game images";
const OUT = "public/games/mama-put";
const MANIFEST = "src/components/solo/games/mama-art.ts";

/**
 * Sheets whose painted backdrop no colour rule separates from the items: run through
 * unbackdrop.py first, which writes them to "game images/clean/".
 *
 *   python scripts/art/unbackdrop.py <the whole-sheet ones> --out "game images/clean"
 *   python scripts/art/unbackdrop.py <the grid ones> --grid 3x3 --out "game images/clean"
 *   python scripts/art/unbackdrop.py "game images/Nigerian Soup and Stew Spread.png" --grid 4x2 --out "game images/clean"
 */
export const CLEAN = {
  whole: ["Nigerian Street Food Grid.png", "Nigerian Feast Menu Spread.png", "Crisp Studio Feast Collage.png"],
  "3x3": ["Nigerian Feast Grid with Chapman.png", "Nigerian Cuisine Nine-Panel Feast.png", "Nine-Item Colorful Utility Collage.png", "Outdoor Entertainment Essentials Grid.png", "Luxury Home Essentials Collage.png"],
  "4x2": ["Nigerian Soup and Stew Spread.png"],
};

const GREY = { backdrop: "grey", pockets: false };
const six = (p) => [0, 1, 2, 3, 4, 5].map((k) => `${p}cook-${k}`);

/** sheet file → names of its items in reading order, widths to save them at, and how to cut. */
const SHEETS = [
  ["Nigerian Food Stall Asset Sheet-2.png", [null, "wall", "counter", "cust-aunty-happy", "cust-aunty-angry", null, "st-jollof", "st-stew"], { wall: 820, counter: 820 }],
  ["Vibrant Nigerian Food Stall Asset Sheet-3.png", [null, null, null, null, null, null, null, "st-rice"]],
  ["Serene Woman in Vibrant Ankara Attire.png", ["cust-aunty-wait"]],
  ["Three Expressions, One African Style-1.png", ["cust-fila-wait", "cust-fila-happy", "cust-fila-angry"]],
  ["Three NYSC Expressions in Uniform-2.png", ["cust-corper-wait", "cust-corper-happy", "cust-corper-angry"]],
  ["Three Expressions of Confidence-3.png", ["cust-student-wait", "cust-student-happy", "cust-student-angry"]],
  ["Three Cartoon Office Worker Poses-4.png", ["cust-oga-wait", "cust-oga-happy", "cust-oga-angry"]],
  ["Three Expressions of a Distinguished Elder-5.png", ["cust-baba-wait", "cust-baba-happy", "cust-baba-angry"]],
  ["Nigerian Feast of Colorful Delights.png", ["st-egusi", "st-eba", "st-moin", "st-drink"]],
  ["Glossy Cartoon Trays of Fried Favorites.png", ["st-beef", "st-chicken", "st-fish"]],
  ["Plantain Frying Stages in Five Pans.png", ["pan-empty", "pan-raw", "pan-frying", "pan-ready", "pan-burnt"]],
  ["Glossy Stove, Trash Bin, and Gold Coin.png", ["stove", "bin", "coin"], { stove: 260, bin: 110, coin: 72 }],
  ["Glossy Nigerian Platter Collection.png", ["plate", "p-jollof", "p-rice", "p-stew", "p-eba", "p-egusi"]],
  ["Glossy Nigerian Food Sticker Sheet.png", ["p-beef", "p-chicken", "p-fish", "p-dodo", "p-moin", "p-drink"]],
  ["Joyful Ankara-Clad Food Vendor Poses.png", ["mama-happy", "mama-sad"], { "mama-happy": 300, "mama-sad": 300 }],
  // Shop upgrades: a grey studio backdrop rather than transparency, and the corners carry smudges.
  [
    "b14-upgrades.png",
    [null, "up-fan", "up-chairs", "up-radio", null, "up-tv", "up-generator", "up-bunting", "up-plant", "up-pan", "up-tipjar"],
    { "up-fan": 120, "up-chairs": 220, "up-radio": 130, "up-tv": 200, "up-generator": 150, "up-bunting": 760, "up-plant": 120, "up-pan": 150, "up-tipjar": 120 },
    GREY,
  ],
  // Landscape: the stove with the pan on it, six stages; the gas cylinder, plain and new.
  ["Plantain Frying Progression on Six Stoves.png", [null, "stove-off", "stove-oil", "stove-raw", "stove-frying", "stove-ready", "stove-burnt"], { "stove-off": 300, "stove-oil": 300, "stove-raw": 300, "stove-frying": 300, "stove-ready": 300, "stove-burnt": 300 }, GREY],
  ["Sealed Blue Gas Cylinders.png", ["gas", "gas-new"], { gas: 110, "gas-new": 110 }, GREY],

  // Ikeja: the amala joint. The soup pots come out of the cleaned sheet (their black bodies sit on
  // a black backdrop); the trays and coolers from the original.
  ["clean/Nigerian Soup and Stew Spread.png", [null, { split: ["ik-st-ewedu", "ik-st-gbegiri", "ik-st-efo"] }]],
  ["Nigerian Soup and Stew Spread.png", [null, null, "ik-st-assorted", "ik-st-ponmo", "ik-st-goat", "ik-st-water"], {}, { backdrop: "dark" }],
  ["Nigerian Delicacies Grid on Black.png", ["ik-p-amala", "ik-p-ewedu", "ik-p-gbegiri", "ik-p-efo", "ik-p-assorted", "ik-p-ponmo", "ik-p-goat", "ik-p-water", "ik-plate"]],
  ["Amala Joint Upgrade Set.png", ["ik-up-fan", "ik-up-chairs", "ik-up-radio", "ik-up-tv", "ik-up-generator", "ik-up-bunting", "ik-up-plant", "ik-up-pan", "ik-up-tipjar"]],
  ["Six-Stage Amala Cooking Storyboard-1.png", six("ik-")],

  // Surulere: the suya spot, with charcoal for fuel.
  ["Nigerian Street Food Feast Grid.png", ["su-st-corn", "su-st-boli", "su-st-groundnut", "su-st-kilishi", "su-st-jollof", "su-st-salad", null, "su-st-chapman"]],
  ["clean/Nigerian Street Food Grid.png", ["su-p-suya", "su-p-corn", "su-p-boli", "su-p-groundnut", "su-p-kilishi", "su-p-jollof", "su-p-salad", "su-p-chapman", "su-plate"]],
  ["clean/Nine-Item Colorful Utility Collage.png", ["su-up-fan", "su-up-chairs", "su-up-radio", "su-up-tv", "su-up-generator", { join: 2, name: "su-up-bunting" }, "su-up-plant", "su-up-pan", "su-up-tipjar"]],
  ["Suya Grilling Stages_ From Coals to Char-2.png", six("su-")],
  ["Burlap Sacks Filled with Charcoal.png", ["su-fuel-new", "su-fuel"]],

  // Lekki: beach and small chops.
  ["clean/Crisp Studio Feast Collage.png", ["lk-st-grilled-fish", "lk-st-snail", "lk-st-fried-rice", "lk-st-asun", "lk-st-samosa", "lk-st-spring-roll", "lk-st-chapman", null]],
  ["clean/Nigerian Feast Grid with Chapman.png", ["lk-p-puff-puff", "lk-p-grilled-fish", "lk-p-snail", "lk-p-fried-rice", "lk-p-asun", "lk-p-samosa", "lk-p-spring-roll", "lk-p-chapman", "lk-plate"]],
  ["clean/Outdoor Entertainment Essentials Grid.png", ["lk-up-fan", "lk-up-chairs", "lk-up-radio", "lk-up-tv", "lk-up-generator", { join: 2, name: "lk-up-bunting" }, "lk-up-plant", "lk-up-pan", "lk-up-tipjar"]],
  ["Six-Stage Puff-Puff Frying Progression-3.png", six("lk-")],

  // Victoria Island: fine dining. The dining set came apart, so one chair stands for it.
  ["clean/Nigerian Feast Menu Spread.png", ["vi-st-ofada", "vi-st-ayamase", "vi-st-poundo", "vi-st-egusi", "vi-st-nkwobi", "vi-st-jollof", "vi-st-zobo", null]],
  ["clean/Nigerian Cuisine Nine-Panel Feast.png", ["vi-p-pepper-soup", "vi-p-ofada", "vi-p-ayamase", "vi-p-poundo", "vi-p-egusi", "vi-p-nkwobi", "vi-p-jollof", "vi-p-zobo", "vi-plate"]],
  ["clean/Luxury Home Essentials Collage.png", [null, "vi-up-fan", "vi-up-chairs", null, "vi-up-radio", "vi-up-tv", "vi-up-generator", "vi-up-bunting", "vi-up-plant", "vi-up-pan", "vi-up-tipjar"]],
  ["Six-Stage Clay Pot Pepper Soup Cooking-4.png", six("vi-")],
];

/**
 * Portions served on a plate, whose food is lifted off it to pile onto the counter plates (f-…).
 * Yaba: every portion but white rice and the drink. The others: only those painted on a plate;
 * the rest already stand on their own.
 */
const LIFT = new Set(["ik-p-amala", "ik-p-ewedu", "ik-p-gbegiri", "ik-p-efo", "ik-p-assorted", "ik-p-ponmo", "ik-p-goat", "lk-p-snail", "lk-p-fried-rice"]);
const lifts = (name) => (/^(ik|su|lk|vi)-/.test(name) ? LIFT.has(name) : name.startsWith("p-") && name !== "p-rice" && name !== "p-drink");

/**
 * Whole scenes for the landscape game: [sheet, name, rows to keep from]. The image tools make 3:2
 * pictures; a phone held sideways is 2:1, so a band of rows is kept (the scene prompts leave
 * ceiling and floor strips for this) and saved at 1600 × 800.
 */
const SCENES = [
  ["Warm Cartoon Restaurant Counter Interior-1.png", "scene", 40],
  ["Vibrant Amala Joint Interior-1.png", "ik-scene", 88],
  ["Nighttime Empty Suya Stall Counter-2.png", "su-scene", 56],
  ["Tropical Sunset Beach Bar Interior-3.png", "lk-scene", 56],
  ["Elegant Green-Gold Restaurant Kitchen with City View-4.png", "vi-scene", 74],
];

const widthFor = (full, extra = {}) => {
  if (extra[full]) return extra[full];
  const name = full.replace(/^(ik|su|lk|vi)-/, "");
  if (name.startsWith("cust-")) return 250;
  if (name.startsWith("st-")) return 230;
  if (name.startsWith("pan-")) return 220;
  if (name.startsWith("cook-")) return 300;
  if (name.startsWith("fuel")) return 130;
  if (name === "up-bunting") return 600;
  if (name.startsWith("up-")) return 200;
  if (name === "plate") return 180;
  if (name.startsWith("p-")) return 96;
  return 230;
};

mkdirSync(OUT, { recursive: true });
let total = 0;
const ratio = {};
const save = async (image, name, w, quality = 74) => {
  const out = path.join(OUT, `${name}.webp`);
  const info = await image.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality, alphaQuality: 80, effort: 6 }).toFile(out);
  ratio[name] = Math.round((info.width / info.height) * 1000) / 1000;
  total += statSync(out).size;
};

for (const [file, names, extra = {}, how = {}] of SHEETS) {
  const items = await cutSheet(path.join(SRC, file), how);
  // Expand the name list against the items: a join takes several, a split gives several.
  const named = [];
  let k = 0;
  for (const entry of names) {
    if (entry && typeof entry === "object" && "join" in entry) {
      named.push([entry.name, await joinItems(items.slice(k, k + entry.join))]);
      k += entry.join;
    } else if (entry && typeof entry === "object" && "split" in entry) {
      const parts = await splitItem(items[k++], entry.split.length);
      entry.split.forEach((n, j) => named.push([n, parts[j]]));
    } else {
      if (entry) named.push([entry, items[k]]);
      k++;
    }
  }
  if (items.length < k) throw new Error(`${file}: expected at least ${k} items, found ${items.length}`);
  for (const [name, it] of named) {
    const w = widthFor(name, extra);
    await save(it.image, name, Math.min(w, it.w), name === "wall" || name === "counter" ? 72 : 74);
    if (lifts(name)) {
      const food = name.replace(/(^|-)p-/, "$1f-");
      await save(await offThePlate(it.image.clone().png()), food, Math.round(w * 0.8));
    }
  }
}
for (const [file, name, top] of SCENES) {
  const meta = await sharp(path.join(SRC, file)).metadata();
  const band = Math.round(meta.width / 2);
  const out = path.join(OUT, `${name}.webp`);
  await sharp(path.join(SRC, file)).extract({ left: 0, top, width: meta.width, height: Math.min(band, meta.height - top) }).resize(1600, 800).webp({ quality: 74, effort: 6 }).toFile(out);
  ratio[name] = 2;
  total += statSync(out).size;
}

const sorted = Object.fromEntries(Object.entries(ratio).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  MANIFEST,
  `// Made by scripts/art/build-mama-put.mjs: width ÷ height of every Mama Put picture. Don't edit.\nexport const RATIO: Record<string, number> = ${JSON.stringify(sorted, null, 2).replace(/"([a-z][\w]*)":/g, "$1:")};\n`,
);
console.log(`${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
