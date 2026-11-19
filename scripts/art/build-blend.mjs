/**
 * Builds Blend Am's art from the AI-made sheets in "game images/" (prompts in
 * docs/art/blend-prompts.md).
 *
 *   node scripts/art/build-blend.mjs
 *
 * Saved as WebP in public/games/blend/. The six fabrics are squared up exactly, so they tile on
 * the board; their order matches the piece colours in src/lib/solo/games/blend.ts. Enclosed white
 * pockets left by the white backdrop (inside scissor handles, the middle of the tape measure) are
 * cleared. The shape of every picture goes into src/components/solo/games/blend-art.ts.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cutSheet } from "./cutout.mjs";

const SRC = "game images";
const OUT = "public/games/blend";
const MANIFEST = "src/components/solo/games/blend-art.ts";

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

/** Clear white pockets fully enclosed by an item (bigger than a speck, so highlights stay). */
async function clearPockets(image, minPocket = 300) {
  const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const white = (i) => data[i * 4 + 3] > 0 && Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) > 232 && Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) - Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < 14;
  const seen = new Uint8Array(N);
  const q = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (seen[s] || !white(s)) continue;
    let h = 0, t = 0;
    q[t++] = s;
    seen[s] = 1;
    while (h < t) {
      const i = q[h++], x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !seen[j] && white(j)) (seen[j] = 1), (q[t++] = j);
    }
    if (t >= minPocket) for (let k = 0; k < t; k++) data[q[k] * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } });
}

// B1. The six fabrics, squared to exactly 128 × 128.
{
  const file = path.join(SRC, "Vibrant Ankara Fabric Swatch Collection.png");
  const it = await cutSheet(file);
  expect(file, it, 6);
  for (let k = 0; k < 6; k++) {
    const out = path.join(OUT, `fabric-${k}.webp`);
    const info = await it[k].image.clone().resize({ width: 128, height: 128, fit: "fill" }).webp({ quality: 80, alphaQuality: 86, effort: 6 }).toFile(out);
    record(`fabric-${k}`, info, out);
  }
}

// B2. The cutting table: the whole square picture.
{
  const out = path.join(OUT, "table.webp");
  const info = await sharp(path.join(SRC, "Warm Wooden Game Tabletop Texture.png")).resize({ width: 640, height: 640, fit: "cover" }).webp({ quality: 70, effort: 6 }).toFile(out);
  record("table", info, out);
}

// B3. Tailor's things.
{
  const file = path.join(SRC, "Glossy Tailoring Tools and Fabrics Grid.png");
  const it = await cutSheet(file);
  expect(file, it, 6);
  const names = ["machine", "spool", "scissors", "tape", "pins", "stack"];
  // The spool's thread is white itself, so it keeps its white.
  for (let k = 0; k < 6; k++) await save(names[k] === "spool" ? it[k].image : await clearPockets(it[k].image), names[k], k === 0 ? 260 : 200);
}

// B4. The tailor: proud with the dress, measuring, puzzled.
{
  const file = path.join(SRC, "Three Poses of a Joyful Seamstress.png");
  const it = await cutSheet(file);
  expect(file, it, 3);
  const names = ["tailor-proud", "tailor-measure", "tailor-puzzled"];
  for (let k = 0; k < 3; k++) await save(await clearPockets(it[k].image, 1500), names[k], 480);
}

const sorted = Object.fromEntries(Object.entries(ratio).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `// Made by scripts/art/build-blend.mjs: width ÷ height of every Blend Am picture. Don't edit.\nexport const RATIO: Record<string, number> = ${JSON.stringify(sorted, null, 2).replace(/"([a-z][\w]*)":/g, "$1:")};\n`);
console.log(`${readdirSync(OUT).length} files, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
