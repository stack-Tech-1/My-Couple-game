"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { getMyRoom } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { after } from "next/server";
import { notifyPartner } from "@/lib/push/server";

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyError(e) });
const issue = (e: z.ZodError) => e.issues[0]?.message ?? "That didn't look right.";

async function ctx() {
  const bundle = await getMyRoom();
  if (!bundle) throw new Error("not signed in");
  return { bundle, supabase: await supabaseServer(), roomId: bundle.room.id, me: bundle.me.profile.id };
}

// ---- Love notes ----
const noteSchema = z.object({
  body: z.string().trim().min(1, "A blank page is romantic, but say something.").max(4000, "That's a novel. Keep it under 4,000 characters."),
  stationery: z.enum(["paper", "wine", "sage", "brass"]),
  unlockAt: z.iso.datetime({ offset: true }).nullable(),
});

export async function sendNote(input: unknown): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const unlock = parsed.data.unlockAt ? new Date(parsed.data.unlockAt) : null;
  if (unlock && unlock.getTime() < Date.now() + 60_000) return { ok: false, error: "Pick a moment in the future to seal it until." };
  if (unlock && unlock.getTime() > Date.now() + 5 * 365 * 86_400_000) return { ok: false, error: "Five years is the longest we'll keep a secret." };
  try {
    const { supabase, roomId, me, bundle } = await ctx();
    if (!bundle.partner) return { ok: false, error: "Love notes need someone to send them to." };
    const { error } = await supabase.from("love_notes").insert({
      room_id: roomId,
      author_id: me,
      recipient_id: bundle.partner.profile.id,
      body: parsed.data.body,
      stationery: parsed.data.stationery,
      unlock_at: unlock?.toISOString() ?? null,
    });
    if (error) return fail(error);
    const name = bundle.me.profile.display_name || "Your partner";
    after(() =>
      notifyPartner(roomId, me, "notes", unlock
        ? { title: `${name} sealed a letter for you`, body: "It opens on a special day. No peeking.", url: `/room/${roomId}/games/love-notes`, tag: `note-${roomId}` }
        : { title: `A letter from ${name}`, body: "Open it in Amah.", url: `/room/${roomId}/games/love-notes`, tag: `note-${roomId}` }),
    );
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function openNote(id: unknown): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That note has gone missing." };
  try {
    const { supabase, roomId } = await ctx();
    const { error } = await supabase.rpc("open_note", { p_id: parsed.data });
    if (error) return fail(error);
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNote(id: unknown): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That note has gone missing." };
  try {
    const { supabase, roomId } = await ctx();
    const { error } = await supabase.from("love_notes").delete().eq("id", parsed.data);
    if (error) return fail(error);
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ---- Memory Lane ----
const memorySchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|webp|png)$/),
  prompt: z.string().trim().min(1, "Give your partner something to answer.").max(200),
  takenOn: z.iso.date().nullable(),
});

export async function addMemory(input: unknown): Promise<ActionResult> {
  const parsed = memorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  try {
    const { supabase, roomId, me } = await ctx();
    if (!parsed.data.path.startsWith(`${roomId}/`)) return { ok: false, error: "That photo doesn't belong here." };
    const { error } = await supabase.from("memories").insert({ room_id: roomId, author_id: me, path: parsed.data.path, prompt: parsed.data.prompt, taken_on: parsed.data.takenOn });
    if (error) {
      await supabase.storage.from("memories").remove([parsed.data.path]);
      return fail(error);
    }
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function answerMemory(id: unknown, answer: unknown): Promise<ActionResult> {
  const p = z.object({ id: z.uuid(), answer: z.string().trim().min(1, "Say something!").max(1000) }).safeParse({ id, answer });
  if (!p.success) return { ok: false, error: issue(p.error) };
  try {
    const { supabase, roomId } = await ctx();
    const { error } = await supabase.rpc("answer_memory", { p_id: p.data.id, p_answer: p.data.answer });
    if (error) return fail(error);
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMemory(id: unknown): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That memory has gone missing." };
  try {
    const { supabase, roomId, me } = await ctx();
    const { data } = await supabase.from("memories").select("path, author_id").eq("id", parsed.data).single();
    if (!data || data.author_id !== me) return { ok: false, error: "Only whoever added a memory can remove it." };
    const { error } = await supabase.from("memories").delete().eq("id", parsed.data);
    if (error) return fail(error);
    await supabase.storage.from("memories").remove([data.path as string]);
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ---- Bucket list ----
const itemSchema = z.object({
  title: z.string().trim().min(1, "What's the dream?").max(120),
  note: z.string().trim().max(500).optional(),
  category: z.enum(["adventure", "travel", "home", "food", "learn", "someday"]),
});

export async function addBucketItem(input: unknown): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  try {
    const { supabase, roomId, me } = await ctx();
    const { error } = await supabase.from("bucket_items").insert({ room_id: roomId, created_by: me, title: parsed.data.title, note: parsed.data.note || null, category: parsed.data.category });
    if (error) return fail(error);
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function setBucketDone(id: unknown, done: unknown): Promise<ActionResult> {
  const p = z.object({ id: z.uuid(), done: z.boolean() }).safeParse({ id, done });
  if (!p.success) return { ok: false, error: "That didn't work." };
  try {
    const { supabase, roomId, me } = await ctx();
    const { error } = await supabase
      .from("bucket_items")
      .update(p.data.done ? { done_at: new Date().toISOString(), done_by: me } : { done_at: null, done_by: null })
      .eq("id", p.data.id);
    if (error) return fail(error);
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBucketItem(id: unknown): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That item has gone missing." };
  try {
    const { supabase, roomId } = await ctx();
    const { error } = await supabase.from("bucket_items").delete().eq("id", parsed.data);
    if (error) return fail(error);
    revalidatePath(`/room/${roomId}`, "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}