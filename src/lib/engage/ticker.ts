import { z } from "zod";

/**
 * The news ticker: the strip under each page's title inside the app. The admin writes a message,
 * switches the weekly winners on or off, and picks Solo games whose best score of the week runs.
 * Kept in app_config under "ticker".
 */
export type TickerConfig = { message: string; winners: boolean; games: string[] };
export const TICKER_DEFAULT: TickerConfig = { message: "", winners: true, games: [] };
export const TICKER_MAX = 120;

export const tickerSchema = z.object({
  message: z.string().trim().max(TICKER_MAX),
  winners: z.boolean(),
  games: z.array(z.string().max(40)).max(20),
});

/** Solo games that can show their best of the week, and which leaderboard counts. */
export const TICKER_GAMES: readonly { id: string; mode: string }[] = [
  { id: "okada-rush", mode: "free" },
  { id: "blend-am", mode: "normal" },
  { id: "ajo", mode: "normal" },
  { id: "catch-am", mode: "normal" },
  { id: "pump-am", mode: "normal" },
  { id: "reflex", mode: "normal" },
  { id: "bash-am", mode: "normal" },
  { id: "mama-put", mode: "normal" },
  { id: "mosquito-wahala", mode: "normal" },
];
