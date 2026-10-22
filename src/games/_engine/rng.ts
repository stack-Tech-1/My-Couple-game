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

const INC = 0x6d2b79f5;

/**
 * mulberry32 seeded from (seed, cursor). Store the cursor in state to continue the stream later.
 * Each step only adds INC to the state, so skipping to `cursor` is one multiply, not a loop:
 * the numbers are the same either way, and an old session's large cursor costs nothing.
 */
export function makeRng(seed: string, cursor = 0): Rng {
  let a = (hash(seed) + Math.imul(cursor % 4294967296, INC)) | 0;
  let n = 0;
  const step = () => {
    a = (a + INC) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    n++;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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