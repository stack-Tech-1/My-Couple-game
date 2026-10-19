"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { getUser } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { questionFor, utcDay } from "./question";

const answerSchema = z.string().trim().min(1, "Say something! Anything.").max(500, "Keep it under 500 characters.");

export async function answerDaily(roomId: string, raw: unknown): Promise<ActionResult> {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That didn't work." };
  const user = await getUser();
  if (!user) return { ok: false, error: friendlyError("not signed in") };
  const supabase = await supabaseServer();
  const day = utcDay();
  const { error } = await supabase.from("daily_answers").insert({ room_id: roomId, day, user_id: user.id, question: questionFor(roomId, day), answer: parsed.data });
  if (error) return { ok: false, error: error.code === "23505" ? "You've already answered today. No take-backs." : friendlyError(error) };
  revalidatePath(`/room/${roomId}`, "layout");
  return { ok: true, data: null };
}