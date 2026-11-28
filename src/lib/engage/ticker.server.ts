import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatScore, soloGame } from "@/lib/solo/catalog";
import { lagosDate, weekStart } from "./rotation";
import { themeOn } from "./themes";
import { winnerLine, winnerName, type SpotlightWinner } from "./spotlight-shared";
import { TICKER_DEFAULT, TICKER_GAMES, tickerSchema, type TickerConfig } from "./ticker";

export async function tickerConfig(): Promise<TickerConfig> {
  const { data } = await supabaseAdmin().from("app_config").select("value").eq("key", "ticker").maybeSingle();
  const parsed = tickerSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : TICKER_DEFAULT;
}

/** This week's best in one game: the top score since Monday (Lagos), first name only. */
async function weeksBest(gameId: string, mode: string): Promise<string | null> {
  const game = soloGame(gameId);
  if (!game) return null;
  const since = `${weekStart()}T00:00:00+01:00`;
  const { data } = await supabaseAdmin()
    .from("solo_scores")
    .select("user_id, score")
    .eq("game_id", gameId)
    .eq("mode", mode)
    .gte("created_at", since)
    .order("score", { ascending: !!game.lowerIsBetter })
    .limit(1);
  const top = data?.[0];
  if (!top) return null;
  const { data: who } = await supabaseAdmin().from("profiles").select("display_name").eq("id", top.user_id).maybeSingle();
  const first = ((who?.display_name as string | undefined) ?? "").trim().split(/\s+/)[0];
  if (!first) return null;
  return `Best at ${game.name} this week: ${first}, ${formatScore(game, top.score as number)}`;
}

/**
 * What the strip says right now: the admin's message, a themed day, the weekly winners and the
 * week's best in the chosen games. Empty means the strip shows the page's own words. Cached for
 * a few minutes, and refreshed straight away when the admin saves.
 */
export const tickerNews = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const cfg = await tickerConfig();
      const items: string[] = [];
      if (cfg.message) items.push(cfg.message);
      const theme = themeOn(lagosDate());
      if (theme) items.push(`${theme.name}: ${theme.blurb}`);
      if (cfg.winners) {
        const { data } = await supabaseAdmin().rpc("spotlight_current");
        for (const w of ((data ?? []) as SpotlightWinner[]).filter(Boolean)) {
          items.push(`${w.kind === "couple" ? "Couple of the Week" : "Gang of the Week"}: ${winnerName(w)}, ${winnerLine(w)}`);
        }
      }
      const picked = TICKER_GAMES.filter((g) => cfg.games.includes(g.id));
      const bests = await Promise.all(picked.map((g) => weeksBest(g.id, g.mode)));
      for (const b of bests) if (b) items.push(b);
      return items;
    } catch {
      return [];
    }
  },
  ["ticker-news"],
  { revalidate: 300, tags: ["ticker"] },
);
