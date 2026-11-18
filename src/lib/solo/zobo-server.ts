import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { soloFreePlays } from "@/lib/plus/limits";
import { LEVELS, levelOfMode, lookPrice, starsOfTakings } from "./games/zobo";

/** Everything the Zobo Sort home needs about one person. */
export type ZoboCareer = {
  /** Best stars per level (index 0 is level 1); 0 if not finished yet. */
  levelStars: number[];
  totalStars: number;
  /** Naira taken in, ever, minus what's been spent at the stall. */
  savings: number;
  /** Bottle and shelf looks bought. */
  looks: string[];
  /** Without Plus: one level a day. */
  free: { limited: boolean; used: boolean; level: number | null; resetsAt: string };
};

export async function zoboCareer(userId: string): Promise<ZoboCareer> {
  const admin = supabaseAdmin();
  const [{ data: scores }, { data: shop }, plays] = await Promise.all([
    admin.from("solo_scores").select("mode, score").eq("user_id", userId).eq("game_id", "zobo-sort").limit(10000),
    admin.from("solo_shop").select("item, price").eq("user_id", userId).eq("game_id", "zobo-sort"),
    soloFreePlays(userId, "zobo-sort"),
  ]);
  const levelStars = Array.from({ length: LEVELS }, () => 0);
  let earned = 0;
  for (const r of scores ?? []) {
    const score = r.score as number;
    earned += score;
    const level = levelOfMode(r.mode as string);
    if (level) levelStars[level - 1] = Math.max(levelStars[level - 1]!, starsOfTakings(level, score));
  }
  let spent = 0;
  const looks: string[] = [];
  for (const r of shop ?? []) {
    spent += r.price as number;
    if (lookPrice(r.item as string)) looks.push(r.item as string);
  }
  const today = plays.modes?.[0];
  return {
    levelStars,
    totalStars: levelStars.reduce((a, b) => a + b, 0),
    savings: Math.max(0, earned - spent),
    looks,
    free: { limited: plays.limited, used: plays.limited && plays.left <= 0, level: today ? levelOfMode(today) : null, resetsAt: plays.resetsAt },
  };
}

/** Has this level been finished? (For checking the next one is open.) */
export async function zoboLevelCleared(userId: string, level: number): Promise<boolean> {
  const { count } = await supabaseAdmin().from("solo_scores").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("game_id", "zobo-sort").eq("mode", `lvl-${level}`);
  return !!count;
}
