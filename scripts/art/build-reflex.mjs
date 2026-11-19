/**
 * Builds Reflex Training's penalty art from the AI-made sheets in "game images/" (prompts in
 * docs/art/reflex-prompts.md).
 *
 *   node scripts/art/build-reflex.mjs
 *
 * Saved as WebP in public/games/reflex/. The striker's sheet has the ball as separate pieces;
 * they're left out, because the game draws and moves its own ball. The shape of every picture
 * goes into src/components/solo/games/reflex-art.ts.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cutSheet } from "./cutout.mjs";

const SRC = "game images";
const OUT = "public/games/reflex";
const MANIFEST = "src/components/solo/games/reflex-art.ts";

mkdirSync(OUT, { recursive: true });
const ratio = {};
let total = 0;
const record = (name, info, out) => {
  ratio[name] = Math.round((info.width / info.height) * 1000) / 1000;
  total += statSync(out).size;
};
const save = async (image, name, box, quality = 76) => {
  const out = path.join(OUT, `${name}.webp`);
  const info = await image.clone().resize({ width: box, height: box, fit: "inside", withoutEnlargement: true }).webp({ quality, alphaQuality: 82, effort: 6 }).toFile(out);
  record(name, info, out);
};
const expect = (file, items, n) => {
  if (items.length !== n) throw new Error(`${file}: expected ${n} items, found ${items.length}. The sheet may have changed.`);
};

// R1. The pitch: the whole picture.
{
  const out = path.join(OUT, "pitch.webp");
  const info = await sharp(path.join(SRC, "Nighttime Football Penalty Kick Stadium.png")).resize({ width: 720 }).webp({ quality: 72, effort: 6 }).toFile(out);
  record("pitch", info, out);
}

// R2. The keeper: ready, diving to our left, diving to our right, ball held up, sitting.
{
  const file = path.join(SRC, "Goalkeeper’s Five Dynamic Poses.png");
  const it = await cutSheet(file);
  expect(file, it, 5);
  const names = ["keeper-ready", "keeper-dive-l", "keeper-dive-r", "keeper-hold", "keeper-sit"];
  for (let k = 0; k < 5; k++) await save(it[k].image, names[k], 360);
}

// R3. The striker, from behind: standing, running in, striking. (Items 3 to 5 are the balls.)
{
  const file = path.join(SRC, "Three-Stage Soccer Kick Sequence.png");
  const it = await cutSheet(file);
  expect(file, it, 6);
  const names = ["striker-stand", "striker-run", "striker-kick"];
  for (let k = 0; k < 3; k++) await save(it[k].image, names[k], 420);
}

// R4. Ball, flying ball (its streaks come apart, so it's the plain ball again and isn't kept),
// whistle, gloves, flag, the ball in the net.
{
  const file = path.join(SRC, "Glossy Soccer Icons Grid.png");
  const it = await cutSheet(file);
  expect(file, it, 6);
  await save(it[0].image, "ball", 120);
  await save(it[2].image, "whistle", 200);
  await save(it[3].image, "gloves", 200);
  await save(it[4].image, "flag", 200);
  await save(it[5].image, "net", 240);
}

const sorted = Object.fromEntries(Object.entries(ratio).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `// Made by scripts/art/build-reflex.mjs: width ÷ height of every Reflex Training picture. Don't edit.\nexport const RATIO: Record<string, number> = ${JSON.stringify(sorted, null, 2).replace(/"([a-z][\w]*)":/g, "$1:")};\n`);
console.log(`${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
