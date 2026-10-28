// Regenerates assets/words/spell-am.txt (the Spell Am dictionary) from the MIT-licensed `word-list` package.
// Words of 2 to 11 letters (the board is 11 squares wide), one per line. Naija words live in
// src/content/words/naija.ts and are added on the server when the file is loaded.
import fs from "node:fs";

const words = fs
  .readFileSync("node_modules/word-list/words.txt", "utf8")
  .split("\n")
  .filter((w) => /^[a-z]{2,11}$/.test(w));
fs.mkdirSync("assets/words", { recursive: true });
fs.writeFileSync("assets/words/spell-am.txt", words.join("\n") + "\n");
console.log(`wrote ${words.length} words`);
