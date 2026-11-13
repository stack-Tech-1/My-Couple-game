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
  "box-am": look("lilac", "agbole", EMBER),
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

/**
 * Each page beyond the home gets its own deep colour and motif, so the app never repeats itself.
 * Text on these is always cream. `glow` is a CSS background layered over the pattern.
 */
export type PageLook = { motif: Motif; bg: string; ink: string; glow: string };
export const PAGE_LOOKS = {
  // Us: palm green with olokoto spirals (growing from small beginnings) and a gold sunrise.
  us: { motif: "olokoto", bg: "#1f4d3a", ink: "#2c6049", glow: "radial-gradient(70% 40% at 8% 0%, rgba(242,183,5,.4), transparent 70%), radial-gradient(60% 35% at 100% 40%, rgba(232,86,58,.25), transparent 70%)" },
  // Friend rooms: deep teal with the oko canoe (settle differences, grow together).
  friends: { motif: "oko", bg: "#0f4f55", ink: "#1b6168", glow: "radial-gradient(70% 40% at 90% 0%, rgba(242,183,5,.35), transparent 70%), radial-gradient(60% 35% at 0% 45%, rgba(232,86,58,.25), transparent 70%)" },
  // Settings: brass-brown with ogbo squares (long life). Quiet, sturdy.
  settings: { motif: "ogbo", bg: "#5e4320", ink: "#71532b", glow: "radial-gradient(70% 40% at 100% 0%, rgba(232,86,58,.35), transparent 70%)" },
  // Chat: plum with isan waves (continuity: the conversation keeps going).
  chat: { motif: "isan", bg: "#4a1f3d", ink: "#5c2a4e", glow: "radial-gradient(80% 60% at 100% 0%, rgba(232,86,58,.4), transparent 70%)" },
  // Sign in: clay red with cowries (owo), warm and welcoming.
  signin: { motif: "owo", bg: "#7a2e1f", ink: "#8d3b2a", glow: "radial-gradient(70% 40% at 0% 0%, rgba(242,183,5,.35), transparent 70%), radial-gradient(60% 40% at 100% 60%, rgba(36,48,94,.45), transparent 70%)" },
  // Onboarding: deep purple with iye feathers (reaching your goal quickly).
  onboarding: { motif: "iye", bg: "#3a2860", ink: "#4a3675", glow: "radial-gradient(70% 40% at 100% 0%, rgba(232,86,58,.45), transparent 70%), radial-gradient(60% 35% at 0% 50%, rgba(242,183,5,.2), transparent 70%)" },
  // Joining a room: ocean blue with oniko rings.
  join: { motif: "oniko", bg: "#1d4a68", ink: "#295d80", glow: "radial-gradient(70% 40% at 100% 0%, rgba(242,183,5,.35), transparent 70%)" },
  // Another room: burnt orange with ade crowns (a new kingdom of friends).
  newroom: { motif: "ade", bg: "#7f3414", ink: "#93421f", glow: "radial-gradient(70% 40% at 100% 0%, rgba(36,48,94,.5), transparent 70%), radial-gradient(60% 35% at 0% 40%, rgba(242,183,5,.25), transparent 70%)" },
  // Terms, privacy, 18+: wine with the digi mirror (reflect before you agree).
  legal: { motif: "digi", bg: "#5b1a2b", ink: "#6c2639", glow: "radial-gradient(70% 40% at 100% 0%, rgba(232,86,58,.35), transparent 70%)" },
} satisfies Record<string, PageLook>;

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
