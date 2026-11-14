"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/room/types";

/** Yes or no to being shown as Couple or Gang of the Week. A yes can be taken back any time. */
export async function answerSpotlight(id: unknown, yes: unknown): Promise<ActionResult> {
  const p = z.object({ id: z.uuid(), yes: z.boolean() }).safeParse({ id, yes });
  if (!p.success) return { ok: false, error: "That didn't look right." };
  const { error } = await (await supabaseServer()).rpc("spotlight_answer", { p_spotlight: p.data.id, p_yes: p.data.yes });
  if (error) return { ok: false, error: error.message.includes("decided") ? "This week's winners are already decided." : "Couldn't save that. Try again?" };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** One heart for this week's winners. */
export async function sendSpotlightLove(id: unknown): Promise<ActionResult<{ love: number }>> {
  const p = z.uuid().safeParse(id);
  if (!p.success) return { ok: false, error: "That didn't look right." };
  const { data, error } = await (await supabaseServer()).rpc("spotlight_send_love", { p_spotlight: p.data });
  if (error) return { ok: false, error: "Couldn't send that. Try again?" };
  return { ok: true, data: { love: data as number } };
}
