/** Only allow same-origin relative redirects. Blocks //evil.com and absolute URLs. */
export function safeNext(next: string | null | undefined, fallback = "/room"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}