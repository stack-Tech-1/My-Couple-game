/**
 * Deterministic RNG. Same seed and same cursor give the same numbers on server
 * and client, which keeps game logic pure and replayable.
 */
function hash(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export type Rng = { next: () => number; int: (maxExclusive: number) => number; cursor: () => number };

/** mulberry32 seeded from (seed, cursor). Store the cursor in state to continue the stream later. */
export function makeRng(seed: string, cursor = 0): Rng {
  let a = hash(seed);
  let n = 0;
  const step = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    n++;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < cursor; i++) step();
  return { next: step, int: (max) => Math.floor(step() * max), cursor: () => cursor + n };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}