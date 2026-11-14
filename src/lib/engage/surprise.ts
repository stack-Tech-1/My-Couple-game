/**
 * Rare collectibles: about 1 game in 30 turns one up when it finishes. Decided from the game's id,
 * so every finished game has exactly one fixed chance (nothing to farm), and kept rare on purpose:
 * a treat now and then, never a slot machine.
 */
export const SURPRISE_ODDS = 30;

const BY_GAME: Record<string, string[]> = {
  whot: ["Whot General", "Pick Two Professor", "General Market Chief"],
  ludo: ["Ludo Landlord", "Six-Six Specialist"],
  ayo: ["Ayo Agba", "Seed Counter Supreme"],
  chess: ["Chess Oga", "Knight of Ikeja"],
  draughts: ["King of the Board"],
  "box-am": ["Exercise Book Champion"],
  "naija-landlord": ["Lekki Landlord", "Owambe Organiser"],
  "spell-am": ["Wordsmith of Yaba"],
};
const ANY = ["Jollof Royalty", "Suya Spot Regular", "Danfo Conductor", "Generator Hero", "Small Chops Squad", "Owambe Star", "Mama Put VIP", "Aso-ebi Icon"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The collectible this finished game turns up, or null (most of the time). */
export function surpriseFor(sessionId: string, gameId: string): string | null {
  const h = hash(sessionId);
  if (h % SURPRISE_ODDS !== 0) return null;
  const pool = [...(BY_GAME[gameId] ?? []), ...ANY];
  return pool[Math.floor(h / SURPRISE_ODDS) % pool.length]!;
}
