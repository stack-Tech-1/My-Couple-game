"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { getUser } from "./server";
import { purgeRoomMedia } from "@/lib/media/purge";
import { TERMS_VERSION } from "@/lib/legal";
import { z } from "zod";
import { HOUSE_RULES } from "@/games/houseRules";
import {
  inviteCodeInput,
  prefsInput,
  profileInput,
  roomNameInput,
  REPORT_REASONS,
  type ActionResult,
  type Room,
  type RoomKind,
} from "./types";

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyError(e) });
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "That didn't look right.";

/** What gets stored when someone confirms they're 18+ and accepts the current Terms. */
const consent = () => {
  const now = new Date().toISOString();
  return { adult_confirmed_at: now, terms_version: TERMS_VERSION, terms_accepted_at: now };
};

export async function saveProfile(input: unknown, agreed?: unknown): Promise<ActionResult> {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (agreed !== true) return { ok: false, error: "Please confirm you're 18 or older and agree to the Terms and Privacy Policy." };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, ...consent(), onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return fail(error);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

export async function createRoom(name: unknown, kind: unknown = "couple"): Promise<ActionResult<Room>> {
  const k = kind === "friends" ? "friends" : "couple";
  const parsed = roomNameInput.safeParse(name ?? (k === "couple" ? "Our room" : "Our crew"));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_room", { room_name: parsed.data, p_kind: k });
  if (error) return fail(error);
  revalidatePath("/room", "layout");
  return { ok: true, data: data as Room };
}

export type InvitePeek = { room_id: string; room_name: string; inviter_name: string; is_full: boolean; kind: RoomKind; member_count: number };
export async function peekInvite(code: unknown): Promise<ActionResult<InvitePeek | null>> {
  const parsed = inviteCodeInput.safeParse(code);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("peek_invite", { code: parsed.data });
  if (error) return fail(error);
  const row = (data as InvitePeek[] | null)?.[0];
  return { ok: true, data: row ?? null };
}

export async function joinRoom(code: unknown): Promise<ActionResult<Room>> {
  const parsed = inviteCodeInput.safeParse(code);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("join_room", { code: parsed.data });
  if (error) return fail(error);
  revalidatePath("/room", "layout");
  return { ok: true, data: data as Room };
}

export async function regenerateInvite(roomId?: string): Promise<ActionResult<string>> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("regenerate_invite", roomId ? { p_room: roomId } : {});
  if (error) return fail(error);
  return { ok: true, data: data as string };
}

export async function renameRoom(roomId: string, name: unknown): Promise<ActionResult> {
  const parsed = roomNameInput.safeParse(name);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("rooms").update({ name: parsed.data }).eq("id", roomId);
  if (error) return fail(error);
  revalidatePath(`/room/${roomId}`, "layout");
  return { ok: true, data: null };
}

export async function updateHouseRules(roomId: string, gameId: string, input: unknown): Promise<ActionResult> {
  const def = HOUSE_RULES[gameId];
  if (!def) return { ok: false, error: "That game doesn't have house rules." };
  const parsed = def.schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those rules didn't add up." };
  const supabase = await supabaseServer();
  const { data: room, error: readErr } = await supabase.from("rooms").select("settings").eq("id", roomId).single();
  if (readErr || !room) return fail(readErr ?? "not found");
  const settings = (room.settings ?? {}) as { houseRules?: Record<string, unknown> };
  const next = { ...settings, houseRules: { ...(settings.houseRules ?? {}), [gameId]: parsed.data } };
  const { error } = await supabase.from("rooms").update({ settings: next }).eq("id", roomId);
  if (error) return fail(error);
  revalidatePath(`/room/${roomId}`, "layout");
  return { ok: true, data: null };
}

export async function updateMyPrefs(input: unknown): Promise<ActionResult> {
  const parsed = prefsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const supabase = await supabaseServer();
  const { theme, ...perRoom } = parsed.data;
  if (theme) {
    const { error } = await supabase.from("profiles").update({ theme }).eq("id", user.id);
    if (error) return fail(error);
  }
  if (Object.keys(perRoom).length) {
    const { error } = await supabase.from("room_members").update(perRoom).eq("user_id", user.id);
    if (error) return fail(error);
  }
  return { ok: true, data: null };
}

/** The caller's couple room id, read before leaving so its files can be tidied up afterwards. */
async function myRoomId(): Promise<string | null> {
  const { data } = await (await supabaseServer()).rpc("my_room_id");
  return (data as string | null) ?? null;
}

export async function setAnnouncementEmails(on: unknown): Promise<ActionResult> {
  if (typeof on !== "boolean") return { ok: false, error: "That didn't look right." };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const { error } = await (await supabaseServer()).from("profiles").update({ announcement_emails: on }).eq("id", user.id);
  if (error) return fail(error);
  return { ok: true, data: null };
}

export async function leaveRoom(): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const roomId = await myRoomId();
  const { error } = await supabase.rpc("leave_room");
  if (error) return fail(error);
  if (roomId) await purgeRoomMedia(roomId);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

/**
 * Permanently deletes the account. Leaves the room first (so the partner keeps a
 * working room and gets a fresh invite), then deletes the auth user; every row the
 * user owns is removed by ON DELETE CASCADE.
 */
export async function deleteAccount(confirmation: unknown): Promise<ActionResult> {
  if (confirmation !== "delete") return { ok: false, error: 'Type "delete" to confirm.' };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const supabase = await supabaseServer();
  // Photos live in storage, which doesn't cascade with the database: remove them explicitly.
  const admin = supabaseAdmin();
  const { data: photos } = await admin.from("memories").select("path").eq("author_id", user.id);
  if (photos?.length) await admin.storage.from("memories").remove(photos.map((p) => p.path as string));
  // Every room they're in: couple and friend rooms (owners hand over to the longest-standing member).
  const { data: memberships } = await admin.from("room_members").select("room_id").eq("user_id", user.id);
  const roomIds = (memberships ?? []).map((m) => m.room_id as string);
  const { error: leaveErr } = await admin.rpc("admin_remove_from_room", { p_user: user.id });
  if (leaveErr) return fail(leaveErr);
  // Clear this browser's session while the user still exists, then remove them.
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) return fail(error);
  // Their messages are gone now (cascade), so their voice notes and stickers can go too.
  await Promise.all(roomIds.map((id) => purgeRoomMedia(id)));
  return { ok: true, data: null };
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return { ok: true, data: null };
}
/** Existing accounts accepting the current Terms (and confirming 18+) when they change. */
export async function acceptTerms(agreed: unknown): Promise<ActionResult> {
  if (agreed !== true) return { ok: false, error: "Please tick the box to continue." };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const { error } = await (await supabaseServer()).from("profiles").update(consent()).eq("id", user.id);
  if (error) return fail(error);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

const reportInput = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000, "Keep it under 1000 characters.").optional(),
  messageId: z.uuid().optional(),
});

/** Report your partner, optionally pointing at one of their messages. */
export async function reportPartner(input: unknown): Promise<ActionResult> {
  const parsed = reportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("file_report", { p_reason: parsed.data.reason, p_details: parsed.data.details ?? null, p_message: parsed.data.messageId ?? null });
  if (error) return fail(error);
  return { ok: true, data: null };
}

/** Block your partner: you leave the room (they keep it) and the two of you can't pair again. */
export async function blockPartner(): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("block_partner");
  if (error) return fail(error);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

// ---- friend rooms --------------------------------------------------------------------------------

const uuid = z.uuid();

/** Leave a friend room. Owners may name who takes over; otherwise the longest-standing member does. */
export async function leaveFriendRoom(roomId: unknown, nextOwner?: unknown): Promise<ActionResult> {
  const rid = uuid.safeParse(roomId);
  const heir = nextOwner == null ? null : uuid.safeParse(nextOwner);
  if (!rid.success || (heir && !heir.success)) return { ok: false, error: "That didn't look right." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("leave_room", { p_room: rid.data, p_next_owner: heir?.data ?? null });
  if (error) return fail(error);
  await purgeRoomMedia(rid.data);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

/** Owner only: remove someone from the friend room. */
export async function removeFriend(roomId: unknown, userId: unknown): Promise<ActionResult> {
  const rid = uuid.safeParse(roomId);
  const who = uuid.safeParse(userId);
  if (!rid.success || !who.success) return { ok: false, error: "That didn't look right." };
  const { error } = await (await supabaseServer()).rpc("kick_room_member", { p_room: rid.data, p_user: who.data });
  if (error) return fail(error);
  await purgeRoomMedia(rid.data);
  revalidatePath(`/room/${rid.data}`, "layout");
  return { ok: true, data: null };
}

/** Owner only: hand the room to another member. */
export async function makeOwner(roomId: unknown, userId: unknown): Promise<ActionResult> {
  const rid = uuid.safeParse(roomId);
  const who = uuid.safeParse(userId);
  if (!rid.success || !who.success) return { ok: false, error: "That didn't look right." };
  const { error } = await (await supabaseServer()).rpc("transfer_room_owner", { p_room: rid.data, p_user: who.data });
  if (error) return fail(error);
  revalidatePath(`/room/${rid.data}`, "layout");
  return { ok: true, data: null };
}

const friendReportInput = reportInput.extend({ roomId: z.uuid(), reportedId: z.uuid() });

/** Report someone in a friend room, optionally pointing at one of their messages. */
export async function reportMember(input: unknown): Promise<ActionResult> {
  const parsed = friendReportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { error } = await (await supabaseServer()).rpc("file_report", {
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? null,
    p_message: parsed.data.messageId ?? null,
    p_room: parsed.data.roomId,
    p_reported: parsed.data.reportedId,
  });
  if (error) return fail(error);
  return { ok: true, data: null };
}

/** Block or unblock someone you share a friend room with: their messages and invites are hidden from you. */
export async function setBlocked(userId: unknown, blocked: boolean): Promise<ActionResult> {
  const who = uuid.safeParse(userId);
  if (!who.success) return { ok: false, error: "That didn't look right." };
  const { error } = await (await supabaseServer()).rpc(blocked ? "block_member" : "unblock_member", { p_user: who.data });
  if (error) return fail(error);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}
