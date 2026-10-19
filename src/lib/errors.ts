/** Turns Postgres / Supabase / network errors into something a person would say. */
const KNOWN: [RegExp, string][] = [
  [/rate limited/i, "Easy, tiger. Give it a minute and try again."],
  [/invite not found/i, "That code doesn't open any door we know of. Double-check it?"],
  [/room is full/i, "That room already has its two people. Three's a crowd."],
  [/already in a room/i, "You're already in a room. Leave it first if you're starting fresh."],
  [/not signed in|JWT|session/i, "You've been signed out. Sign back in and we'll pick up where you left off."],
  [/Failed to fetch|NetworkError|network/i, "Couldn't reach the server. Is the Wi-Fi napping?"],
];

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  for (const [re, text] of KNOWN) if (re.test(msg)) return text;
  return "Something went sideways. Try that once more?";
}