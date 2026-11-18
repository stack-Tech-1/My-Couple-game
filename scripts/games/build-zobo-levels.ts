/**
 * Builds Zobo Sort's 100 career levels. Each deal is solved here, so no level can be impossible,
 * and the pours the solver needed become that level's target. The solutions are kept beside the
 * levels so the tests can replay every one under the real rules.
 *
 * Run: npx esbuild scripts/games/build-zobo-levels.ts --bundle --platform=node --format=esm --outfile=<temp>.mjs && node <temp>.mjs
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeRng } from "../../src/games/_engine/rng";
import { CAP, LEVELS, isWon, levelSpec, solve, type Bottle, type Crate, type Move } from "../../src/lib/solo/games/zobo";

const out = resolve(process.cwd(), "src/lib/solo/games");

function deal(level: number, attempt: number) {
  const spec = levelSpec(level);
  const rng = makeRng(`amah-zobo-v1:${level}:${attempt}`);
  const pool = Array.from({ length: spec.drinks * CAP }, (_, i) => Math.floor(i / CAP));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const bottles: Bottle[] = Array.from({ length: spec.drinks }, (_, i) => pool.slice(i * CAP, i * CAP + CAP));
  for (let i = 0; i < spec.spares; i++) bottles.push([]);
  // A crate's key must be a drink with nothing shut inside any crate.
  const crates: Crate[] = [];
  if (spec.crates) {
    const picks: number[] = [];
    while (picks.length < spec.crates) {
      const p = rng.int(spec.drinks);
      if (!picks.includes(p)) picks.push(p);
    }
    const inside = new Set(picks.flatMap((p) => bottles[p]!));
    const keys = Array.from({ length: spec.drinks }, (_, i) => i).filter((d) => !inside.has(d));
    if (!keys.length) return null;
    for (const p of picks) crates.push({ bottle: p, key: keys[rng.int(keys.length)]! });
  }
  return { bottles, crates };
}

const levels: { b: string; p: number; c?: [number, number][] }[] = [];
const solutions: Move[][] = [];

for (let level = 1; level <= LEVELS; level++) {
  let best: { bottles: Bottle[]; crates: Crate[]; path: Move[] } | null = null;
  for (let attempt = 0; attempt < 6000 && !best; attempt++) {
    const d = deal(level, attempt);
    if (!d || isWon(d.bottles)) continue;
    // A quick look first; only a deal that can be finished gets the long search.
    if (!solve(d.bottles, d.crates, 120)) continue;
    const path = solve(d.bottles, d.crates, 1200);
    if (path) best = { ...d, path };
  }
  if (!best) throw new Error(`No deal found for level ${level}`);
  levels.push({ b: best.bottles.map((x) => x.join("")).join("|"), p: best.path.length, ...(best.crates.length ? { c: best.crates.map((c) => [c.bottle, c.key] as [number, number]) } : {}) });
  solutions.push(best.path);
  console.log(`level ${level}: ${best.path.length} pours`);
}

const rows = levels.map((l) => `  ${JSON.stringify(l)},`).join("\n");
writeFileSync(
  resolve(out, "zobo-levels.ts"),
  `/** Made by scripts/games/build-zobo-levels.ts. b: the bottles, p: the solver's pours, c: crates as [bottle, key drink]. */\nexport const ZOBO_LEVELS: { b: string; p: number; c?: [number, number][] }[] = [\n${rows}\n];\n`,
);
writeFileSync(resolve(out, "zobo-levels.solutions.json"), JSON.stringify(solutions));
