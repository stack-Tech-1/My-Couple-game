/** Product-wide constants. Rename the product by changing APP_NAME. */
export const APP_NAME = "Amah";
export const APP_TAGLINE = "Games for the people closest to you.";
export const APP_DESCRIPTION =
  "Amah is a private game room for couples, and for your best friends too. Whot, Ludo, trivia, love notes and a strictly opt-in after-dark corner for two, played live from your own phones.";

export const INVITE_CODE_LENGTH = 6;
export const MAX_DISPLAY_NAME = 32;

/**
 * The site's own address, for links in emails, challenges and payment returns. Live sets
 * NEXT_PUBLIC_SITE_URL. A Vercel preview (the staging test copy) leaves it unset and uses its own
 * branch address, so its links never send anyone to the live site.
 */
export const siteUrl = (): string => {
  const set = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (set) return set;
  const branch = process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL;
  return branch ? `https://${branch}` : "http://localhost:3000";
};