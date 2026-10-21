"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { isKind, KINDS } from "@/lib/content/catalog";
import { sendFeedbackReplyEmail } from "@/lib/email/send";
import { FEEDBACK_STATUSES, REPORT_STATUSES } from "@/lib/feedback/types";
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
const done = (): ActionResult => {
  revalidatePath("/admin", "layout");
  return { ok: true, data: null };
};
const note = z.string().trim().max(2000).transform((v) => v || null);

export async function updateFeedback(id: unknown, patch: unknown): Promise<ActionResult> {
  try {
    await guard();
    const fid = z.uuid().parse(id);
    const p = z.object({ status: z.enum(FEEDBACK_STATUSES).optional(), admin_note: note.optional() }).parse(patch);
    const { error } = await supabaseAdmin().from("feedback").update({ ...p, updated_at: new Date().toISOString() }).eq("id", fid);
    return error ? fail(error) : done();
  } catch (e) {
    return fail(e);
  }
}

/** Reply as the team. The person sees it in Settings (with a dot on the icon), and by email if set up. */
export async function replyAsTeam(id: unknown, body: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const fid = z.uuid().parse(id);
    const text = z.string().trim().min(1, "Write a reply first.").max(2000).parse(body);
    const admin = supabaseAdmin();
    const { data: fb } = await admin.from("feedback").select("user_id, status").eq("id", fid).maybeSingle();
    if (!fb) return { ok: false, error: "That feedback is gone." };
    const { error } = await admin.from("feedback_replies").insert({ feedback_id: fid, from_team: true, author_id: me.id, body: text });
    if (error) return fail(error);
    await admin.from("feedback").update({ status: fb.status === "new" ? "in_progress" : fb.status, updated_at: new Date().toISOString() }).eq("id", fid);
    if (fb.user_id) {
      const [{ data: u }, { data: p }] = await Promise.all([admin.auth.admin.getUserById(fb.user_id as string), admin.from("profiles").select("display_name").eq("id", fb.user_id).maybeSingle()]);
      if (u.user?.email) await sendFeedbackReplyEmail({ id: u.user.id, email: u.user.email, display_name: (p?.display_name as string) || "there" }, text).catch(() => {});
    }
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** Approve a suggestion (optionally edited) straight into the live decks. */
export async function approveSuggestion(id: unknown, editedBody?: unknown): Promise<ActionResult> {
  try {
    const me = await guard();
    const sid = z.uuid().parse(id);
    const admin = supabaseAdmin();
    const { data: s } = await admin.from("suggestions").select("kind, body, status").eq("id", sid).maybeSingle();
    if (!s || s.status !== "pending") return { ok: false, error: "That suggestion was already handled." };
    if (!isKind(s.kind)) return { ok: false, error: "Unknown deck." };
    const parsed = (KINDS[s.kind].schema as z.ZodType<unknown>).safeParse(editedBody ?? s.body);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const { data: item, error } = await admin.from("content_items").insert({ kind: s.kind, body: parsed.data, created_by: me.id }).select("id").single();
    if (error || !item) return fail(error);
    await admin.from("suggestions").update({ status: "approved", content_item_id: item.id, reviewed_at: new Date().toISOString(), body: parsed.data }).eq("id", sid);
    revalidatePath("/admin/content");
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function rejectSuggestion(id: unknown): Promise<ActionResult> {
  try {
    await guard();
    const sid = z.uuid().parse(id);
    const { error } = await supabaseAdmin().from("suggestions").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", sid).eq("status", "pending");
    return error ? fail(error) : done();
  } catch (e) {
    return fail(e);
  }
}

export async function updateReport(id: unknown, patch: unknown): Promise<ActionResult> {
  try {
    await guard();
    const rid = z.uuid().parse(id);
    const p = z.object({ status: z.enum(REPORT_STATUSES).optional(), admin_note: note.optional() }).parse(patch);
    const resolved = p.status === "resolved" || p.status === "dismissed";
    const { error } = await supabaseAdmin().from("reports").update({ ...p, ...(p.status ? { resolved_at: resolved ? new Date().toISOString() : null } : {}) }).eq("id", rid);
    return error ? fail(error) : done();
  } catch (e) {
    return fail(e);
  }
}
