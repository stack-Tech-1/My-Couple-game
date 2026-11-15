/**
 * Builds Okada Rush's art from the AI-made sheets in "game images/" (prompts in
 * docs/art/okada-prompts.md).
 *
 *   node scripts/art/build-okada.mjs
 *
 * Sprites are cut out (cutout.mjs) and saved as WebP in public/games/okada/, at about twice the
 * size they're drawn on a phone. Roads are lined up with the game's lanes and made to repeat
 * (road.mjs). The shape of every picture goes into src/components/solo/games/okada-art.ts.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cutSheet, joinItems, splitItem } from "./cutout.mjs";
import { fitRoad } from "./road.mjs";

const SRC = "game images";
const OUT = "public/games/okada";
const MANIFEST = "src/components/solo/games/okada-art.ts";

/** sheet → names in reading order (null skips; { join } and { split } as in build-mama-put), and the box to fit each in. */
const SHEETS = [
  ["Top-Down Red Motorcycle Sprite Sheet.png", ["okada", "okada-p", "okada-l", "okada-r", "okada-p-l", "okada-p-r"], 200],
  ["Five Colorful Motorcycle Riders in Formation.png", ["okada-blue", "okada-black", "okada-gold", "okada-green", "okada-pink"], 200],
  ["Top-Down Assortment of City Vehicles.png", ["danfo", "keke", "car", "brt", "truck", "suv"], 300],
  ["Overhead Cartoon Roadside Asset Sheet.png", ["deep", "pothole", "puddle", "cone", "barrier", "agbero", "lastma", "sand"], 180],
  ["Colorful Community Wave Lineup.png", ["passenger-0", "passenger-1", "passenger-2", "passenger-3", "passenger-4", "passenger-5"], 170],
  ["Smiling Nigerians Sharing Naira Notes.png", ["paid-0", "paid-1", "paid-2", "paid-3", "paid-4", "paid-5"], 170],
  ["Colorful Urban Street Objects Grid.png", ["stop", "kiosk", "mallam", "palm", "streetlight", "generator", "tyres", "fruit"], 220],
  ["Motorcycle Gear Essentials Grid.png", ["g-helmet", "g-bike", "g-phone", "g-spare", "g-raincoat", { join: 2, name: "g-mirrors" }], 240],
  ["Okada Ride and Emblem Badges.png", ["hero", "badge-1", "badge-2", { split: ["badge-3", "badge-4"] }, "badge-5"], 240, { hero: 720 }],
];

/** Roads: [picture, route name, a fifth of a five-strip sheet (which one), or the whole picture]. */
const ROADS = [
  ["Yaba Streets_ Cracked Asphalt and Striped Curbs-1.png", "road-1"],
  ["Top-Down Urban Roadway Map-3.png", "road-2"],
  ["Top-Down Three-Lane Bridge Road-4.png", "road-3"],
  ["Three-Lane Highway Through Grasslands-5.png", "road-4"],
  ["Five Lagos Roads_ From Dust to Nightfall-2.png", "road-5", 4],
];

mkdirSync(OUT, { recursive: true });
const ratio = {};
let total = 0;
const save = async (image, name, box, quality = 76) => {
  const out = path.join(OUT, `${name}.webp`);
  const info = await image.clone().resize({ width: box, height: box, fit: "inside", withoutEnlargement: true }).webp({ quality, alphaQuality: 82, effort: 6 }).toFile(out);
  ratio[name] = Math.round((info.width / info.height) * 1000) / 1000;
  total += statSync(out).size;
};

for (const [file, names, box, sizes = {}] of SHEETS) {
  const items = await cutSheet(path.join(SRC, file));
  let k = 0;
  for (const entry of names) {
    if (entry && typeof entry === "object" && "join" in entry) {
      await save((await joinItems(items.slice(k, k + entry.join))).image, entry.name, box);
      k += entry.join;
    } else if (entry && typeof entry === "object" && "split" in entry) {
      const parts = await splitItem(items[k++], entry.split.length);
      for (let j = 0; j < parts.length; j++) await save(parts[j].image, entry.split[j], box);
    } else {
      if (entry) await save(items[k].image, entry, sizes[entry] ?? box);
      k++;
    }
  }
  if (items.length < k) throw new Error(`${file}: expected ${k} items, found ${items.length}`);
}

for (const [file, name, strip] of ROADS) {
  let img = sharp(path.join(SRC, file));
  if (strip != null) {
    const m = await img.metadata();
    const w = Math.floor(m.width / 5);
    img = sharp(await img.extract({ left: strip * w, top: 0, width: w, height: m.height }).png().toBuffer());
  }
  const road = await fitRoad(img);
  const out = path.join(OUT, `${name}.webp`);
  const info = await road.image.webp({ quality: 72, effort: 6 }).toFile(out);
  ratio[name] = Math.round((info.width / info.height) * 1000) / 1000;
  total += statSync(out).size;
}

const sorted = Object.fromEntries(Object.entries(ratio).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `// Made by scripts/art/build-okada.mjs: width ÷ height of every Okada Rush picture. Don't edit.\nexport const RATIO: Record<string, number> = ${JSON.stringify(sorted, null, 2).replace(/"([a-z][\w]*)":/g, "$1:")};\n`);
console.log(`${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
