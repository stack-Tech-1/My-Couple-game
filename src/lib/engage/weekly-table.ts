/**
 * A friend room's table for one week (Monday to Sunday, Lagos): 3 points a win, 1 for every
 * finished game you were in (so turning up counts too). Pure, for the server and tests.
 */
export type TableGame = { players: string[]; winner: string | null; game_id: string };
export type TableRow = { userId: string; points: number; wins: number; played: number; topGame: string | null };

export function weeklyTable(games: TableGame[], memberIds: string[]): TableRow[] {
  const rows = new Map<string, TableRow & { counts: Map<string, number> }>(memberIds.map((id) => [id, { userId: id, points: 0, wins: 0, played: 0, topGame: null, counts: new Map() }]));
  for (const g of games) {
    for (const p of g.players) {
      const r = rows.get(p);
      if (!r) continue;
      r.played++;
      r.points++;
      if (g.winner === p) {
        r.wins++;
        r.points += 3;
        r.counts.set(g.game_id, (r.counts.get(g.game_id) ?? 0) + 1);
      }
    }
  }
  return [...rows.values()]
    .map(({ counts, ...r }) => ({ ...r, topGame: [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.played - a.played);
}
