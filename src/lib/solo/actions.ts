"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUser } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { soloGame } from "./catalog";
import { settleChallenge } from "./server";
import { soloFreePlays } from "@/lib/plus/limits";
import { FREE_PLAYS_PER_DAY, isPlusOnlySolo, untilText } from "@/lib/plus/plans";
import { isDailyMode, todaysGame } from "@/lib/engage/rotation";
import { DAYS, FREE_CAREER_MODES, dayOpen } from "./games/mama";
import { mamaDayBest } from "./mama-server";
import { ROUTES, routeOpen } from "./games/okada";
import { okadaRouteBest } from "./okada-server";
import { LEVELS, levelOpen } from "./games/zobo";
import { zoboLevelCleared } from "./zobo-server";
import { NIGHTS, nightOpen } from "./games/mosquito";
import { mosquitoNightCleared } from "./mosquito-server";
import { WALLS, wallOpen } from "./games/bashwall";
import { bashWallCleared } from "./bash-server";

async function limited(uid: string, action: string, max: number, windowSeconds: number) {
  const { data } = await supabaseAdmin().rpc("server_rate_limit", { uid, action, max_hits: max, window_seconds: windowSeconds });
  return data !== true;
}

const startInput = z.object({
  gameId: z.string().max(40),
  mode: z.string().regex(/^[a-z0-9-]{1,20}$/).default("normal"),
  /** Daily boards and challenges replay a known seed; otherwise the server picks one. */
  seed: z.string().regex(/^[A-Za-z0-9:_-]{1,80}$/).optional(),
  challenge: z.string().regex(/^[A-Za-z0-9_-]{10,40}$/).optional(),
});

/** `left`: free plays left today after this one (null when there's no limit). */
export type StartResult = ActionResult<{ runId: string; seed: string; target: number | null; left: number | null }> | { ok: false; error: string; resetsAt: string } | { ok: false; error: string; blocked: true } | { ok: false; error: string; plusOnly: true };

/** A start ticket. The only server call when a game begins. */
export async function startRun(raw: unknown): Promise<StartResult> {
  const p = startInput.safeParse(raw);
  if (!p.success || !soloGame(p.data.gameId)) return { ok: false, error: "We don't have that game." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to save your scores." };
  if (await limited(user.id, "solo_start", 120, 600)) return { ok: false, error: "Easy, tiger. Give it a minute and try again." };
  // Today's game: the same level for everyone, one go each, and it never uses a free play.
  const daily = isDailyMode(p.data.mode);
  if (daily) {
    const t = todaysGame();
    if (p.data.gameId !== t.gameId || p.data.mode !== t.mode) return { ok: false, error: "That was yesterday's game. Today's is waiting on your home screen.", blocked: true };
    const { count } = await supabaseAdmin().from("solo_runs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("mode", t.mode);
    if (count) return { ok: false, error: "You've had your go at today's game. A new one comes at midnight.", blocked: true };
  }
  // Mama Put's career: days open in order, one star on the day before.
  const careerDay = p.data.gameId === "mama-put" ? /^day-(\d{1,2})$/.exec(p.data.mode) : null;
  if (careerDay) {
    const day = Number(careerDay[1]);
    if (day < 1 || day > DAYS) return { ok: false, error: "There's no such day.", blocked: true };
    const before = day > 1 ? await mamaDayBest(user.id, day - 1) : null;
    if (!dayOpen(day, () => before ?? undefined)) return { ok: false, error: `Get a star on day ${day - 1} first.`, blocked: true };
  }
  // Okada Rush: routes open in order, one star on the route before.
  const route = p.data.gameId === "okada-rush" ? /^route-(\d)$/.exec(p.data.mode) : null;
  if (route) {
    const n = Number(route[1]);
    if (n < 1 || n > ROUTES.length) return { ok: false, error: "There's no such route.", blocked: true };
    const before = n > 1 ? await okadaRouteBest(user.id, n - 1) : null;
    if (!routeOpen(n, () => before ?? undefined)) return { ok: false, error: `Get a star on ${ROUTES[n - 2]} first.`, blocked: true };
  }
  // Zobo Sort: levels open in order, by finishing the one before.
  const zoboLevel = p.data.gameId === "zobo-sort" ? /^lvl-(\d{1,3})$/.exec(p.data.mode) : null;
  if (zoboLevel) {
    const n = Number(zoboLevel[1]);
    if (n < 1 || n > LEVELS) return { ok: false, error: "There's no such level.", blocked: true };
    const before = n > 1 ? await zoboLevelCleared(user.id, n - 1) : true;
    if (!levelOpen(n, () => before)) return { ok: false, error: `Finish level ${n - 1} first.`, blocked: true };
  }
  // Mosquito Wahala: nights open in order, by surviving the one before.
  const mosquitoNight = p.data.gameId === "mosquito-wahala" ? /^night-(\d{1,2})$/.exec(p.data.mode) : null;
  if (mosquitoNight) {
    const n = Number(mosquitoNight[1]);
    if (n < 1 || n > NIGHTS) return { ok: false, error: "There's no such night.", blocked: true };
    const before = n > 1 ? await mosquitoNightCleared(user.id, n - 1) : true;
    if (!nightOpen(n, () => before)) return { ok: false, error: `Survive night ${n - 1} first.`, blocked: true };
  }
  // Bash Am: walls open in order, by clearing the one before.
  const bashWall = p.data.gameId === "bash-am" ? /^wall-(\d{1,2})$/.exec(p.data.mode) : null;
  if (bashWall) {
    const n = Number(bashWall[1]);
    if (n < 1 || n > WALLS) return { ok: false, error: "There's no such wall.", blocked: true };
    const before = n > 1 ? await bashWallCleared(user.id, n - 1) : true;
    if (!wallOpen(n, () => before)) return { ok: false, error: `Clear wall ${n - 1} first.`, blocked: true };
  }
  // Bash Am and Mama Put need Plus for every way in, challenges included, apart from their free
  // taste (Bash Am's first wall, Mama Put's first two Yaba days).
  if (isPlusOnlySolo(p.data.gameId, p.data.mode) && (await soloFreePlays(user.id, p.data.gameId)).limited) {
    return { ok: false, error: `${soloGame(p.data.gameId)!.name} comes with Amah Plus.`, plusOnly: true };
  }
  // Without Plus, each game twice a day (Zobo Sort, one level a day). Challenges are always open, and so is Mama Put's Yaba.
  let left: number | null = null;
  const freeMode = p.data.gameId === "mama-put" && (FREE_CAREER_MODES as readonly string[]).includes(p.data.mode);
  if (!p.data.challenge && !daily && !freeMode) {
    const plays = await soloFreePlays(user.id, p.data.gameId);
    if (plays.limited) {
      const retry = !!plays.modes?.includes(p.data.mode);
      if (plays.left <= 0 && !retry) {
        const what = p.data.gameId === "zobo-sort" ? "free level" : `${FREE_PLAYS_PER_DAY} free games`;
        return { ok: false, error: `That's today's ${what}. It opens again ${untilText(plays.resetsAt)}.`, resetsAt: plays.resetsAt };
      }
      left = retry ? plays.left : plays.left - 1;
    }
  }

  const admin = supabaseAdmin();
  let seed = daily ? todaysGame().seed : (p.data.seed ?? randomBytes(9).toString("base64url"));
  let mode = p.data.mode;
  let challengeId: string | null = null;
  let target: number | null = null;
  if (p.data.challenge) {
    const { data: c } = await admin.from("solo_challenges").select("id, game_id, mode, seed, target, from_user, to_user, status, expires_at").eq("token", p.data.challenge).maybeSingle();
    // Only the person it was sent to (or anyone, for an open link) may play it, once, before it expires.
    if (c && c.game_id === p.data.gameId && c.status === "open" && c.from_user !== user.id && (!c.to_user || c.to_user === user.id) && Date.parse(c.expires_at as string) > Date.now()) {
      challengeId = c.id as string;
      seed = (c.seed as string) || seed;
      mode = c.mode as string;
      target = c.target as number;
    }
  }
  const { data, error } = await admin.from("solo_runs").insert({ user_id: user.id, game_id: p.data.gameId, mode, seed, challenge_id: challengeId }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't start. Try again?" };
  return { ok: true, data: { runId: data.id as string, seed, target, left } };
}

const finishInput = z.object({
  runId: z.uuid(),
  score: z.number().int().min(0).max(10_000_000),
  durationMs: z.number().int().min(0).max(24 * 3600_000),
  meta: z.record(z.string(), z.union([z.number(), z.string().max(80), z.boolean()])).optional(),
});

export type FinishResult = {
  scoreId: string;
  best: number;
  newBest: boolean;
  plays: number;
  challenge: { result: "won" | "lost"; target: number; from: string } | null;
};

/** Save a finished game. Light checks only: ticket, timing, and a plausible score for the time played. */
export async function finishRun(raw: unknown): Promise<ActionResult<FinishResult>> {
  const p = finishInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "That score didn't look right." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to save your scores." };
  if (await limited(user.id, "solo_finish", 120, 600)) return { ok: false, error: "Easy, tiger. Give it a minute and try again." };
  const admin = supabaseAdmin();
  const { data: run } = await admin.from("solo_runs").select("*").eq("id", p.data.runId).maybeSingle();
  if (!run || run.user_id !== user.id) return { ok: false, error: "That game has wandered off." };
  if (run.finished_at) return { ok: false, error: "That game is already saved." };
  const game = soloGame(run.game_id as string)!;
  const elapsed = Date.now() - Date.parse(run.started_at as string);
  // A ticket lasts a day, so a game finished after the phone died still counts.
  if (elapsed > 24 * 3600_000) return { ok: false, error: "That game is too old to save. Start a new one?" };
  // The time the phone says it took can't be longer than the time since the ticket (plus a little slack).
  const duration = Math.min(p.data.durationMs, elapsed + 5000);
  const score = p.data.score;
  if (!game.lowerIsBetter && score > game.cap(duration / 1000)) return { ok: false, error: "That score didn't add up, so it wasn't saved." };
  if (game.id === "reflex" && score < 80) return { ok: false, error: "Nobody is that fast. Not saved." };

  const { data: claimed } = await admin.from("solo_runs").update({ finished_at: new Date().toISOString() }).eq("id", run.id).is("finished_at", null).select("id");
  if (!claimed?.length) return { ok: false, error: "That game is already saved." };

  const [{ data: bestRow }, { count }] = await Promise.all([
    admin
      .from("solo_scores")
      .select("score")
      .eq("user_id", user.id)
      .eq("game_id", game.id)
      .eq("mode", run.mode)
      .order("score", { ascending: !!game.lowerIsBetter })
      .limit(1)
      .maybeSingle(),
    admin.from("solo_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("game_id", game.id),
  ]);
  const { data: saved, error } = await admin
    .from("solo_scores")
    .insert({ run_id: run.id, user_id: user.id, game_id: game.id, mode: run.mode, seed: run.seed, score, duration_ms: duration, meta: p.data.meta ?? {} })
    .select("id")
    .single();
  if (error || !saved) return { ok: false, error: "Couldn't save that score. Try again?" };

  const prev = bestRow?.score as number | undefined;
  const newBest = game.kind !== "bot" && (prev === undefined || (game.lowerIsBetter ? score < prev : score > prev));
  const best = prev === undefined ? score : game.lowerIsBetter ? Math.min(prev, score) : Math.max(prev, score);

  let challenge: FinishResult["challenge"] = null;
  if (run.challenge_id) challenge = await settleChallenge(run.challenge_id as string, user.id, score, saved.id as string);
  return { ok: true, data: { scoreId: saved.id as string, best, newBest, plays: (count ?? 0) + 1, challenge } };
}

/** A Solo game's how-to-play tour was finished or skipped: don't show it again. */
export async function markSoloToured(gameId: unknown): Promise<ActionResult> {
  const id = z.string().max(40).safeParse(gameId);
  if (!id.success || !soloGame(id.data)) return { ok: false, error: "Unknown game." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const admin = supabaseAdmin();
  const { data } = await admin.from("profiles").select("toured_games").eq("id", user.id).single();
  const seen = (data?.toured_games as string[] | null) ?? [];
  if (seen.includes(id.data)) return { ok: true, data: null };
  const { error } = await admin.from("profiles").update({ toured_games: [...seen, id.data] }).eq("id", user.id);
  return error ? { ok: false, error: "Couldn't save that." } : { ok: true, data: null };
}
