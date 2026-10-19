"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { getUser } from "./server";
import { HOUSE_RULES } from "@/games/houseRules";
import {
  inviteCodeInput,
  prefsInput,
  profileInput,
  roomNameInput,
  type ActionResult,
  type Room,
} from "./types";

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyError(e) });
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "That didn't look right.";

export async function saveProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return fail(error);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

export async function createRoom(name: unknown): Promise<ActionResult<Room>> {
  const parsed = roomNameInput.safeParse(name ?? "Our room");
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_room", { room_name: parsed.data });
  if (error) return fail(error);
  return { ok: true, data: data as Room };
}

export async function peekInvite(code: unknown): Promise<ActionResult<{ room_name: string; inviter_name: string; is_full: boolean } | null>> {
  const parsed = inviteCodeInput.safeParse(code);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("peek_invite", { code: parsed.data });
  if (error) return fail(error);
  const row = (data as { room_name: string; inviter_name: string; is_full: boolean }[] | null)?.[0];
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

export async function regenerateInvite(): Promise<ActionResult<string>> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("regenerate_invite");
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
  const { error } = await supabase.from("room_members").update(parsed.data).eq("user_id", user.id);
  if (error) return fail(error);
  return { ok: true, data: null };
}

export async function leaveRoom(): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("leave_room");
  if (error) return fail(error);
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
  const { error: leaveErr } = await supabase.rpc("leave_room");
  if (leaveErr) return fail(leaveErr);
  // Clear this browser's session while the user still exists, then remove them.
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) return fail(error);
  return { ok: true, data: null };
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return { ok: true, data: null };
}