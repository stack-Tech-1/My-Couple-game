import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notify, displayName } from "@/lib/push/server";
import { SOLO_GAMES, formatScore, soloGame } from "./catalog";

/** Has the challenger been beaten? Called once, when the challenged person's game is saved. */
export async function settleChallenge(challengeId: string, userId: string, score: number, scoreId: string): Promise<{ result: "won" | "lost"; target: number; from: string } | null> {
  const admin = supabaseAdmin();
  const { data: c } = await admin.from("solo_challenges").select("*").eq("id", challengeId).maybeSingle();
  if (!c || c.status !== "open") return null;
  const game = soloGame(c.game_id as string);
  if (!game) return null;
  const target = c.target as number;
  const won = game.lowerIsBetter ? score < target : score > target;
  const { data: done } = await admin
    .from("solo_challenges")
    .update({ status: won ? "won" : "lost", accepted_by: userId, result_score: score, finished_at: new Date().toISOString() })
    .eq("id", challengeId)
    .eq("status", "open")
    .select("id");
  if (!done?.length) return null;
  const [me, from] = await Promise.all([displayName(userId), displayName(c.from_user as string)]);
  void scoreId;
  await notify(
    c.from_user as string,
    "invites",
    {
      title: won ? `${me} beat your ${formatScore(game, target)}` : `${me} couldn't beat your ${formatScore(game, target)}`,
      body: won ? `${formatScore(game, score)} in ${game.name}. Your move.` : `They got ${formatScore(game, score)} in ${game.name}. You're still on top.`,
      url: `/solo/${game.id}`,
      tag: `challenge-${challengeId}`,
    },
    { evenIfHere: true },
  );
  return { result: won ? "won" : "lost", target, from };
}

export type Best = { gameId: string; mode: string; best: number; plays: number };

/** My best per game (and mode), for the Solo home. */
export async function myBests(userId: string): Promise<Best[]> {
  const { data } = await supabaseAdmin().from("solo_scores").select("game_id, mode, score").eq("user_id", userId).limit(5000);
  const out = new Map<string, Best>();
  for (const r of data ?? []) {
    const g = soloGame(r.game_id as string);
    if (!g) continue;
    const key = `${r.game_id}|${r.mode}`;
    const cur = out.get(key);
    const s = r.score as number;
    if (!cur) out.set(key, { gameId: r.game_id as string, mode: r.mode as string, best: s, plays: 1 });
    else {
      cur.plays++;
      cur.best = g.lowerIsBetter ? Math.min(cur.best, s) : Math.max(cur.best, s);
    }
  }
  return [...out.values()];
}

/** Monday 00:00 Lagos time, this week. */
export function weekStart(now = Date.now()): string {
  const lagos = new Date(now + 3600_000);
  const sinceMonday = (lagos.getUTCDay() + 6) % 7;
  const monday = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() - sinceMonday);
  return new Date(monday - 3600_000).toISOString();
}

export type BoardRow = { userId: string; best: number };

/** This week's best per member of a room, for one game. */
export async function roomBoard(memberIds: string[], gameId: string, mode = "normal"): Promise<BoardRow[]> {
  const g = soloGame(gameId);
  if (!g || !memberIds.length) return [];
  const { data } = await supabaseAdmin()
    .from("solo_scores")
    .select("user_id, score")
    .eq("game_id", gameId)
    .eq("mode", mode)
    .in("user_id", memberIds)
    .gte("created_at", weekStart())
    .limit(5000);
  const best = new Map<string, number>();
  for (const r of data ?? []) {
    const u = r.user_id as string;
    const s = r.score as number;
    const cur = best.get(u);
    best.set(u, cur === undefined ? s : g.lowerIsBetter ? Math.min(cur, s) : Math.max(cur, s));
  }
  return [...best.entries()].map(([userId, b]) => ({ userId, best: b })).sort((a, b) => (g.lowerIsBetter ? a.best - b.best : b.best - a.best));
}

export type IncomingChallenge = { token: string; gameId: string; target: number; fromName: string; createdAt: string };

/** Open challenges sent to me. */
export async function incomingChallenges(userId: string): Promise<IncomingChallenge[]> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("solo_challenges")
    .select("token, game_id, target, from_user, created_at")
    .eq("to_user", userId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  if (!data?.length) return [];
  const ids = [...new Set(data.map((c) => c.from_user as string))];
  const { data: people } = await admin.from("profiles").select("id, display_name").in("id", ids);
  return data
    .filter((c) => SOLO_GAMES.some((g) => g.id === c.game_id))
    .map((c) => ({
      token: c.token as string,
      gameId: c.game_id as string,
      target: c.target as number,
      fromName: ((people ?? []).find((p) => p.id === c.from_user)?.display_name as string | undefined) ?? "A friend",
      createdAt: c.created_at as string,
    }));
}
