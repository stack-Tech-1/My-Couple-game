/**
 * "Your Amah": one person's record across every room, from their finished games. Pure, so the page
 * just loads rows and renders.
 */
export type GameRow = { game_id: string; players: string[]; status: string; outcome: string | null; winner: string | null; finished_at: string | null };

export type Record3 = { wins: number; losses: number; ties: number };
export type PersonalStats = {
  played: number;
  wins: number;
  losses: number;
  ties: number;
  /** Wins as a share of games that had a winner or a tie (0..1), or null before any. */
  winRate: number | null;
  coopPlayed: number;
  coopWins: number;
  /** Most-played games, most first. */
  topGames: { gameId: string; count: number }[];
  /** Head to head, two-player games only, most-played opponent first. */
  vs: ({ id: string } & Record3)[];
  bestStreak: number;
  currentStreak: number;
  since: string | null;
};

export function personalStats(me: string, rows: GameRow[]): PersonalStats {
  const games = rows.filter((r) => r.status === "finished" && r.outcome !== "abandoned" && r.players.includes(me)).sort((a, b) => (a.finished_at ?? "").localeCompare(b.finished_at ?? ""));
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let coopPlayed = 0;
  let coopWins = 0;
  let streak = 0;
  let bestStreak = 0;
  const counts = new Map<string, number>();
  const vs = new Map<string, Record3>();

  for (const g of games) {
    counts.set(g.game_id, (counts.get(g.game_id) ?? 0) + 1);
    if (g.outcome === "coop_win" || g.outcome === "coop_loss") {
      coopPlayed++;
      if (g.outcome === "coop_win") coopWins++;
      continue;
    }
    if (g.outcome !== "win" && g.outcome !== "tie") continue;
    const result = g.outcome === "tie" ? "ties" : g.winner === me ? "wins" : "losses";
    if (result === "wins") wins++;
    else if (result === "losses") losses++;
    else ties++;
    streak = result === "wins" ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    if (g.players.length === 2) {
      const other = g.players.find((p) => p !== me)!;
      const rec = vs.get(other) ?? { wins: 0, losses: 0, ties: 0 };
      rec[result]++;
      vs.set(other, rec);
    }
  }

  const decided = wins + losses + ties;
  return {
    played: games.length,
    wins,
    losses,
    ties,
    winRate: decided ? wins / decided : null,
    coopPlayed,
    coopWins,
    topGames: [...counts].map(([gameId, count]) => ({ gameId, count })).sort((a, b) => b.count - a.count || a.gameId.localeCompare(b.gameId)).slice(0, 3),
    vs: [...vs].map(([id, r]) => ({ id, ...r })).sort((a, b) => b.wins + b.losses + b.ties - (a.wins + a.losses + a.ties)),
    bestStreak,
    currentStreak: streak,
    since: games[0]?.finished_at ?? null,
  };
}
