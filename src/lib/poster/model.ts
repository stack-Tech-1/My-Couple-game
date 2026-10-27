import { gameMeta } from "@/games/catalog";
import { badgesOf, levelOf, xpOf, type Stats } from "@/lib/progress/model";
import type { PersonalStats } from "@/lib/stats/personal";

export type PosterPerson = { name: string; motif: string; hue: number };

/** Everything the share poster shows. Built from data the person can already see in Amah. */
export type Poster = {
  me: PosterPerson;
  /** Couple rooms only: the partner, and the "us" numbers. */
  partner: PosterPerson | null;
  level: { level: number; name: string; progress: number } | null;
  streak: number;
  bestStreakDays: number;
  badges: { earned: number; total: number } | null;
  together: number;
  /** Lifetime wins in this room: [mine, theirs]. */
  score: [number, number] | null;
  played: number;
  wins: number;
  bestStreak: number;
  winRate: number | null;
  topGame: string | null;
};

export function buildPoster(input: { me: PosterPerson; partner: PosterPerson | null; progress: Stats | null; score: [number, number] | null; personal: PersonalStats }): Poster {
  const { me, partner, progress, score, personal: s } = input;
  const lvl = progress ? levelOf(xpOf(progress)) : null;
  const badges = progress ? badgesOf(progress) : null;
  const top = s.topGames[0]?.gameId;
  return {
    me,
    partner,
    level: lvl ? { level: lvl.level, name: lvl.name, progress: Math.max(0, Math.min(1, lvl.progress)) } : null,
    streak: progress?.streak ?? 0,
    bestStreakDays: progress?.best_streak ?? 0,
    badges: badges ? { earned: badges.filter((b) => b.earned).length, total: badges.length } : null,
    together: progress?.games ?? 0,
    score: partner ? score : null,
    played: s.played,
    wins: s.wins,
    bestStreak: s.bestStreak,
    winRate: s.winRate === null ? null : Math.round(s.winRate * 100),
    topGame: top ? (gameMeta(top)?.name ?? null) : null,
  };
}

/** The playful line under the score: who's ahead, said kindly. */
export function scoreLine(p: Poster): string | null {
  if (!p.partner || !p.score) return null;
  const [mine, theirs] = p.score;
  if (mine + theirs === 0) return "No winner yet. Watch this space.";
  if (mine === theirs) return "Dead level. Rematch tonight?";
  return mine > theirs ? `${p.me.name} is ahead. ${p.partner.name} wants a rematch.` : `${p.partner.name} is ahead. ${p.me.name} wants a rematch.`;
}
