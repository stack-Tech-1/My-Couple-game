"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GAMES } from "@/games/catalog";
import { friendlyError } from "@/lib/errors";
import { gameFlagsSchema } from "@/lib/games/flags";
import { purgeRoomMedia } from "@/lib/media/purge";
import type { ActionResult } from "@/lib/room/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { currentAdmin } from "./server";

// Every action re-checks admin rights itself: a server action is a public endpoint.
async function guard() {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Admins only.");
  return admin;
}
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error && e.message === "Admins only." ? e.message : friendlyError(e) });

// ---- users ---------------------------------------------------------------------------------------

export type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  display_name: string | null;
  room_id: string | null;
  paired: boolean | null;
  is_admin: boolean;
};

export async function findUser(email: unknown): Promise<ActionResult<AdminUser | null>> {
  try {
    await guard();
    const parsed = z.email().safeParse(typeof email === "string" ? email.trim() : email);
    if (!parsed.success) return { ok: false, error: "That doesn't look like an email address." };
    const { data, error } = await supabaseAdmin().rpc("admin_find_user", { p_email: parsed.data });
    if (error) return fail(error);
    return { ok: true, data: ((data as AdminUser[] | null) ?? [])[0] ?? null };
  } catch (e) {
    return fail(e);
  }
}

export async function setSuspended(userId: unknown, suspended: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const id = z.uuid().parse(userId);
    if (id === me.id) return { ok: false, error: "You can't suspend yourself." };
    // A ban stops sign-ins and token refreshes; an open session lapses within the hour.
    const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { ban_duration: suspended === true ? "876000h" : "none" });
    if (error) return fail(error);
    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Same outcome as the person deleting their own account: their partner keeps the room. */
export async function deleteUserAccount(userId: unknown, typedEmail: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const id = z.uuid().parse(userId);
    if (id === me.id) return { ok: false, error: "Delete your own account from your room's settings." };
    const admin = supabaseAdmin();
    const { data: u } = await admin.auth.admin.getUserById(id);
    if (!u.user) return { ok: false, error: "That account no longer exists." };
    if (typeof typedEmail !== "string" || typedEmail.trim().toLowerCase() !== (u.user.email ?? "").toLowerCase()) {
      return { ok: false, error: "Type the account's email exactly to confirm." };
    }
    const { data: photos } = await admin.from("memories").select("path").eq("author_id", id);
    if (photos?.length) await admin.storage.from("memories").remove(photos.map((p) => p.path as string));
    const { data: roomId, error: leaveErr } = await admin.rpc("admin_remove_from_room", { p_user: id });
    if (leaveErr) return fail(leaveErr);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return fail(error);
    if (typeof roomId === "string") await purgeRoomMedia(roomId);
    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ---- games -----------------------------------------------------------------------------------------

export async function saveGameFlags(input: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const parsed = gameFlagsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Those switches didn't add up." };
    const known = new Set(GAMES.map((g) => g.id));
    const clean = { off: [...new Set(parsed.data.off.filter((id) => known.has(id)))], new: [...new Set(parsed.data.new.filter((id) => known.has(id)))] };
    const { error } = await supabaseAdmin().from("app_config").upsert({ key: "games", value: clean, updated_at: new Date().toISOString(), updated_by: me.id });
    if (error) return fail(error);
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ---- announcements ---------------------------------------------------------------------------------

const announcementInput = z
  .object({
    title: z.string().trim().min(1, "Give it a title.").max(80, "Keep the title under 80 characters."),
    body: z.string().trim().min(1, "Say something in the message.").max(600, "Keep it under 600 characters."),
    tone: z.enum(["info", "celebrate", "heads_up"]),
    link_url: z
      .string()
      .trim()
      .max(500)
      .refine((v) => !v || /^(https:\/\/|\/)/.test(v), "Links must start with https:// or /")
      .transform((v) => v || null),
    link_label: z
      .string()
      .trim()
      .max(30, "Keep the link text short.")
      .transform((v) => v || null),
    days: z.number().int().min(1).max(60).nullable(),
  })
  .refine((v) => !v.link_label || v.link_url, { message: "Add the link itself, or clear the link text.", path: ["link_url"] });

export async function createAnnouncement(input: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const parsed = announcementInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    const { days, ...rest } = parsed.data;
    const now = Date.now();
    const { error } = await supabaseAdmin()
      .from("announcements")
      .insert({ ...rest, starts_at: new Date(now).toISOString(), ends_at: days ? new Date(now + days * 86_400_000).toISOString() : null, created_by: me.id });
    if (error) return fail(error);
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function endAnnouncement(id: unknown): Promise<ActionResult> {
  try {
    await guard();
    const aid = z.uuid().parse(id);
    const admin = supabaseAdmin();
    const { data: a } = await admin.from("announcements").select("starts_at").eq("id", aid).maybeSingle();
    if (!a) return { ok: false, error: "That announcement is gone already." };
    // Ending one that hasn't started yet just removes it.
    const { error } =
      Date.parse(a.starts_at as string) >= Date.now()
        ? await admin.from("announcements").delete().eq("id", aid)
        : await admin.from("announcements").update({ ends_at: new Date().toISOString() }).eq("id", aid);
    if (error) return fail(error);
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
