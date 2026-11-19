/**
 * Builds Catch Am's art from the AI-made sheets in "game images/" (prompts in
 * docs/art/catch-prompts.md).
 *
 *   node scripts/art/build-catch.mjs
 *
 * Sprites are cut out (cutout.mjs) and saved as WebP in public/games/catch/, at about twice the
 * size they're drawn on a phone. Bits that come apart from their item (the puff-puff the seller
 * tosses and its motion lines, a pepper's heat lines) are joined back on. The shape of every
 * picture goes into src/components/solo/games/catch-art.ts.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cutSheet, joinItems } from "./cutout.mjs";

const SRC = "game images";
const OUT = "public/games/catch";
const MANIFEST = "src/components/solo/games/catch-art.ts";

mkdirSync(OUT, { recursive: true });
const ratio = {};
let total = 0;
const save = async (image, name, box, quality = 76) => {
  const out = path.join(OUT, `${name}.webp`);
  const info = await image.clone().resize({ width: box, height: box, fit: "inside", withoutEnlargement: true }).webp({ quality, alphaQuality: 82, effort: 6 }).toFile(out);
  ratio[name] = Math.round((info.width / info.height) * 1000) / 1000;
  total += statSync(out).size;
};
/**
 * The golden puff-puff's glow was painted on white, so cutting it out leaves a hard pale disc.
 * Outside the ball, pale pixels fade by how close to white they are, so the glow melts away.
 * (Inside the ball the sugar is white too, and is left alone.)
 */
async function fadeGlow(image) {
  const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.37;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x - cx, y - cy) < r) continue;
      const o = (y * W + x) * 4;
      const dark = 765 - (data[o] + data[o + 1] + data[o + 2]);
      data[o + 3] = Math.round(data[o + 3] * Math.max(0, Math.min(1, (dark - 25) / 160)));
    }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } });
}

const expect = (file, items, n) => {
  if (items.length !== n) throw new Error(`${file}: expected ${n} items, found ${items.length}. The sheet may have changed.`);
};

// C1. Food: three puff-puff, two akara, the golden one, two peppers (the second with heat lines,
// which come out as three small pieces in a row of their own above it).
{
  const file = path.join(SRC, "Glossy Fritters and Fiery Peppers.png");
  const it = await cutSheet(file, { minArea: 200 });
  expect(file, it, 11);
  const names = ["puff-1", "puff-2", "puff-3", "akara-1"];
  for (let k = 0; k < 4; k++) await save(it[k].image, names[k], 160);
  await save(it[7].image, "akara-2", 160);
  await save(await fadeGlow(it[8].image), "gold", 180);
  await save(it[9].image, "pepper-1", 160);
  await save((await joinItems([it[4], it[5], it[6], it[10]])).image, "pepper-2", 160);
}

// C2. The basket: empty, half full, overflowing. The crumbs on the sheet are left out.
{
  const file = path.join(SRC, "Three Baskets of Golden Fritters.png");
  const it = await cutSheet(file);
  expect(file, it, 3);
  for (let k = 0; k < 3; k++) await save(it[k].image, `basket-${k}`, 360);
}

// C4. The seller: tossing (with the flying puff-puff and its motion lines), winning, and hot.
{
  const file = path.join(SRC, "Joyful Puff-Puff Cooking Trio.png");
  const it = await cutSheet(file, { minArea: 200 });
  expect(file, it, 9);
  await save((await joinItems([it[0], it[1], it[2], it[6]])).image, "seller-toss", 560);
  await save(it[7].image, "seller-win", 480);
  await save((await joinItems([it[3], it[4], it[5], it[8]])).image, "seller-hot", 480);
}

// C3. The market: the whole picture, at twice the game's width.
{
  const out = path.join(OUT, "market.webp");
  const info = await sharp(path.join(SRC, "Vibrant Nigerian Market Street.png")).resize({ width: 716 }).webp({ quality: 72, effort: 6 }).toFile(out);
  ratio.market = Math.round((info.width / info.height) * 1000) / 1000;
  total += statSync(out).size;
}

const sorted = Object.fromEntries(Object.entries(ratio).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `// Made by scripts/art/build-catch.mjs: width ÷ height of every Catch Am picture. Don't edit.\nexport const RATIO: Record<string, number> = ${JSON.stringify(sorted, null, 2).replace(/"([a-z][\w]*)":/g, "$1:")};\n`);
console.log(`${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
