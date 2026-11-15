import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ROUTES, isGear, isSkin, routeStars, type GearId, type SkinId } from "./games/okada";

/** Everything the Okada Rush home needs about one person. */
export type OkadaCareer = {
  /** Best takings per route (index 0 is route 1); null if never ridden. */
  routeBest: (number | null)[];
  routeStars: number[];
  /** Best Free Ride. */
  freeBest: number | null;
  /** Kilometres ridden in all (for the rank). */
  km: number;
  /** Naira taken in, ever, minus what's been spent in the garage. */
  savings: number;
  gear: GearId[];
  skins: SkinId[];
  /** The bike colour in use. */
  skin: SkinId;
};

export async function okadaCareer(userId: string): Promise<OkadaCareer> {
  const admin = supabaseAdmin();
  const [{ data: scores }, { data: shop }] = await Promise.all([
    admin.from("solo_scores").select("mode, score, meta").eq("user_id", userId).eq("game_id", "okada-rush").limit(10000),
    admin.from("solo_shop").select("item, price, bought_at").eq("user_id", userId).eq("game_id", "okada-rush").order("bought_at"),
  ]);
  const routeBest: (number | null)[] = ROUTES.map(() => null);
  let freeBest: number | null = null;
  let earned = 0;
  let metres = 0;
  for (const r of scores ?? []) {
    const mode = r.mode as string;
    const score = r.score as number;
    const m = Number((r.meta as { m?: unknown } | null)?.m);
    // Rides from the old grid game counted passengers, not naira or metres: leave them out.
    if (mode === "normal") continue;
    earned += score;
    if (Number.isFinite(m) && m > 0) metres += Math.min(m, 20000);
    const route = /^route-([1-5])$/.exec(mode);
    if (route) {
      const i = Number(route[1]) - 1;
      routeBest[i] = Math.max(routeBest[i] ?? 0, score);
    } else if (mode === "free") freeBest = Math.max(freeBest ?? 0, score);
  }
  const gear: GearId[] = [];
  const skins: SkinId[] = ["skin-red"];
  let skin: SkinId = "skin-red";
  let spent = 0;
  for (const r of shop ?? []) {
    spent += r.price as number;
    const item = r.item as string;
    if (isGear(item)) gear.push(item);
    else if (isSkin(item)) {
      skins.push(item);
      // The latest colour bought is the one in use.
      skin = item;
    }
  }
  return {
    routeBest,
    routeStars: routeBest.map((b, i) => (b == null ? 0 : routeStars(i + 1, b))),
    freeBest,
    km: Math.round(metres / 100) / 10,
    savings: Math.max(0, earned - spent),
    gear,
    skins,
    skin,
  };
}

/** A route's best, read straight from the scores (for checking the next one is open). */
export async function okadaRouteBest(userId: string, n: number): Promise<number | null> {
  const { data } = await supabaseAdmin().from("solo_scores").select("score").eq("user_id", userId).eq("game_id", "okada-rush").eq("mode", `route-${n}`).order("score", { ascending: false }).limit(1);
  return (data?.[0]?.score as number | undefined) ?? null;
}
