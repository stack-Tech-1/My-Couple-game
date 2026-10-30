import type { Motif } from "@/design/adire";

/**
 * Amah Solo: single-player games. Free for everyone, always: `free: true` is on every entry so
 * the Plus checks can never lock one by mistake (see isPlusGame in lib/plus/plans).
 */
export type SoloKind = "arcade" | "puzzle" | "daily" | "bot";

export type SoloGame = {
  id: string;
  name: string;
  tagline: string;
  kind: SoloKind;
  free: true;
  /** Bots: the two-player game it plays. */
  base?: string;
  /** Leaderboards: does a lower score win (reaction times)? */
  lowerIsBetter?: boolean;
  /** How a score reads: "2,400 points", "38 passengers". */
  unit: string;
  look: { bg: string; ink: string; motif: Motif; accent: string };
  /** Light check on submitted scores: the most a person could plausibly score in `seconds`. */
  cap: (seconds: number) => number;
};

/** Solo's own colour: deep marigold with the ilu (talking drum) pattern. */
export const SOLO_LOOK = { bg: "#c98a12", ink: "#b07510", light: "#dda02a", deep: "#2a1a05", motif: "ilu" as Motif, glow: "rgba(232,86,58,.35)" };

export const SOLO_GAMES: SoloGame[] = [
  {
    id: "blend-am",
    name: "Blend Am",
    tagline: "Fit the pieces. Clear the lines.",
    kind: "arcade",
    free: true,
    unit: "points",
    look: { bg: "#e9b13c", ink: "#d99f2c", motif: "ilu", accent: "#2a4a8a" },
    // Long clearing streaks pay a lot, so the ceiling is generous.
    cap: (s) => 1000 + s * 600,
  },
  {
    id: "ajo",
    name: "Ajo",
    tagline: "Merge your way to ₦1,000 and beyond.",
    kind: "arcade",
    free: true,
    unit: "points",
    look: { bg: "#3f8a5c", ink: "#357a4f", motif: "owo", accent: "#f2d27a" },
    cap: (s) => 4000 + s * 600,
  },
  {
    id: "okada-rush",
    name: "Okada Rush",
    tagline: "Weave through Lagos traffic. Pick up passengers.",
    kind: "arcade",
    free: true,
    unit: "passengers",
    look: { bg: "#4a4144", ink: "#5a5054", motif: "isan", accent: "#f2b705" },
    cap: (s) => 5 + Math.ceil(s / 0.9),
  },
  {
    id: "fix-am",
    name: "Fix Am",
    tagline: "Slide the tiles. Fix the picture.",
    kind: "puzzle",
    free: true,
    unit: "points",
    look: { bg: "#1f4d3a", ink: "#2c6650", motif: "olokoto", accent: "#f2b705" },
    cap: () => 10000,
  },
  {
    id: "oro",
    name: "Ọ̀rọ̀ of the Day",
    tagline: "One word a day. Six guesses. Naija word on Fridays.",
    kind: "daily",
    free: true,
    unit: "guesses",
    lowerIsBetter: true,
    look: { bg: "#24305e", ink: "#33427c", motif: "agbole", accent: "#e9b13c" },
    cap: () => 6,
  },
  {
    id: "reflex",
    name: "Reflex Training",
    tagline: "Wait for it. Tap. Beat your own best.",
    kind: "arcade",
    free: true,
    unit: "ms",
    lowerIsBetter: true,
    look: { bg: "#7a2e1f", ink: "#8c3a29", motif: "dundun", accent: "#f6d26a" },
    cap: () => 5000,
  },
  ...(
    [
      ["whot", "Whot", "Pick two. Pick three. The bot has no mercy either."],
      ["ludo", "Ludo", "Roll, race, and send the bot home."],
      ["ayo", "Ayo", "Sow and capture against the bot."],
      ["draughts", "Draughts", "Ten by ten, flying kings, against the bot."],
      ["tic-tac-toe", "X and O", "First to three against the bot."],
      ["connect-four", "Connect Four", "Four in a row before the bot."],
    ] as const
  ).map(
    ([base, name, tagline]): SoloGame => ({
      id: `bot-${base}`,
      name,
      tagline,
      kind: "bot",
      base,
      free: true,
      unit: "wins",
      look: { bg: "#5e4320", ink: "#74552c", motif: "ogbo", accent: "#f6d26a" },
      cap: () => 1,
    }),
  ),
];

export const soloGame = (id: string) => SOLO_GAMES.find((g) => g.id === id);
export const isSoloGame = (id: string) => SOLO_GAMES.some((g) => g.id === id);

/** Bot levels. */
export const BOT_LEVELS = [
  { id: "easy", label: "Small pikin" },
  { id: "medium", label: "Steady" },
  { id: "hard", label: "Agba" },
] as const;
export type BotLevel = (typeof BOT_LEVELS)[number]["id"];

/** How a score reads to people. */
export function formatScore(g: SoloGame, score: number): string {
  if (g.id === "reflex") return `${score} ms`;
  if (g.id === "oro") return score === 7 ? "Not solved" : `${score}/6`;
  if (g.kind === "bot") return score ? "Won" : "Lost";
  return `${score.toLocaleString("en-NG")} ${g.unit}`;
}

/** The day today's word and the daily pictures change: Lagos midnight. */
export function lagosDay(at = Date.now()): string {
  return new Date(at + 3600_000).toISOString().slice(0, 10);
}
