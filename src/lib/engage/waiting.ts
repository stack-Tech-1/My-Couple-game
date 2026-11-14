import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { gameMeta } from "@/games/catalog";
import { isSpicy } from "@/games/after-dark/logic";
import { displayName, notify } from "@/lib/push/server";

/**
 * Games played over hours or days: once a day (the morning job), a gentle "still your move" to
 * whoever the game is waiting on, if nobody has moved for most of a day. Never more than one a
 * game a day (same tag, so it replaces), never for games left for over a week, and quiet hours
 * are respected by notify().
 */
const WAIT_HOURS = 18;
const GIVE_UP_DAYS = 7;
const MAX_GAMES = 300;

export async function remindWaitingMoves(now = Date.now()): Promise<{ reminded: number }> {
  const admin = supabaseAdmin();
  const { data: games } = await admin
    .from("game_sessions")
    .select("id, room_id, game_id, players, updated_at")
    .eq("status", "active")
    .lt("updated_at", new Date(now - WAIT_HOURS * 3600_000).toISOString())
    .gt("updated_at", new Date(now - GIVE_UP_DAYS * 864e5).toISOString())
    .order("updated_at", { ascending: false })
    .limit(MAX_GAMES);
  let reminded = 0;
  for (const g of games ?? []) {
    const { data: last } = await admin.from("game_moves").select("by_user").eq("session_id", g.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const mover = (last?.by_user as string | null) ?? null;
    // Nobody has moved yet: it's waiting on everyone but whoever started it, which we can't tell
    // apart here, so leave unstarted games alone.
    if (!mover) continue;
    const waitingOn = (g.players as string[]).filter((p) => p !== mover);
    const days = Math.max(1, Math.round((now - Date.parse(g.updated_at as string)) / 864e5));
    const game = isSpicy(g.game_id as string) ? null : (gameMeta(g.game_id as string)?.name ?? "your game");
    const name = await displayName(mover);
    for (const uid of waitingOn) {
      const sent = await notify(uid, "turns", {
        title: game ? `Still your move in ${game}` : "Still your move",
        body: `${name} played ${days === 1 ? "yesterday" : `${days} days ago`}. No rush, it'll wait for you.`,
        url: `/room/${g.room_id}/play/${g.id}`,
        tag: `game-${g.id}`,
      });
      if (sent) reminded++;
    }
  }
  return { reminded };
}
