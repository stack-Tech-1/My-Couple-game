export type Payload = { title: string; body: string; url: string; tag?: string; quiet?: boolean };

/** The sender's real name swapped for the recipient's pet name for them, if they have one. */
export function withPetName(payload: Payload, real: string, nick: string | undefined): Payload {
  if (!nick || !real) return payload;
  // Whole name only, so "Bo" never touches "Board".
  const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "gu");
  const swap = (t: string) => t.replace(re, () => nick);
  return { ...payload, title: swap(payload.title), body: swap(payload.body) };
}
