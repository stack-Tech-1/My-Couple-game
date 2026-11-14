/**
 * Builds Mama Put's game art from the AI-made sheets in "game images/".
 *
 *   node scripts/art/build-mama-put.mjs
 *
 * Each sheet is cut into its items (see cutout.mjs). Items are named in reading order (top row
 * first, left to right); null skips one. Everything is written to public/games/mama-put/ as WebP,
 * at twice the size it's shown on a phone, so it stays sharp and small.
 */
import { mkdirSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { cutSheet, offThePlate } from "./cutout.mjs";

const SRC = "game images";
const OUT = "public/games/mama-put";

/** sheet file → names of its items in reading order, and the width to save them at. */
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
    { backdrop: "grey", pockets: false },
  ],
];

const widthFor = (name, extra = {}) =>
  extra[name] ?? (name.startsWith("cust-") ? 250 : name.startsWith("st-") ? 230 : name.startsWith("pan-") ? 220 : name === "plate" ? 180 : name.startsWith("p-") ? 96 : 230);

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [file, names, extra = {}, how = {}] of SHEETS) {
  const items = await cutSheet(path.join(SRC, file), how);
  if (items.length < names.length) throw new Error(`${file}: expected at least ${names.length} items, found ${items.length}`);
  for (let k = 0; k < names.length; k++) {
    const name = names[k];
    if (!name) continue;
    const it = items[k];
    const w = widthFor(name, extra);
    const quality = name === "wall" || name === "counter" ? 72 : 74;
    const out = path.join(OUT, `${name}.webp`);
    await it.image.clone().resize({ width: Math.min(w, it.w) }).webp({ quality, alphaQuality: 80, effort: 6 }).toFile(out);
    total += statSync(out).size;
    // Food lifted off its plate, to pile onto the counter plates. White rice stays plated.
    if (name.startsWith("p-") && name !== "p-rice" && name !== "p-drink") {
      const food = path.join(OUT, `f-${name.slice(2)}.webp`);
      await (await offThePlate(it.image.clone().png())).resize({ width: Math.round(w * 0.8) }).webp({ quality: 74, alphaQuality: 80 }).toFile(food);
      total += statSync(food).size;
    }
  }
}
console.log(`${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
