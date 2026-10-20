/** Product-wide constants. Rename the product by changing APP_NAME. */
export const APP_NAME = "Amah";
export const APP_TAGLINE = "A tiny arcade for the two of you.";
export const APP_DESCRIPTION =
  "Amah is a private game room for couples. Trivia, cards, board games, love notes and a strictly opt-in after-dark corner, played live from your own phones.";

export const INVITE_CODE_LENGTH = 6;
export const MAX_DISPLAY_NAME = 32;

export const siteUrl = (): string =>
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";