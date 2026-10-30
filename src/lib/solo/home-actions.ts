"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUser } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";

/** "Just me for now": Solo becomes home until someone joins one of your rooms. */
export async function setSoloHome(on: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { error } = await supabaseAdmin()
    .from("profiles")
    .update({ solo_home: on === true, waiting_prompt_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save that. Try again?" };
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

/** The one-time "Still waiting for your person?" question has been answered. */
export async function answerWaitingPrompt(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  await supabaseAdmin().from("profiles").update({ waiting_prompt_at: new Date().toISOString() }).eq("id", user.id);
  return { ok: true, data: null };
}
