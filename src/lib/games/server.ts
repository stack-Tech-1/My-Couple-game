import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { GAME_LOGIC } from "@/games/logic";
import { MoveRejected, runMove, toDb, viewsFor } from "@/games/_engine/runner";
import type { PlayerList } from "@/games/_engine/types";
import type { SessionRow, SessionSnapshot } from "./types";
import { isSpicy } from "@/games/after-dark/logic";
import { getGameFlags } from "./flags.server";
import { getContentPack } from "@/lib/content/server";
import { after } from "next/server";
import { gameMeta, isFriendGame } from "@/games/catalog";
import { displayName, notifyPartner } from "@/lib/push/server";

/** Both current members confirmed 18+ and opted in. The same gate the database uses. */
async function spicyUnlocked(roomId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().rpc("spicy_unlocked", { p_room: roomId });
  return data === true;
}

/**
 * A plpgsql function declared to return a row type that does `return null` comes back from
 * PostgREST as an object with every column null, not as null. Only a real id means success.
 */
const isRow = (d: unknown): d is SessionRow => !!d && typeof d === "object" && typeof (d as { id?: unknown }).id === "string";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Game API auth. getClaims() verifies the session JWT's signature locally (asymmetric signing
 * keys), so a burst of moves doesn't become a burst of round-trips to the Auth server.
 */
async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (error || !id) throw new ApiError(401, "You've been signed out. Sign back in to keep playing.");
  return { supabase, user: { id } };
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
  // Session and view in parallel: RLS already limits game_views to my own row, and the session
  // check below still decides whether the caller gets anything back.
  const { supabase, user } = await requireUser();
  const [{ data: sessionRow }, { data }] = await Promise.all([
    supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase.from("game_views").select("view, version").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
  ]);
  const session = sessionRow as SessionRow | null;
  if (!session || !session.players.includes(user.id) || !data) throw new ApiError(404, "That game has wandered off.");
  const closing = isSpicy(session.game_id) && session.status === "active" ? !(await spicyUnlocked(session.room_id)) : false;
  return { session, view: data.view, version: data.version as number, serverNow: Date.now(), ...(closing ? { closing } : {}) };
}

/**
 * A friend-room member who isn't playing can watch: they get the game as an outsider sees it
 * (no hands, letters, answers or secret words), recomputed from the server state on each request.
 */
export async function watchSnapshot(sessionId: string): Promise<SessionSnapshot & { watching: true }> {
  const { supabase, user } = await requireUser();
  // RLS returns the session only to members of its room.
  const { data: row } = await supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle();
  const session = row as SessionRow | null;
  if (!session) throw new ApiError(404, "That game has wandered off.");
  const logic = GAME_LOGIC[session.game_id];
  const { data: room } = await supabase.from("rooms").select("kind").eq("id", session.room_id).maybeSingle();
  if (!logic || room?.kind !== "friends" || !isFriendGame(session.game_id)) throw new ApiError(404, "That game has wandered off.");
  if (session.players.includes(user.id)) throw new ApiError(409, "You're playing this one.");
  const { data: secret } = await supabaseAdmin().from("game_secrets").select("state").eq("session_id", sessionId).single();
  if (!secret) throw new ApiError(404, "That game has wandered off.");
  return { session, view: logic.viewFor(secret.state, user.id), version: session.version, serverNow: Date.now(), watching: true };
}

export async function createSession(gameId: string, rawConfig: unknown, rematchOf?: string, roomId?: string, opponent?: string, opponents?: string[]): Promise<SessionRow> {
  const { supabase, user } = await requireUser();
  const logic = GAME_LOGIC[gameId];
  if (!logic) throw new ApiError(404, "We don't have that game (yet).");
  if ((await getGameFlags()).off.includes(gameId)) throw new ApiError(403, "That game is taking a break. Try another one?");
  await rateLimit(user.id, "create_session", 20, 600);

  // Which room: a rematch stays where it was; otherwise the room asked for, else my couple room.
  let prev: SessionRow | null = null;
  if (rematchOf) {
    const { data: prevRow } = await supabase.from("game_sessions").select("*").eq("id", rematchOf).maybeSingle();
    prev = prevRow as SessionRow | null;
    if (prev && (prev.game_id !== gameId || !prev.players.includes(user.id))) prev = null;
  }
  let rid = prev?.room_id ?? roomId ?? null;
  if (!rid) {
    const { data: coupleId } = await supabase.rpc("my_room_id");
    rid = (coupleId as string | null) ?? null;
  }
  if (!rid) throw new ApiError(403, "You need a room first.");
  // RLS returns the room and its members only to members.
  const [{ data: roomInfo }, { data: members }] = await Promise.all([
    supabase.from("rooms").select("kind").eq("id", rid).maybeSingle(),
    supabase.from("room_members").select("user_id").eq("room_id", rid),
  ]);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!roomInfo || !ids.includes(user.id)) throw new ApiError(403, "You need a room first.");
  const friends = roomInfo.kind === "friends";
  const mine = { room_id: rid };

  // Who else is playing: your partner in a couple room; the friends you picked in a friend room.
  let others: string[];
  if (friends) {
    if (!isFriendGame(gameId) || logic.category === "spicy") throw new ApiError(403, "That game isn't in friend rooms yet.");
    others = prev ? prev.players.filter((p) => p !== user.id) : [...new Set(opponents?.length ? opponents : opponent ? [opponent] : [])];
    if (!others.length || others.some((o) => o === user.id || !ids.includes(o))) throw new ApiError(409, "Pick friends from this room to play with.");
    const total = others.length + 1;
    if (total > logic.maxPlayers) throw new ApiError(409, logic.maxPlayers === 2 ? "This one is for two. Pick one friend." : `Up to ${logic.maxPlayers} can play this one.`);
    if (total < logic.minPlayers) throw new ApiError(409, `This one needs at least ${logic.minPlayers} players.`);
    const list = others.join(",");
    const { count } = await supabaseAdmin().from("blocks").select("blocker_id", { count: "exact", head: true })
      .or(`and(blocker_id.in.(${list}),blocked_id.eq.${user.id}),and(blocker_id.eq.${user.id},blocked_id.in.(${list}))`);
    if (count) throw new ApiError(409, "Someone you picked can't play right now. Try different friends?");
  } else {
    const partner = ids.find((id) => id !== user.id);
    others = partner ? [partner] : [];
    if (logic.minPlayers > 2) throw new ApiError(403, "That one is for friend rooms.");
  }
  if (!others.length) throw new ApiError(409, "Games need two players. Invite your person first.");

  // After Dark: both must be confirmed and opted in. Heat cap and custom cards come from the
  // database, never from the client.
  let spicyConfig: Record<string, unknown> | null = null;
  if (logic.category === "spicy") {
    if (!(await spicyUnlocked(mine.room_id))) throw new ApiError(403, "That one's locked.");
    const { data: limits } = await supabaseAdmin().from("room_members").select("max_heat").eq("room_id", mine.room_id);
    const maxHeat = Math.min(...(limits ?? []).map((m) => Number(m.max_heat)), 3);
    const { data: custom } = await supabaseAdmin().from("custom_cards").select("deck, heat, text").eq("room_id", mine.room_id).lte("heat", maxHeat).limit(500);
    spicyConfig = { maxHeat, custom: custom ?? [] };
  }

  // Room house rules first, then anything the caller passed explicitly.
  const { data: roomRow } = await supabase.from("rooms").select("settings").eq("id", mine.room_id).single();
  const houseRules = ((roomRow?.settings as { houseRules?: Record<string, Record<string, unknown>> } | null)?.houseRules ?? {})[gameId] ?? {};
  let config: Record<string, unknown> = {};
  if (logic.configSchema) {
    const parsed = logic.configSchema.safeParse(spicyConfig ?? { ...houseRules, ...((rawConfig as Record<string, unknown> | undefined) ?? {}) });
    if (!parsed.success) throw new ApiError(400, "Those game settings didn't add up.");
    config = parsed.data as Record<string, unknown>;
  }

  // Rematch: whoever went second last time goes first now.
  let rematchId: string | undefined;
  if (prev) {
    // Both pressed Rematch? The second press joins the first one's game instead of replacing it.
    const { data: existing } = await supabase.from("game_sessions").select("*").eq("rematch_of", prev.id).eq("status", "active").maybeSingle();
    if (existing) return existing as SessionRow;
    rematchId = prev.id;
    // Keep the mode the last game was played in.
    const kept = Object.fromEntries((logic.rematchKeeps ?? []).filter((k) => k in prev.config).map((k) => [k, prev.config[k]]));
    if (Object.keys(kept).length && logic.configSchema) {
      const p = logic.configSchema.safeParse({ ...config, ...kept });
      if (p.success) config = p.data as Record<string, unknown>;
    }
    // firstPlayer is an index into players; map it through the previous seat order.
    const prevFirst = prev.config.firstPlayer;
    if (prev.players.length === 2 && (prevFirst === 0 || prevFirst === 1)) {
      const prevFirstUser = prev.players[prevFirst];
      config = { ...config, firstPlayer: prevFirstUser === user.id ? 1 : 0 };
    }
  }

  const players: PlayerList = [user.id, ...others];
  const seed = randomBytes(16).toString("hex");
  const state = logic.initialState(seed, players, config as never, { now: Date.now(), content: await getContentPack() });
  const firstTurn = (state as { turn?: unknown }).turn;
  if (players.length === 2 && !("firstPlayer" in config) && (firstTurn === 0 || firstTurn === 1)) config = { ...config, firstPlayer: firstTurn };

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
  if (error || !isRow(data)) throw new ApiError(500, "Couldn't set up the table. Try again?");
  const created = data as SessionRow;
  after(async () => {
    const name = await displayName(user.id);
    // After Dark never names the game outside the app.
    const game = logic.category === "spicy" ? null : (gameMeta(gameId)?.name ?? "a game");
    await notifyPartner(mine.room_id, user.id, "invites", {
      title: rematchId ? `${name} wants a rematch` : `${name} wants to play`,
      body: game ? `${game}. Tap to join.` : "Tap to join.",
      url: `/room/${mine.room_id}/play/${created.id}`,
      tag: `invite-${mine.room_id}`,
    }, others);
  });
  return created;
}

export async function submitMove(sessionId: string, rawMove: unknown): Promise<SessionSnapshot> {
  const { user, session: initial } = await loadOwnSession(sessionId);
  const logic = GAME_LOGIC[initial.game_id];
  if (!logic) throw new ApiError(404, "We don't have that game (yet).");
  const admin = supabaseAdmin();
  const readSecret = () => admin.from("game_secrets").select("state").eq("session_id", sessionId).single();

  // Every move is judged against the latest state. If another move commits between our
  // read and our write, the version check in commit_game_move fails and we simply retry.
  // Each step here is a database round trip, so independent ones run side by side.
  for (let attempt = 0; attempt < 5; attempt++) {
    // Order matters: version first, then state. A newer state with an older version can
    // only cause a harmless conflict; the reverse could never happen. The first attempt
    // reuses the session row we just loaded as its version read.
    let row: Pick<SessionRow, "version" | "status" | "players"> | null = initial;
    let secret: { state: unknown } | null;
    if (attempt === 0) {
      const [, s] = await Promise.all([rateLimit(user.id, "move", 300, 60), readSecret()]);
      secret = s.data;
    } else {
      ({ data: row } = await admin.from("game_sessions").select("version, status, players").eq("id", sessionId).single());
      if (!row) throw new ApiError(404, "That game has wandered off.");
      ({ data: secret } = await readSecret());
    }
    if (row.status !== "active") throw new ApiError(409, "This game is already over.");
    if (!secret) throw new ApiError(404, "That game has wandered off.");

    let result;
    try {
      result = runMove(logic, secret.state, rawMove, user.id, { now: Date.now() });
    } catch (e) {
      if (e instanceof MoveRejected) throw new ApiError(422, e.message);
      throw e;
    }

    let db = toDb(result.outcome);
    if (isSpicy(initial.game_id) && db.status === "active" && !(await spicyUnlocked(initial.room_id))) {
      db = { status: "finished", outcome: "complete", winner: null };
    }
    const { data, error } = await admin.rpc("commit_game_move", {
      p_session: sessionId,
      p_expected_version: row.version,
      p_by: user.id,
      p_move: result.move,
      p_state: result.next,
      p_views: viewsFor(logic, result.next, row.players),
      p_status: db.status,
      p_outcome: db.outcome,
      p_winner: db.winner,
    });
    if (error) throw new ApiError(500, "Couldn't save that move. Try again?");
    if (isRow(data)) {
      const s = data;
      if (s.status === "active") {
        // One notification per game, quietly kept up to date, and only if they're away.
        after(async () => {
          const name = await displayName(user.id);
          const game = isSpicy(initial.game_id) ? null : (gameMeta(initial.game_id)?.name ?? "your game");
          await notifyPartner(initial.room_id, user.id, "turns", {
            title: game ? `Your move in ${game}` : "Your move",
            body: `${name} just played. Tap to carry on.`,
            url: `/room/${initial.room_id}/play/${sessionId}`,
            tag: `game-${sessionId}`,
            quiet: true,
          });
        });
      }
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
  // A group game can't hand the win to one person: leaving ends it for everyone, unscored.
  const group = session.players.length > 2;
  const { data, error } = await admin.rpc("commit_game_move", {
    p_session: sessionId,
    p_expected_version: session.version,
    p_by: user.id,
    p_move: { resign: true },
    p_state: secret.state,
    p_views: viewsFor(logic, secret.state, session.players),
    p_status: "finished",
    // Competitive: the partner wins. Co-op: the team falls short. Everything else simply ends.
    p_outcome: coop ? "coop_loss" : logic.category === "competitive" && !group ? "win" : "complete",
    p_winner: coop || group || logic.category !== "competitive" ? null : partner,
  });
  if (error) throw new ApiError(500, "Couldn't end the game. Try again?");
  if (!isRow(data)) throw new ApiError(409, "stale");
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