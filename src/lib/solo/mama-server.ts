import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { soloFreePlays } from "@/lib/plus/limits";
import { AREAS, DAYS, DIFFICULTIES, careerDay, isUpgrade, stars, type Difficulty, type UpgradeId } from "./games/mama";

/** Everything the Mama Put home needs about one person, in two reads. */
export type MamaCareer = {
  /** Best takings per career day (index 0 is day 1); null if never played. */
  dayBest: (number | null)[];
  /** Stars per career day. */
  dayStars: number[];
  /** Best takings per quick-rush difficulty. */
  quickBest: Record<Difficulty, number | null>;
  /** Naira taken in, ever, minus what's been spent in the shops. */
  savings: number;
  /** What each area's restaurant has (index 0 is Yaba). */
  owned: UpgradeId[][];
  /** No Amah Plus: only the first two Yaba days. */
  locked: boolean;
};

export async function mamaCareer(userId: string): Promise<MamaCareer> {
  const admin = supabaseAdmin();
  const [{ data: scores }, { data: shop }, plays] = await Promise.all([
    admin.from("solo_scores").select("mode, score").eq("user_id", userId).eq("game_id", "mama-put").limit(10000),
    admin.from("solo_shop").select("area, item, price").eq("user_id", userId).eq("game_id", "mama-put"),
    soloFreePlays(userId, "mama-put"),
  ]);
  const dayBest: (number | null)[] = Array.from({ length: DAYS }, () => null);
  const quickBest = Object.fromEntries(DIFFICULTIES.map((d) => [d, null])) as Record<Difficulty, number | null>;
  let earned = 0;
  for (const r of scores ?? []) {
    const score = r.score as number;
    const mode = r.mode as string;
    earned += score;
    const day = /^day-(\d{1,2})$/.exec(mode);
    if (day) {
      const i = Number(day[1]) - 1;
      if (i >= 0 && i < DAYS) dayBest[i] = Math.max(dayBest[i] ?? 0, score);
    } else if ((DIFFICULTIES as readonly string[]).includes(mode)) {
      const k = mode as Difficulty;
      quickBest[k] = Math.max(quickBest[k] ?? 0, score);
    }
  }
  const owned: UpgradeId[][] = AREAS.map(() => []);
  let spent = 0;
  for (const r of shop ?? []) {
    spent += r.price as number;
    const item = r.item as string;
    if (isUpgrade(item)) owned[r.area as number]?.push(item);
  }
  return {
    dayBest,
    dayStars: dayBest.map((b, i) => (b == null ? 0 : stars(b, careerDay(i + 1)))),
    quickBest,
    savings: Math.max(0, earned - spent),
    owned,
    locked: plays.limited,
  };
}

/** A career day's best, read straight from the scores (for checking a day is open). */
export async function mamaDayBest(userId: string, day: number): Promise<number | null> {
  const { data } = await supabaseAdmin().from("solo_scores").select("score").eq("user_id", userId).eq("game_id", "mama-put").eq("mode", `day-${day}`).order("score", { ascending: false }).limit(1);
  return (data?.[0]?.score as number | undefined) ?? null;
}

/** What one area's restaurant has. */
export async function mamaOwned(userId: string, area: number): Promise<UpgradeId[]> {
  const { data } = await supabaseAdmin().from("solo_shop").select("item").eq("user_id", userId).eq("game_id", "mama-put").eq("area", area);
  return (data ?? []).map((r) => r.item as string).filter(isUpgrade);
}
