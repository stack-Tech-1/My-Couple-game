"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { isKind, KINDS } from "@/lib/content/catalog";
import type { ActionResult } from "@/lib/room/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { currentAdmin } from "./server";

async function guard() {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Admins only.");
  return admin;
}
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error && e.message === "Admins only." ? e.message : friendlyError(e) });

export async function addContent(kind: unknown, body: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    if (!isKind(kind)) return { ok: false, error: "Unknown deck." };
    const parsed = (KINDS[kind].schema as z.ZodType<unknown>).safeParse(body);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const { error } = await supabaseAdmin().from("content_items").insert({ kind, body: parsed.data, created_by: me.id });
    if (error) return fail(error);
    revalidatePath("/admin/content");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Hide or show an item: a built-in by its content key, or an addition by its id. */
export async function setContentHidden(kind: unknown, key: unknown, hidden: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    if (!isKind(kind)) return { ok: false, error: "Unknown deck." };
    const k = z.string().min(1).max(80).parse(key);
    const admin = supabaseAdmin();
    const { error } = hidden === true
      ? await admin.from("content_hidden").upsert({ kind, key: k, created_by: me.id }, { onConflict: "kind,key", ignoreDuplicates: true })
      : await admin.from("content_hidden").delete().eq("kind", kind).eq("key", k);
    if (error) return fail(error);
    revalidatePath("/admin/content");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ---- starter stickers ----------------------------------------------------------------------------

/** Register a file the admin just uploaded to stickers/starter/ as part of the starter pack. */
export async function addStarterSticker(path: unknown, animated: unknown): Promise<ActionResult<{ duplicate: boolean }>> {
  try {
    await guard();
    const p = z.string().regex(/^starter\/[a-z0-9]{8,64}\.(webp|png|gif)$/).parse(path);
    const admin = supabaseAdmin();
    const { data: existing } = await admin.from("stickers").select("id").eq("path", p).maybeSingle();
    if (existing) return { ok: true, data: { duplicate: true } };
    const { count } = await admin.from("stickers").select("id", { count: "exact", head: true }).is("room_id", null);
    const { error } = await admin.from("stickers").insert({ room_id: null, path: p, animated: animated === true, sort: count ?? 0 });
    if (error) return fail(error);
    revalidatePath("/admin/stickers");
    return { ok: true, data: { duplicate: false } };
  } catch (e) {
    return fail(e);
  }
}

/** Take a sticker out of the starter pack. Messages that already used it keep showing it. */
export async function removeStarterSticker(id: unknown): Promise<ActionResult> {
  try {
    await guard();
    const sid = z.uuid().parse(id);
    const { error } = await supabaseAdmin().from("stickers").delete().eq("id", sid).is("room_id", null);
    if (error) return fail(error);
    revalidatePath("/admin/stickers");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
