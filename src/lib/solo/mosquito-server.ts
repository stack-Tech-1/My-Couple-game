import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { soloFreePlays } from "@/lib/plus/limits";
import { NIGHTS, isGear, nightOfMode, starsOfTakings, type GearId } from "./games/mosquito";

/** Everything the Mosquito Wahala home needs about one person. */
export type MosquitoCareer = {
  /** Best stars per night (index 0 is night 1); 0 if not survived yet. */
  nightStars: number[];
  totalStars: number;
  /** Naira earned from nights, ever, minus what's been spent in the shop. */
  savings: number;
  gear: GearId[];
  /** Without Plus: two games a day, nights and All Night together. */
  free: { limited: boolean; left: number; resetsAt: string };
};

export async function mosquitoCareer(userId: string): Promise<MosquitoCareer> {
  const admin = supabaseAdmin();
  const [{ data: scores }, { data: shop }, plays] = await Promise.all([
    admin.from("solo_scores").select("mode, score").eq("user_id", userId).eq("game_id", "mosquito-wahala").like("mode", "night-%").limit(10000),
    admin.from("solo_shop").select("item, price").eq("user_id", userId).eq("game_id", "mosquito-wahala"),
    soloFreePlays(userId, "mosquito-wahala"),
  ]);
  const nightStars = Array.from({ length: NIGHTS }, () => 0);
  let earned = 0;
  for (const r of scores ?? []) {
    const night = nightOfMode(r.mode as string);
    if (!night) continue;
    const score = r.score as number;
    earned += score;
    nightStars[night - 1] = Math.max(nightStars[night - 1]!, starsOfTakings(night, score));
  }
  let spent = 0;
  const gear: GearId[] = [];
  for (const r of shop ?? []) {
    spent += r.price as number;
    if (isGear(r.item as string)) gear.push(r.item as GearId);
  }
  return {
    nightStars,
    totalStars: nightStars.reduce((a, b) => a + b, 0),
    savings: Math.max(0, earned - spent),
    gear,
    free: { limited: plays.limited, left: plays.left, resetsAt: plays.resetsAt },
  };
}

/** Has this night been survived? (For checking the next one is open.) */
export async function mosquitoNightCleared(userId: string, night: number): Promise<boolean> {
  const { count } = await supabaseAdmin().from("solo_scores").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("game_id", "mosquito-wahala").eq("mode", `night-${night}`).gt("score", 0);
  return !!count;
}
