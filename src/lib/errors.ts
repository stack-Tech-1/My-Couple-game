/** Turns Postgres / Supabase / network errors into something a person would say. */
const KNOWN: [RegExp, string][] = [
  [/rate limited/i, "Easy, tiger. Give it a minute and try again."],
  [/invite not found/i, "That code doesn't open any door we know of. Double-check it?"],
  [/room is full/i, "That room is full. A couple room holds two, a friend room eight."],
  [/already in a couple room|already in a room/i, "You're already in a couple room. You can only be in one at a time, but friend rooms are always open."],
  [/friend room limit/i, "You're in five friend rooms already, which is the most. Leave one to make space."],
  [/only the owner/i, "Only the room's owner can do that."],
  [/only in a couple room/i, "That's only for couple rooms."],
  [/leave the room instead/i, "To remove yourself, leave the room from its settings."],
  [/not signed in|JWT|session/i, "You've been signed out. Sign back in and we'll pick up where you left off."],
  [/Failed to fetch|NetworkError|network/i, "Couldn't reach the server. Is the Wi-Fi napping?"],
];

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  for (const [re, text] of KNOWN) if (re.test(msg)) return text;
  return "Something went sideways. Try that once more?";
}