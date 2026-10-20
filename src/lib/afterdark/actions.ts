"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { getMyRoom } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { FANTASY } from "@/content/after-dark";

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyError(e) });

async function ctx() {
  const bundle = await getMyRoom();
  if (!bundle) throw new Error("not signed in");
  return { bundle, supabase: await supabaseServer(), roomId: bundle.room.id, me: bundle.me.profile.id };
}
const done = (roomId: string): ActionResult => {
  revalidatePath(`/room/${roomId}`, "layout");
  return { ok: true, data: null };
};

/** 18+ confirmation: a checkbox. Only the timestamp is stored. Withdrawing it also opts you out. */
export async function setAgeConfirmed(confirmed: unknown): Promise<ActionResult> {
  if (typeof confirmed !== "boolean") return { ok: false, error: "That didn't work." };
  try {
    const { supabase, roomId, me } = await ctx();
    const patch = confirmed ? { age_confirmed_at: new Date().toISOString() } : { age_confirmed_at: null, spicy_opt_in: false };
    const { error } = await supabase.from("room_members").update(patch).eq("user_id", me);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function setOptIn(optIn: unknown): Promise<ActionResult> {
  if (typeof optIn !== "boolean") return { ok: false, error: "That didn't work." };
  try {
    const { supabase, roomId, me, bundle } = await ctx();
    if (optIn && !bundle.me.member.age_confirmed_at) return { ok: false, error: "Confirm you're 18 or older first." };
    const { error } = await supabase.from("room_members").update({ spicy_opt_in: optIn }).eq("user_id", me);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function setMaxHeat(heat: unknown): Promise<ActionResult> {
  const p = z.number().int().min(1).max(3).safeParse(heat);
  if (!p.success) return { ok: false, error: "That didn't work." };
  try {
    const { supabase, roomId, me } = await ctx();
    const { error } = await supabase.from("room_members").update({ max_heat: p.data }).eq("user_id", me);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function setMatchMode(mode: unknown): Promise<ActionResult> {
  const p = z.enum(["yes", "yes_maybe"]).safeParse(mode);
  if (!p.success) return { ok: false, error: "That didn't work." };
  try {
    const { supabase, roomId, me } = await ctx();
    const { error } = await supabase.from("room_members").update({ match_mode: p.data }).eq("user_id", me);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

const pinSchema = z.string().regex(/^[0-9]{4,8}$/, "Use 4 to 8 digits.");

export async function setPin(pin: unknown): Promise<ActionResult> {
  const p = pinSchema.safeParse(pin);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Use 4 to 8 digits." };
  try {
    const { supabase, roomId } = await ctx();
    const { error } = await supabase.rpc("set_spicy_pin", { p_pin: p.data });
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function verifyPin(pin: unknown): Promise<ActionResult<boolean>> {
  const p = pinSchema.safeParse(pin);
  if (!p.success) return { ok: true, data: false };
  try {
    const { supabase } = await ctx();
    const { data, error } = await supabase.rpc("verify_spicy_pin", { p_pin: p.data });
    if (error) return fail(error);
    return { ok: true, data: data === true };
  } catch (e) {
    return fail(e);
  }
}

const cardSchema = z.object({
  deck: z.enum(["truth", "dare", "hotseat", "never", "dice_action", "dice_where"]),
  heat: z.number().int().min(1).max(3),
  text: z.string().trim().min(2, "A little longer, please.").max(200, "Keep it under 200 characters."),
});

export async function addCustomCard(input: unknown): Promise<ActionResult> {
  const p = cardSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "That didn't look right." };
  try {
    const { supabase, roomId, me } = await ctx();
    const { error } = await supabase.from("custom_cards").insert({ room_id: roomId, created_by: me, ...p.data });
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCustomCard(id: unknown): Promise<ActionResult> {
  const p = z.uuid().safeParse(id);
  if (!p.success) return { ok: false, error: "That card has gone missing." };
  try {
    const { supabase, roomId } = await ctx();
    const { error } = await supabase.from("custom_cards").delete().eq("id", p.data);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

const fantasyIds = new Set(FANTASY.map((f) => f.id));

/** Set (or clear, with null) my answer for one Fantasy Match item. */
export async function setFantasyPick(itemId: unknown, pick: unknown): Promise<ActionResult<string[]>> {
  const p = z.object({ itemId: z.string().refine((x) => fantasyIds.has(x)), pick: z.enum(["yes", "maybe", "no"]).nullable() }).safeParse({ itemId, pick });
  if (!p.success) return { ok: false, error: "That didn't work." };
  try {
    const { supabase, roomId, me } = await ctx();
    const { error } = p.data.pick
      ? await supabase.from("fantasy_picks").upsert({ room_id: roomId, user_id: me, item_id: p.data.itemId, pick: p.data.pick }, { onConflict: "room_id,user_id,item_id" })
      : await supabase.from("fantasy_picks").delete().eq("room_id", roomId).eq("user_id", me).eq("item_id", p.data.itemId);
    if (error) return fail(error);
    const { data: matches } = await supabase.rpc("fantasy_matches", { p_room: roomId });
    return { ok: true, data: ((matches ?? []) as { item_id: string }[]).map((m) => m.item_id) };
  } catch (e) {
    return fail(e);
  }
}