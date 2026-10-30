"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { getUser } from "@/lib/room/server";
import { siteUrl } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { notify, displayName } from "@/lib/push/server";
import type { ActionResult } from "@/lib/room/types";
import { FRIEND_ROOM_SIZE, MAX_FRIEND_ROOMS } from "@/lib/room/types";
import { lackingPlus } from "@/lib/plus/server";
import { FREE_LIMITS } from "@/lib/plus/plans";
import { formatScore, soloGame } from "./catalog";

async function limited(uid: string, action: string, max: number, windowSeconds: number) {
  const { data } = await supabaseAdmin().rpc("server_rate_limit", { uid, action, max_hits: max, window_seconds: windowSeconds });
  return data !== true;
}

export type RoomOption = { id: string; name: string; members: number; full: boolean };
export type ChallengeOptions = {
  /** People in my rooms I can challenge directly. */
  people: { id: string; name: string; avatar_key: string; avatar_hue: number }[];
  /** Friend rooms a new person could join through a link. */
  rooms: RoomOption[];
  /** Whether "start a new friend room" fits my plan and the room limit. */
  canStartRoom: boolean;
  /** Why not, when it doesn't. */
  startRoomNote: string | null;
};

/** Who I can challenge, and where someone new could land. Only choices that fit are offered. */
export async function challengeOptions(): Promise<ActionResult<ChallengeOptions>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const admin = supabaseAdmin();
  const { data: mine } = await admin.from("room_members").select("room_id").eq("user_id", user.id);
  const roomIds = (mine ?? []).map((m) => m.room_id as string);
  const [{ data: rooms }, { data: members }, { data: blocks }] = await Promise.all([
    roomIds.length ? admin.from("rooms").select("id, name, kind").in("id", roomIds) : Promise.resolve({ data: [] as { id: string; name: string; kind: string }[] }),
    roomIds.length ? admin.from("room_members").select("room_id, user_id").in("room_id", roomIds) : Promise.resolve({ data: [] as { room_id: string; user_id: string }[] }),
    admin.from("blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
  ]);
  const blocked = new Set((blocks ?? []).map((b) => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id) as string));
  const peopleIds = [...new Set((members ?? []).map((m) => m.user_id as string))].filter((id) => id !== user.id && !blocked.has(id));
  const { data: profiles } = peopleIds.length ? await admin.from("profiles").select("id, display_name, avatar_key, avatar_hue").in("id", peopleIds) : { data: [] };
  const friendRooms = (rooms ?? []).filter((r) => r.kind === "friends");
  const roomOptions = friendRooms.map((r) => {
    const n = (members ?? []).filter((m) => m.room_id === r.id).length;
    return { id: r.id as string, name: r.name as string, members: n, full: n >= FRIEND_ROOM_SIZE };
  });
  const plus = !(await lackingPlus([user.id])).length;
  const limit = plus ? MAX_FRIEND_ROOMS : FREE_LIMITS.friendRooms;
  const canStartRoom = friendRooms.length < limit;
  return {
    ok: true,
    data: {
      people: (profiles ?? []).map((p) => ({ id: p.id as string, name: p.display_name as string, avatar_key: p.avatar_key as string, avatar_hue: p.avatar_hue as number })),
      rooms: roomOptions,
      canStartRoom,
      startRoomNote: canStartRoom ? null : plus ? `You're in ${MAX_FRIEND_ROOMS} friend rooms, the most anyone can be in.` : "The free plan includes one friend room. Amah Plus lets you be in up to five.",
    },
  };
}

const sendInput = z.object({
  scoreId: z.uuid(),
  /** Someone in my rooms. */
  to: z.uuid().optional(),
  /** A link for someone new: one of my friend rooms, or "new". */
  room: z.union([z.uuid(), z.literal("new")]).optional(),
});

/** Challenge someone to beat a score. Free for everyone. */
export async function sendChallenge(raw: unknown): Promise<ActionResult<{ token: string; url: string; text: string }>> {
  const p = sendInput.safeParse(raw);
  if (!p.success || (!p.data.to && !p.data.room)) return { ok: false, error: "Pick who to challenge." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (await limited(user.id, "solo_challenge", 30, 3600)) return { ok: false, error: "That's a lot of challenges. Give it a while." };
  const admin = supabaseAdmin();
  const { data: score } = await admin.from("solo_scores").select("id, user_id, game_id, mode, seed, score").eq("id", p.data.scoreId).maybeSingle();
  if (!score || score.user_id !== user.id) return { ok: false, error: "That score has wandered off." };
  const game = soloGame(score.game_id as string);
  if (!game || game.kind === "bot" || game.kind === "daily") return { ok: false, error: "That game can't be a challenge." };

  let toUser: string | null = null;
  let roomId: string | null = null;
  if (p.data.to) {
    const opts = await challengeOptions();
    if (!opts.ok || !opts.data.people.some((x) => x.id === p.data.to)) return { ok: false, error: "You can challenge people in your rooms." };
    toUser = p.data.to;
  } else if (p.data.room === "new") {
    const opts = await challengeOptions();
    if (!opts.ok || !opts.data.canStartRoom) return { ok: false, error: opts.ok ? (opts.data.startRoomNote ?? "You can't start another friend room.") : "Sign in first." };
    const me = await displayName(user.id);
    const { data: room, error } = await (await supabaseServer()).rpc("create_room", { room_name: `${me}'s challengers`.slice(0, 40), p_kind: "friends" });
    if (error || !room) return { ok: false, error: friendlyError(error) };
    roomId = (room as { id: string }).id;
  } else {
    const opts = await challengeOptions();
    const r = opts.ok ? opts.data.rooms.find((x) => x.id === p.data.room) : undefined;
    if (!r) return { ok: false, error: "Pick one of your friend rooms." };
    if (r.full) return { ok: false, error: `${r.name} is full. Pick another room, or start a new one.` };
    roomId = r.id;
  }

  const token = randomBytes(12).toString("base64url");
  const { error } = await admin.from("solo_challenges").insert({
    token,
    from_user: user.id,
    to_user: toUser,
    room_id: roomId,
    game_id: game.id,
    mode: score.mode,
    seed: score.seed,
    target: score.score,
    from_score_id: score.id,
  });
  if (error) return { ok: false, error: "Couldn't make that challenge. Try again?" };
  const me = await displayName(user.id);
  const target = formatScore(game, score.score as number);
  if (toUser) {
    await notify(toUser, "invites", { title: `${me} challenged you`, body: `Beat ${target} in ${game.name}.`, url: `/solo/${game.id}?challenge=${token}`, tag: `challenge-${token}` }, { evenIfHere: true });
  }
  const url = toUser ? `${siteUrl()}/solo/${game.id}?challenge=${token}` : `${siteUrl()}/c/${token}`;
  return { ok: true, data: { token, url, text: `${me} scored ${target} in ${game.name} on Amah. Think you can beat it?` } };
}

/**
 * Someone opening a challenge link, signed in: they join the friend room it was made for (never a
 * couple room) and get the game to play. Safe to call twice.
 */
export async function acceptChallengeLink(token: unknown): Promise<ActionResult<{ gameId: string; roomJoined: boolean; roomNote: string | null }>> {
  const t = z.string().regex(/^[A-Za-z0-9_-]{10,40}$/).safeParse(token);
  if (!t.success) return { ok: false, error: "That challenge link doesn't look right." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const admin = supabaseAdmin();
  const { data: c } = await admin.from("solo_challenges").select("*").eq("token", t.data).maybeSingle();
  if (!c) return { ok: false, error: "That challenge has wandered off." };
  if (c.from_user === user.id) return { ok: false, error: "That's your own challenge. Send it to someone!" };
  if (c.status !== "open" || Date.parse(c.expires_at as string) < Date.now()) return { ok: false, error: "That challenge has already been played or has run out." };
  let roomJoined = false;
  let roomNote: string | null = null;
  if (c.room_id) {
    const { error } = await admin.rpc("solo_join_challenge_room", { p_room: c.room_id, p_user: user.id });
    if (!error) roomJoined = true;
    // The room filled up, or a limit got in the way: they still get to play.
    else roomNote = /full/i.test(error.message) ? "That friend room filled up before you got there, but the challenge is still yours to play." : /plus required/i.test(error.message) ? "You're already in a friend room on the free plan, so you weren't added to this one. The challenge is still yours." : null;
  }
  return { ok: true, data: { gameId: c.game_id as string, roomJoined, roomNote } };
}
