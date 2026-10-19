import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { GAME_LOGIC } from "@/games/logic";
import { MoveRejected, runMove, toDb, viewsFor } from "@/games/_engine/runner";
import type { Players } from "@/games/_engine/types";
import type { SessionRow, SessionSnapshot } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requireUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new ApiError(401, "You've been signed out. Sign back in to keep playing.");
  return { supabase, user: data.user };
}

async function rateLimit(uid: string, action: string, max: number, windowSeconds: number) {
  const { data, error } = await supabaseAdmin().rpc("server_rate_limit", { uid, action, max_hits: max, window_seconds: windowSeconds });
  if (error) throw new ApiError(500, "Something went sideways. Try that once more?");
  if (data !== true) throw new ApiError(429, "Easy, tiger. Give it a minute and try again.");
}

/** Loads a session the caller can see (RLS), and makes sure they're one of its players. */
async function loadOwnSession(sessionId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle();
  const session = data as SessionRow | null;
  if (!session || !session.players.includes(user.id)) throw new ApiError(404, "That game has wandered off.");
  return { supabase, user, session };
}

export async function getSnapshot(sessionId: string): Promise<SessionSnapshot> {
  const { supabase, user, session } = await loadOwnSession(sessionId);
  const { data } = await supabase.from("game_views").select("view, version").eq("session_id", sessionId).eq("user_id", user.id).single();
  if (!data) throw new ApiError(404, "That game has wandered off.");
  return { session, view: data.view, version: data.version as number, serverNow: Date.now() };
}

export async function createSession(gameId: string, rawConfig: unknown, rematchOf?: string): Promise<SessionRow> {
  const { supabase, user } = await requireUser();
  const logic = GAME_LOGIC[gameId];
  if (!logic) throw new ApiError(404, "We don't have that game (yet).");
  await rateLimit(user.id, "create_session", 20, 600);

  const { data: members } = await supabase.from("room_members").select("room_id, user_id, spicy_opt_in, age_confirmed_at");
  const mine = members?.find((m) => m.user_id === user.id);
  const partner = members?.find((m) => m.user_id !== user.id && m.room_id === mine?.room_id);
  if (!mine) throw new ApiError(403, "You need a room first.");
  if (!partner) throw new ApiError(409, "Games need two players. Invite your person first.");

  if (logic.category === "spicy") {
    const ok = [mine, partner].every((m) => m.spicy_opt_in && m.age_confirmed_at);
    if (!ok) throw new ApiError(403, "That one's locked.");
  }

  // Room house rules first, then anything the caller passed explicitly.
  const { data: roomRow } = await supabase.from("rooms").select("settings").eq("id", mine.room_id).single();
  const houseRules = ((roomRow?.settings as { houseRules?: Record<string, Record<string, unknown>> } | null)?.houseRules ?? {})[gameId] ?? {};
  let config: Record<string, unknown> = {};
  if (logic.configSchema) {
    const parsed = logic.configSchema.safeParse({ ...houseRules, ...((rawConfig as Record<string, unknown> | undefined) ?? {}) });
    if (!parsed.success) throw new ApiError(400, "Those game settings didn't add up.");
    config = parsed.data as Record<string, unknown>;
  }

  // Rematch: whoever went second last time goes first now.
  let rematchId: string | undefined;
  if (rematchOf) {
    const { data: prevRow } = await supabase.from("game_sessions").select("*").eq("id", rematchOf).maybeSingle();
    const prev = prevRow as SessionRow | null;
    if (prev && prev.game_id === gameId && prev.room_id === mine.room_id) {
      // Both pressed Rematch? The second press joins the first one's game instead of replacing it.
      const { data: existing } = await supabase.from("game_sessions").select("*").eq("rematch_of", prev.id).eq("status", "active").maybeSingle();
      if (existing) return existing as SessionRow;
      rematchId = prev.id;
      // firstPlayer is an index into players; map it through the previous seat order.
      const prevFirst = prev.config.firstPlayer;
      if (prevFirst === 0 || prevFirst === 1) {
        const prevFirstUser = prev.players[prevFirst];
        config = { ...config, firstPlayer: prevFirstUser === user.id ? 1 : 0 };
      }
    }
  }

  const players: Players = [user.id, partner.user_id];
  const seed = randomBytes(16).toString("hex");
  const state = logic.initialState(seed, players, config as never, { now: Date.now() });
  const firstTurn = (state as { turn?: unknown }).turn;
  if (!("firstPlayer" in config) && (firstTurn === 0 || firstTurn === 1)) config = { ...config, firstPlayer: firstTurn };

  const { data, error } = await supabaseAdmin().rpc("create_game_session", {
    p_room: mine.room_id,
    p_game: gameId,
    p_players: players,
    p_created_by: user.id,
    p_config: config,
    p_seed: seed,
    p_state: state,
    p_views: viewsFor(logic, state, players),
    p_rematch_of: rematchId ?? null,
  });
  if (error || !data) throw new ApiError(500, "Couldn't set up the table. Try again?");
  return data as SessionRow;
}

export async function submitMove(sessionId: string, rawMove: unknown): Promise<SessionSnapshot> {
  const { user, session: initial } = await loadOwnSession(sessionId);
  await rateLimit(user.id, "move", 300, 60);
  const logic = GAME_LOGIC[initial.game_id];
  if (!logic) throw new ApiError(404, "We don't have that game (yet).");
  const admin = supabaseAdmin();

  // Every move is judged against the latest state. If another move commits between our
  // read and our write, the version check in commit_game_move fails and we simply retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    // Order matters: version first, then state. A newer state with an older version can
    // only cause a harmless conflict; the reverse could never happen.
    const { data: row } = await admin.from("game_sessions").select("version, status, players").eq("id", sessionId).single();
    if (!row) throw new ApiError(404, "That game has wandered off.");
    if (row.status !== "active") throw new ApiError(409, "This game is already over.");
    const { data: secret } = await admin.from("game_secrets").select("state").eq("session_id", sessionId).single();
    if (!secret) throw new ApiError(404, "That game has wandered off.");

    let result;
    try {
      result = runMove(logic, secret.state, rawMove, user.id, { now: Date.now() });
    } catch (e) {
      if (e instanceof MoveRejected) throw new ApiError(422, e.message);
      throw e;
    }

    const db = toDb(result.outcome);
    const { data, error } = await admin.rpc("commit_game_move", {
      p_session: sessionId,
      p_expected_version: row.version,
      p_by: user.id,
      p_move: result.move,
      p_state: result.next,
      p_views: viewsFor(logic, result.next, row.players as Players),
      p_status: db.status,
      p_outcome: db.outcome,
      p_winner: db.winner,
    });
    if (error) throw new ApiError(500, "Couldn't save that move. Try again?");
    if (data) {
      const s = data as SessionRow;
      return { session: s, view: logic.viewFor(result.next, user.id), version: s.version, serverNow: Date.now() };
    }
  }
  throw new ApiError(409, "stale");
}
/** Resigning hands the win to your partner. Co-op games just end as a loss for the team. */
export async function resign(sessionId: string): Promise<SessionRow> {
  const { user, session } = await loadOwnSession(sessionId);
  if (session.status !== "active") throw new ApiError(409, "This game is already over.");
  const logic = GAME_LOGIC[session.game_id];
  if (!logic) throw new ApiError(404, "We don't have that game (yet).");

  const admin = supabaseAdmin();
  const { data: secret } = await admin.from("game_secrets").select("state").eq("session_id", sessionId).single();
  if (!secret) throw new ApiError(404, "That game has wandered off.");

  const partner = session.players.find((p) => p !== user.id) ?? null;
  const coop = logic.category === "coop";
  const { data, error } = await admin.rpc("commit_game_move", {
    p_session: sessionId,
    p_expected_version: session.version,
    p_by: user.id,
    p_move: { resign: true },
    p_state: secret.state,
    p_views: viewsFor(logic, secret.state, session.players),
    p_status: "finished",
    // Competitive: the partner wins. Co-op: the team falls short. Everything else simply ends.
    p_outcome: coop ? "coop_loss" : logic.category === "competitive" ? "win" : "complete",
    p_winner: coop || logic.category !== "competitive" ? null : partner,
  });
  if (error) throw new ApiError(500, "Couldn't end the game. Try again?");
  if (!data) throw new ApiError(409, "stale");
  return data as SessionRow;
}

export async function activeSessions(roomId: string): Promise<SessionRow[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("game_sessions").select("*").eq("room_id", roomId).eq("status", "active").order("created_at", { ascending: false });
  return (data ?? []) as SessionRow[];
}

export type Scoreboard = { totals: Record<string, number>; ties: number; byGame: Record<string, Record<string, number>> };

export async function scoreboard(roomId: string): Promise<Scoreboard> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("room_scoreboard", { p_room: roomId });
  const rows = (data ?? []) as { game_id: string; user_id: string; wins: number; ties: number }[];
  const totals: Record<string, number> = {};
  const byGame: Record<string, Record<string, number>> = {};
  const tiesByGame: Record<string, number> = {};
  for (const r of rows) {
    totals[r.user_id] = (totals[r.user_id] ?? 0) + Number(r.wins);
    (byGame[r.game_id] ??= {})[r.user_id] = Number(r.wins);
    tiesByGame[r.game_id] = Number(r.ties);
  }
  return { totals, ties: Object.values(tiesByGame).reduce((a, b) => a + b, 0), byGame };
}