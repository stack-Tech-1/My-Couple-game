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
    tagline: "Weave through Lagos traffic. Carry passengers to their stop.",
    kind: "arcade",
    free: true,
    unit: "naira",
    look: { bg: "#4a4144", ink: "#5a5054", motif: "isan", accent: "#f2b705" },
    // Naira in fares and tips; the best routes pay about ₦50 a second.
    cap: (s) => 3000 + s * 300,
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
  {
    id: "pump-am",
    name: "Pump Am",
    tagline: "Pump the water. Hang every ring on the pegs.",
    kind: "arcade",
    free: true,
    unit: "points",
    look: { bg: "#1f7a8c", ink: "#2a8a9c", motif: "iye", accent: "#e8563a" },
    // 100 a ring, plus 20 a second left over if all ten go on.
    cap: (s) => 1000 + Math.max(0, Math.round((180 - s) * 20)) + 200,
  },
  {
    id: "bash-am",
    name: "Bash Am",
    tagline: "Break every brick. Don't drop the ball.",
    kind: "arcade",
    free: true,
    unit: "points",
    look: { bg: "#b8401f", ink: "#c54d2b", motif: "oko", accent: "#f6c453" },
    // Bricks pay more on later streets and in long combos; street bonuses on top.
    cap: (s) => 3000 + s * 900,
  },
  {
    id: "zobo-sort",
    name: "Zobo Sort",
    tagline: "Pour until every bottle holds one drink.",
    kind: "puzzle",
    free: true,
    unit: "naira",
    look: { bg: "#8f1d40", ink: "#a02a4e", motif: "digi", accent: "#e9b13c" },
    // The most a level pays: level 100 with three stars is ₦4,400.
    cap: () => 5000,
  },
  {
    id: "catch-am",
    name: "Catch Am",
    tagline: "Catch the puff-puff and akara. Dodge the pepper.",
    kind: "arcade",
    free: true,
    unit: "points",
    look: { bg: "#e09a2e", ink: "#cf8a20", motif: "owo", accent: "#e02a1a" },
    // Golden puff-puff and long combos pay well, so the ceiling is generous.
    cap: (s) => 600 + s * 500,
  },
  {
    id: "mosquito-wahala",
    name: "Mosquito Wahala",
    tagline: "Spray them before they bite you to sleep.",
    kind: "arcade",
    free: true,
    unit: "points",
    look: { bg: "#3d1f52", ink: "#4c2a63", motif: "oniko", accent: "#7cd36b" },
    // Later waves pay more per mosquito, plus a bonus per wave.
    cap: (s) => 3000 + s * 900,
  },
  {
    id: "mama-put",
    name: "Mama Put",
    tagline: "Serve every plate before they get vexed.",
    kind: "arcade",
    free: true,
    unit: "naira",
    look: { bg: "#d9521f", ink: "#e0632f", motif: "ade", accent: "#f6c453" },
    // Naira taken in a 90-second rush: plates plus tips.
    cap: (s) => 2000 + s * 800,
  },
  ...(
    [
      ["whot", "Whot", "Pick two. Pick three. The bot has no mercy either."],
      ["ludo", "Ludo", "Roll, race, and send the bot home."],
      ["ayo", "Ayo", "Sow and capture against the bot."],
      ["draughts", "Draughts", "Ten by ten, flying kings, against the bot."],
      ["tic-tac-toe", "X and O", "First to three against the bot."],
      ["connect-four", "Connect Four", "Four in a row before the bot."],
      ["box-am", "Box Am", "Dots and boxes. The bot counts boxes too."],
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
  if (g.id === "mama-put" || g.id === "okada-rush" || g.id === "zobo-sort") return `₦${score.toLocaleString("en-NG")}`;
  if (g.id === "oro") return score === 7 ? "Not solved" : `${score}/6`;
  if (g.kind === "bot") return score ? "Won" : "Lost";
  return `${score.toLocaleString("en-NG")} ${g.unit}`;
}

/** The day today's word and the daily pictures change: Lagos midnight. */
export function lagosDay(at = Date.now()): string {
  return new Date(at + 3600_000).toISOString().slice(0, 10);
}
