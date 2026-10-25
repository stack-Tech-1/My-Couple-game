import { describe, expect, it } from "vitest";
import { personalStats, type GameRow } from "./personal";

let t = 0;
const g = (game_id: string, players: string[], outcome: string | null, winner: string | null = null, status = "finished"): GameRow => ({
  game_id,
  players,
  status,
  outcome,
  winner,
  finished_at: new Date(Date.UTC(2026, 9, 1) + t++ * 60_000).toISOString(),
});

describe("your Amah stats", () => {
  it("is empty before any games", () => {
    expect(personalStats("me", [])).toMatchObject({ played: 0, winRate: null, topGames: [], vs: [], bestStreak: 0, since: null });
  });

  it("counts wins, losses, ties and streaks in order", () => {
    const s = personalStats("me", [
      g("whot", ["me", "bo"], "win", "me"),
      g("whot", ["me", "bo"], "win", "me"),
      g("ludo", ["me", "bo"], "win", "bo"),
      g("whot", ["me", "bo"], "win", "me"),
      g("whot", ["me", "bo"], "win", "me"),
      g("whot", ["me", "bo"], "win", "me"),
      g("ayo", ["me", "bo"], "tie"),
      g("ayo", ["me", "kemi"], "win", "me"),
    ]);
    expect(s).toMatchObject({ played: 8, wins: 6, losses: 1, ties: 1, bestStreak: 3, currentStreak: 1 });
    expect(s.winRate).toBeCloseTo(6 / 8);
    expect(s.topGames[0]).toEqual({ gameId: "whot", count: 5 });
    expect(s.vs).toEqual([
      { id: "bo", wins: 5, losses: 1, ties: 1 },
      { id: "kemi", wins: 1, losses: 0, ties: 0 },
    ]);
  });

  it("keeps co-op, no-winner and group games out of the win record, and skips abandoned ones", () => {
    const s = personalStats("me", [
      g("memory-match", ["me", "bo"], "coop_win"),
      g("split-clues", ["me", "bo"], "coop_loss"),
      g("deep-questions", ["me", "bo"], "complete"),
      g("whot", ["me", "a", "b"], "win", "me"),
      g("ludo", ["me", "bo"], "abandoned", null, "abandoned"),
      g("whot", ["x", "y"], "win", "x"),
    ]);
    expect(s).toMatchObject({ played: 4, coopPlayed: 2, coopWins: 1, wins: 1, losses: 0 });
    expect(s.vs).toEqual([]); // the only win was a group game
  });
});
