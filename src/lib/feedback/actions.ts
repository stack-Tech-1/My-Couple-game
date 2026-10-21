"use server";

import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { isKind, KINDS } from "@/lib/content/catalog";
import { getMyRoom, getUser } from "@/lib/room/server";
import { afterDarkOpen } from "@/lib/room/afterDark";
import type { ActionResult } from "@/lib/room/types";
import { supabaseServer } from "@/lib/supabase/server";
import { FEEDBACK_KINDS, SUGGEST_KINDS } from "./types";

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyError(e) });
const limited = (e: { message?: string } | null) => !!e?.message?.includes("rate limited");

const feedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  body: z.string().trim().min(3, "Tell us a little more.").max(2000, "Keep it under 2000 characters."),
  screenshotPath: z.string().max(200).optional(),
  // What helps reproduce a problem. Strings only, short, no content.
  meta: z.record(z.string().max(40), z.string().max(300)).optional(),
});

export async function sendFeedback(input: unknown): Promise<ActionResult> {
  const parsed = feedbackInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const { kind, body, screenshotPath, meta } = parsed.data;
  if (screenshotPath && !screenshotPath.startsWith(`${user.id}/`)) return { ok: false, error: "That screenshot didn't upload properly." };
  const { error } = await (await supabaseServer())
    .from("feedback")
    .insert({ user_id: user.id, kind, body, screenshot_path: screenshotPath ?? null, meta: meta ?? {} });
  if (error) return limited(error) ? { ok: false, error: "That's a lot of feedback for one hour. Thank you! Try again a bit later." } : fail(error);
  return { ok: true, data: null };
}

export async function replyToFeedback(feedbackId: unknown, body: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(feedbackId);
  const text = z.string().trim().min(1).max(2000).safeParse(body);
  if (!id.success || !text.success) return { ok: false, error: "Write something first." };
  const user = await getUser();
  if (!user) return fail("not signed in");
  const { error } = await (await supabaseServer()).from("feedback_replies").insert({ feedback_id: id.data, from_team: false, author_id: user.id, body: text.data });
  if (error) return fail(error);
  return { ok: true, data: null };
}

/** Clears the "new reply" dot. */
export async function markFeedbackSeen(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("not signed in");
  await (await supabaseServer()).from("profiles").update({ feedback_seen_at: new Date().toISOString() }).eq("id", user.id);
  return { ok: true, data: null };
}

/** Suggest a card. Validated against the same schema the admin uses to add one. */
export async function suggestCard(kind: unknown, body: unknown): Promise<ActionResult> {
  const allowed = SUGGEST_KINDS.find((k) => k.kind === kind);
  if (!allowed || !isKind(kind)) return { ok: false, error: "Pick what kind of card it is." };
  const parsed = (KINDS[kind].schema as z.ZodType<unknown>).safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const bundle = await getMyRoom();
  if (!bundle) return fail("not signed in");
  if (allowed.spicy && !afterDarkOpen(bundle)) return { ok: false, error: "After Dark suggestions open once After Dark is on for you both." };
  const { error } = await (await supabaseServer()).from("suggestions").insert({ user_id: bundle.me.profile.id, kind, body: parsed.data });
  if (error) return limited(error) ? { ok: false, error: "That's plenty of ideas for one hour. Thank you!" } : fail(error);
  return { ok: true, data: null };
}
