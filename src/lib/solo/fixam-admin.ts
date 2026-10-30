"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentAdmin } from "@/lib/admin/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/room/types";
import { audit } from "@/lib/admin/audit";

async function guard() {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Admins only.");
  return admin;
}
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : "Something went sideways. Try again?" });

const details = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(60),
    place: z.string().trim().max(80).default(""),
    note: z.string().trim().max(200).default(""),
    link: z
      .string()
      .trim()
      .max(300)
      .refine((v) => !v || v.startsWith("https://"), "Links must start with https://")
      .transform((v) => v || null),
    own_photo: z.boolean(),
    credit_url: z
      .string()
      .trim()
      .max(300)
      .refine((v) => !v || v.startsWith("https://"), "Links must start with https://")
      .optional()
      .transform((v) => v || null),
    credit: z
      .string()
      .trim()
      .max(200)
      .transform((v) => v || null),
    live: z.boolean(),
    feature_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .or(z.literal("").transform(() => null)),
  })
  .refine((d) => d.own_photo || !!d.credit, { message: "Add the photographer and licence, or tick \"Our own photo\".", path: ["credit"] });

/** Add a picture: the square crop made on the admin's device, plus its details. */
export async function addPicture(form: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await guard();
    if (form.get("rights") !== "yes") return { ok: false, error: "Tick \"I took this or have permission to use it\" first." };
    const file = form.get("file");
    if (!(file instanceof Blob) || !file.size) return { ok: false, error: "Choose a photo first." };
    if (file.size > 3 * 1024 * 1024) return { ok: false, error: "That photo is over 3 MB after cropping. Try a smaller one." };
    if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP photo." };
    const d = details.safeParse(JSON.parse(String(form.get("details") ?? "{}")));
    if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Check the details." };
    const admin = supabaseAdmin();
    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
    const path = `${randomUUID()}.${ext}`;
    const { error: up } = await admin.storage.from("fixam").upload(path, file, { contentType: file.type, upsert: false });
    if (up) return { ok: false, error: "Couldn't upload the photo. Try again?" };
    const { data: last } = await admin.from("fixam_pictures").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await admin
      .from("fixam_pictures")
      .insert({ ...d.data, path, sort: ((last?.sort as number | undefined) ?? 0) + 1, created_by: me.id })
      .select("id")
      .single();
    if (error) {
      await admin.storage.from("fixam").remove([path]);
      return { ok: false, error: error.message.includes("feature_on") ? "Another picture is already set for that day." : "Couldn't save the picture." };
    }
    await audit(me, "fixam.add", d.data.name);
    revalidatePath("/admin/fixam");
    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    return fail(e);
  }
}

/** Change a picture's details, switch it on or off, or set its day. */
export async function updatePicture(id: unknown, raw: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const pid = z.uuid().parse(id);
    const d = details.safeParse(raw);
    if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Check the details." };
    await audit(me, "fixam.update", d.data.name, { live: d.data.live });
    const { error } = await supabaseAdmin().from("fixam_pictures").update(d.data).eq("id", pid);
    if (error) return { ok: false, error: error.message.includes("feature_on") ? "Another picture is already set for that day." : "Couldn't save that." };
    revalidatePath("/admin/fixam");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Move a picture up or down the collection order. */
export async function movePicture(id: unknown, dir: unknown): Promise<ActionResult> {
  try {
    await guard();
    const pid = z.uuid().parse(id);
    const up = z.enum(["up", "down"]).parse(dir) === "up";
    const admin = supabaseAdmin();
    const { data: all } = await admin.from("fixam_pictures").select("id, sort").order("sort").order("created_at");
    const list = all ?? [];
    const i = list.findIndex((p) => p.id === pid);
    const j = up ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true, data: null };
    [list[i], list[j]] = [list[j]!, list[i]!];
    await Promise.all(list.map((p, k) => admin.from("fixam_pictures").update({ sort: k + 1 }).eq("id", p.id)));
    revalidatePath("/admin/fixam");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Delete a picture and its photo. People who finished it keep their score, not the picture. */
export async function deletePicture(id: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const pid = z.uuid().parse(id);
    const admin = supabaseAdmin();
    const { data } = await admin.from("fixam_pictures").select("path, name").eq("id", pid).maybeSingle();
    if (!data) return { ok: true, data: null };
    await audit(me, "fixam.delete", data.name as string);
    await admin.from("fixam_pictures").delete().eq("id", pid);
    await admin.storage.from("fixam").remove([data.path as string]);
    revalidatePath("/admin/fixam");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
