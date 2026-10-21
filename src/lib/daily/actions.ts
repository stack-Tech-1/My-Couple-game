"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { getUser } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { questionFor, utcDay } from "./question";
import { dailyQuestions } from "@/lib/content/server";
import { after } from "next/server";
import { displayName, notifyPartner } from "@/lib/push/server";

const answerSchema = z.string().trim().min(1, "Say something! Anything.").max(500, "Keep it under 500 characters.");

export async function answerDaily(roomId: string, raw: unknown): Promise<ActionResult> {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That didn't work." };
  const user = await getUser();
  if (!user) return { ok: false, error: friendlyError("not signed in") };
  const supabase = await supabaseServer();
  const day = utcDay();
  // If the partner already answered, keep their exact question even if the deck changed since.
  const { data: theirs } = await supabase.from("daily_answers").select("question").eq("room_id", roomId).eq("day", day).limit(1).maybeSingle();
  const question = (theirs?.question as string | undefined) ?? questionFor(roomId, day, await dailyQuestions());
  const { error } = await supabase.from("daily_answers").insert({ room_id: roomId, day, user_id: user.id, question, answer: parsed.data });
  if (error) return { ok: false, error: error.code === "23505" ? "You've already answered today. No take-backs." : friendlyError(error) };
  after(async () => {
    const name = await displayName(user.id);
    // Answers are sealed from the person answering, so check with the service role.
    const { count } = await supabaseAdmin().from("daily_answers").select("user_id", { count: "exact", head: true }).eq("room_id", roomId).eq("day", day);
    await notifyPartner(roomId, user.id, "daily", (count ?? 0) >= 2
      ? { title: "You've both answered", body: `See what ${name} said about today's question.`, url: `/room/${roomId}`, tag: `daily-${roomId}` }
      : { title: `${name} answered today's question`, body: "Your turn. Answers stay sealed until you both reply.", url: `/room/${roomId}`, tag: `daily-${roomId}` });
  });
  revalidatePath(`/room/${roomId}`, "layout");
  return { ok: true, data: null };
}