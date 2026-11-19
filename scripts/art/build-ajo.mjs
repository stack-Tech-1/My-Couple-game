/**
 * Builds Ajo's art from the AI-made sheets in "game images/" (prompts in docs/art/ajo-prompts.md).
 *
 *   node scripts/art/build-ajo.mjs
 *
 * Saved as WebP in public/games/ajo/. Notes 1 to 8 are ₦5 to ₦1,000 (the value is written on in
 * code); bundles 9 to 15 are ₦2k to ₦1m. The shape of every picture goes into
 * src/components/solo/games/ajo-art.ts.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cutSheet } from "./cutout.mjs";

const SRC = "game images";
const OUT = "public/games/ajo";
const MANIFEST = "src/components/solo/games/ajo-art.ts";

mkdirSync(OUT, { recursive: true });
const ratio = {};
let total = 0;
const record = (name, info, out) => {
  ratio[name] = Math.round((info.width / info.height) * 1000) / 1000;
  total += statSync(out).size;
};
const save = async (image, name, box, quality = 78) => {
  const out = path.join(OUT, `${name}.webp`);
  const info = await image.clone().resize({ width: box, height: box, fit: "inside", withoutEnlargement: true }).webp({ quality, alphaQuality: 84, effort: 6 }).toFile(out);
  record(name, info, out);
};
const expect = (file, items, n) => {
  if (items.length !== n) throw new Error(`${file}: expected ${n} items, found ${items.length}. The sheet may have changed.`);
};

// A1. Eight notes, ₦5 to ₦1,000: tile-1 to tile-8.
{
  const file = path.join(SRC, "Colorful Cartoon Banknote Frames-1.png");
  const it = await cutSheet(file);
  expect(file, it, 8);
  for (let k = 0; k < 8; k++) await save(it[k].image, `tile-${k + 1}`, 220);
}

// A2. Seven bundles, ₦2k to ₦1m: tile-9 to tile-15.
{
  const file = path.join(SRC, "Cartoon Money Stacks and Safes-2.png");
  const it = await cutSheet(file);
  expect(file, it, 7);
  for (let k = 0; k < 7; k++) await save(it[k].image, `tile-${k + 9}`, 220);
}

// A3. The pink ajo card: the whole square picture.
{
  const out = path.join(OUT, "card.webp");
  const info = await sharp(path.join(SRC, "Worn Pink Contribution Card-3.png")).resize({ width: 640, height: 640, fit: "cover" }).webp({ quality: 74, alphaQuality: 84, effort: 6 }).toFile(out);
  record("card", info, out);
}

// A4. The collector: handing over the bag, counting notes, shaking his head.
{
  const file = path.join(SRC, "Three Expressions of Prosperity.png");
  const it = await cutSheet(file);
  expect(file, it, 3);
  const names = ["collector-bag", "collector-count", "collector-empty"];
  for (let k = 0; k < 3; k++) await save(it[k].image, names[k], 480);
}

const sorted = Object.fromEntries(Object.entries(ratio).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `// Made by scripts/art/build-ajo.mjs: width ÷ height of every Ajo picture. Don't edit.\nexport const RATIO: Record<string, number> = ${JSON.stringify(sorted, null, 2).replace(/"([a-z][\w]*)":/g, "$1:")};\n`);
console.log(`${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
