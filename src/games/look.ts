import type { Motif } from "@/design/adire";
import type { GameCategory } from "./catalog";

/**
 * How each game dresses on the shelf: a panel colour, the adire motif printed on it (a shade
 * darker, so the line art on top stays readable), and the accent its drawing uses.
 * Panels are mid-light colours on purpose: the drawings are inked lines.
 */
export type Look = { bg: string; ink: string; motif: Motif; accent: string };

const P = {
  danfo: ["#f2b705", "#dba500"],
  wood: ["#dcaa72", "#c9925a"],
  sky: ["#a7cbe3", "#8db8d6"],
  indigo: ["#b3bde3", "#9aa6d6"],
  sage: ["#b9c8a6", "#a3b58d"],
  peach: ["#f2bda4", "#e6a588"],
  pink: ["#f0bccb", "#e4a2b6"],
  brass: ["#e6c784", "#d6b265"],
  mint: ["#acd8c3", "#92c8ae"],
  lilac: ["#cdbbe4", "#b9a3d7"],
  sand: ["#ead7bc", "#dcc29e"],
  clay: ["#e2a383", "#d38c69"],
} as const;

const EMBER = "#e8563a";
const WINE = "#5b1a2b";
const INDIGO = "#24305e";

const look = (p: keyof typeof P, motif: Motif, accent: string = EMBER): Look => ({ bg: P[p][0], ink: P[p][1], motif, accent });

export const GAME_LOOKS: Record<string, Look> = {
  // Head to head
  "naija-landlord": look("danfo", "agbole", EMBER),
  "spell-am": look("wood", "digi", EMBER),
  whot: look("pink", "ade", WINE),
  ayo: look("clay", "owo", INDIGO),
  ludo: look("mint", "ilu", EMBER),
  chess: look("sand", "ilu", EMBER),
  draughts: look("brass", "ogbo", WINE),
  "tic-tac-toe": look("sky", "dundun", EMBER),
  "connect-four": look("indigo", "oniko", EMBER),
  "know-me-trivia": look("peach", "olokoto", WINE),
  "word-duel": look("sage", "digi", EMBER),
  "reflex-duel": look("brass", "iye", EMBER),
  "draw-guess": look("lilac", "olokoto", EMBER),
  riddles: look("sky", "olokoto", WINE),
  "naija-trivia": look("mint", "ade", EMBER),
  "pidgin-palava": look("danfo", "isan", WINE),
  "dont-laugh": look("pink", "dundun", EMBER),
  "emoji-guess": look("peach", "oniko", INDIGO),
  // Same team
  "split-clues": look("sage", "oko", EMBER),
  "in-sync": look("mint", "isan", EMBER),
  "memory-match": look("indigo", "agbole", EMBER),
  "beat-the-clock": look("brass", "iye", EMBER),
  // Getting to know you
  "how-well": look("peach", "digi", WINE),
  "daily-question": look("sky", "oniko", EMBER),
  "story-chain": look("lilac", "isan", EMBER),
  "this-or-that": look("sand", "dundun", EMBER),
  "love-styles": look("pink", "olokoto", WINE),
  "same-page": look("sage", "agbole", EMBER),
  "most-likely": look("brass", "ade", WINE),
  "deep-questions": look("indigo", "isan", WINE),
  // Soft hours
  "love-notes": look("pink", "isan", WINE),
  "memory-lane": look("sand", "olokoto", WINE),
  "date-night": look("lilac", "owo", EMBER),
  "compliment-battle": look("peach", "iye", WINE),
  "bucket-list": look("mint", "oko", EMBER),
};

/** Category banners: the colour and motif behind each shelf's title. */
export const CATEGORY_LOOKS: Record<GameCategory, { bg: string; ink: string; motif: Motif; fg: string }> = {
  competitive: { bg: "#e8563a", ink: "#cf4529", motif: "ilu", fg: "#1c1416" },
  coop: { bg: "#8a9a7b", ink: "#7a8a6b", motif: "oko", fg: "#1c1416" },
  personal: { bg: "#d9ac54", ink: "#c79a42", motif: "digi", fg: "#1c1416" },
  romantic: { bg: "#5b1a2b", ink: "#6e283a", motif: "isan", fg: "#f6efe6" },
  spicy: { bg: "#120c0e", ink: "#2a1a1e", motif: "olokoto", fg: "#f4e4da" },
};

/** The room's signature: deep adire indigo. */
export const INDIGO_LOOK = { bg: "#24305e", ink: "#33427c", deep: "#18203f", glow: "#4a5ba0" };

const FALLBACK: Record<GameCategory, Look> = {
  competitive: look("peach", "ilu"),
  coop: look("sage", "oko"),
  personal: look("brass", "digi", WINE),
  romantic: look("pink", "isan", WINE),
  spicy: look("clay", "olokoto", WINE),
};

export const lookFor = (id: string, category: GameCategory): Look => GAME_LOOKS[id] ?? FALLBACK[category];
