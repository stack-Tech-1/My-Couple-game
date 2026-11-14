/** Couple and Gang of the Week: what both the server and the phone need. */
export type SpotlightKind = "couple" | "gang";
export type Grade = "A+" | "A" | "B+" | "B" | "C";
export type SpotlightWinner = {
  id: string;
  week: string;
  kind: SpotlightKind;
  grade: Grade;
  stats: { days?: number; games?: number; coop?: number; dailies?: number; active?: number; members?: number };
  room_name: string | null;
  members: number;
  people: { name: string; motif: string | null; hue: number | null }[] | null;
  love: number;
  loved: boolean;
  mine: boolean;
};

/**
 * A week's grade from its score. The best a couple can do is about 150 (seven days together,
 * twenty games, ten team-up wins, every daily); a gang about 155.
 */
const MAX: Record<SpotlightKind, number> = { couple: 151, gang: 156 };
export function gradeOf(kind: SpotlightKind, score: number): Grade {
  const p = score / MAX[kind];
  return p >= 0.8 ? "A+" : p >= 0.65 ? "A" : p >= 0.5 ? "B+" : p >= 0.35 ? "B" : "C";
}

/** "Kemi & Dayo" or "The Lekki Lot". */
export const winnerName = (w: Pick<SpotlightWinner, "kind" | "people" | "room_name">) => (w.kind === "couple" ? (w.people ?? []).map((p) => p.name).join(" & ") : (w.room_name ?? "A friend room"));

/** The headline's numbers, short. */
export function winnerLine(w: Pick<SpotlightWinner, "kind" | "stats" | "grade">): string {
  const s = w.stats;
  const parts = w.kind === "couple" ? [`${s.days ?? 0} of 7 days together`, `${s.games ?? 0} games`] : [`${s.games ?? 0} games`, `${s.active ?? 0} of ${s.members ?? 0} playing`];
  return `${parts.join(", ")}, ${w.grade}`;
}
