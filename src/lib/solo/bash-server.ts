import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { soloFreePlays } from "@/lib/plus/limits";
import { WALLS, isBuilding, starsOfTakings, wallOfMode, type BuildingId } from "./games/bashwall";

/** Everything the Bash Am home needs about one person. */
export type BashCareer = {
  /** Best stars per wall (index 0 is wall 1); 0 if not cleared yet. */
  wallStars: number[];
  totalStars: number;
  /** Naira earned from walls, ever, minus what's been spent on the street. */
  savings: number;
  built: BuildingId[];
  /** Bash Am needs Amah Plus, so this person can look but not play. */
  locked: boolean;
};

export async function bashCareer(userId: string): Promise<BashCareer> {
  const admin = supabaseAdmin();
  const [{ data: scores }, { data: shop }, plays] = await Promise.all([
    admin.from("solo_scores").select("mode, score").eq("user_id", userId).eq("game_id", "bash-am").like("mode", "wall-%").limit(10000),
    admin.from("solo_shop").select("item, price").eq("user_id", userId).eq("game_id", "bash-am"),
    soloFreePlays(userId, "bash-am"),
  ]);
  const wallStars = Array.from({ length: WALLS }, () => 0);
  let earned = 0;
  for (const r of scores ?? []) {
    const wall = wallOfMode(r.mode as string);
    if (!wall) continue;
    const score = r.score as number;
    earned += score;
    wallStars[wall - 1] = Math.max(wallStars[wall - 1]!, starsOfTakings(wall, score));
  }
  let spent = 0;
  const built: BuildingId[] = [];
  for (const r of shop ?? []) {
    spent += r.price as number;
    if (isBuilding(r.item as string)) built.push(r.item as BuildingId);
  }
  return { wallStars, totalStars: wallStars.reduce((a, b) => a + b, 0), savings: Math.max(0, earned - spent), built, locked: plays.limited };
}

/** Has this wall been cleared? (For checking the next one is open.) */
export async function bashWallCleared(userId: string, wall: number): Promise<boolean> {
  const { count } = await supabaseAdmin().from("solo_scores").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("game_id", "bash-am").eq("mode", `wall-${wall}`).gt("score", 0);
  return !!count;
}
