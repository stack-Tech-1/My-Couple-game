import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NAIJA_WORDS } from "@/content/words/naija";

/**
 * The Spell Am dictionary: about 220,000 English words (assets/words/spell-am.txt, built by
 * scripts/build-spell-words.mjs) plus the Naija list. Loaded once per server instance.
 */
let loading: Promise<Set<string>> | null = null;

function load(): Promise<Set<string>> {
  loading ??= readFile(path.join(process.cwd(), "assets/words/spell-am.txt"), "utf8")
    .then((text) => {
      const words = new Set(text.split(/\r?\n/).filter(Boolean));
      for (const w of NAIJA_WORDS) words.add(w);
      return words;
    })
    .catch((e) => {
      // Try again on the next move rather than caching the failure.
      loading = null;
      throw e;
    });
  return loading;
}

export async function wordChecker(): Promise<(word: string) => boolean> {
  const words = await load();
  return (word) => words.has(word.toLowerCase());
}
