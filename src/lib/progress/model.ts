/**
 * Couple progress: XP, levels and badges, all derived from room_progress() counts. Pure, so the
 * rules are easy to read, test and tune.
 */
export type Stats = {
  streak: number;
  best_streak: number;
  shared_days: number;
  games: number;
  kinds: number;
  coop_wins: number;
  wins: Record<string, number>;
  whot_wins: number;
  dailies: number;
  messages: number;
  voice: number;
  nudges: number;
  notes: number;
  memories: number;
  bucket_done: number;
};

export const EMPTY_STATS: Stats = { streak: 0, best_streak: 0, shared_days: 0, games: 0, kinds: 0, coop_wins: 0, wins: {}, whot_wins: 0, dailies: 0, messages: 0, voice: 0, nudges: 0, notes: 0, memories: 0, bucket_done: 0 };

/** Shared effort counts most; chatter counts a little, so a level means time together. */
export function xpOf(s: Stats): number {
  return (
    s.games * 10 +
    s.dailies * 6 +
    s.shared_days * 4 +
    s.notes * 5 +
    s.memories * 5 +
    s.bucket_done * 8 +
    Math.floor(s.messages / 10) +
    Math.floor(s.nudges / 5)
  );
}

export const LEVEL_NAMES = ["New spark", "Getting cosy", "Sweethearts", "Lovebirds", "Ride or die", "Soulmates", "Power couple", "Legends"];

/** XP needed to reach level n (1-based): 0, 60, 180, 360, 600, ... (30·n·(n−1)). */
export const xpForLevel = (n: number) => 30 * n * (n - 1);

export function levelOf(xp: number): { level: number; name: string; floor: number; next: number; progress: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const base = LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1]!;
  const name = level > LEVEL_NAMES.length ? `${base} ${level - LEVEL_NAMES.length + 1}` : base;
  return { level, name, floor, next, progress: (xp - floor) / (next - floor) };
}

export type Badge = { id: string; name: string; description: string; earned: boolean; value: number; target: number };

const BADGES: { id: string; name: string; description: string; target: number; value: (s: Stats) => number }[] = [
  { id: "first_game", name: "Game on", description: "Finish your first game together.", target: 1, value: (s) => s.games },
  { id: "games_25", name: "Regulars", description: "Finish 25 games together.", target: 25, value: (s) => s.games },
  { id: "games_100", name: "Hall of fame", description: "Finish 100 games together.", target: 100, value: (s) => s.games },
  { id: "explorers", name: "Explorers", description: "Play 10 different games.", target: 10, value: (s) => s.kinds },
  { id: "dream_team", name: "Dream team", description: "Win 10 team-up games.", target: 10, value: (s) => s.coop_wins },
  { id: "whot_champ", name: "Whot champion", description: "One of you wins 10 games of Whot.", target: 10, value: (s) => s.whot_wins },
  { id: "streak_7", name: "A week strong", description: "Show up together 7 days in a row.", target: 7, value: (s) => s.best_streak },
  { id: "streak_30", name: "Month of us", description: "Show up together 30 days in a row.", target: 30, value: (s) => s.best_streak },
  { id: "streak_100", name: "Unbreakable", description: "Show up together 100 days in a row.", target: 100, value: (s) => s.best_streak },
  { id: "daily_10", name: "Curious minds", description: "Both answer 10 Daily Questions.", target: 10, value: (s) => s.dailies },
  { id: "daily_50", name: "Open books", description: "Both answer 50 Daily Questions.", target: 50, value: (s) => s.dailies },
  { id: "letters_5", name: "Pen pals", description: "Send 5 love notes.", target: 5, value: (s) => s.notes },
  { id: "memories_10", name: "Memory keepers", description: "Add 10 photos to Memory Lane.", target: 10, value: (s) => s.memories },
  { id: "bucket_5", name: "Dream chasers", description: "Tick off 5 bucket-list items.", target: 5, value: (s) => s.bucket_done },
  { id: "voice_10", name: "Sweet voices", description: "Send 10 voice notes.", target: 10, value: (s) => s.voice },
  { id: "chatter_500", name: "Can't stop talking", description: "Send 500 chat messages.", target: 500, value: (s) => s.messages },
  { id: "nudges_50", name: "Always on my mind", description: "Send 50 nudges.", target: 50, value: (s) => s.nudges },
];

export function badgesOf(s: Stats): Badge[] {
  return BADGES.map((b) => {
    const value = b.value(s);
    return { id: b.id, name: b.name, description: b.description, target: b.target, value: Math.min(value, b.target), earned: value >= b.target };
  });
}
