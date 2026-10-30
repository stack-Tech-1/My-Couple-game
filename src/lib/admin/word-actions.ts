"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { wordChecker } from "@/lib/games/dictionary";
import type { ActionResult } from "@/lib/room/types";
import { lagosDay } from "@/lib/solo/catalog";
import { currentAdmin } from "./server";
import { audit } from "./audit";

const input = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  word: z.string().trim().toLowerCase().regex(/^[a-z]{5}$/, "Five letters, a to z."),
  naija: z.boolean(),
  hint: z.string().trim().max(80).optional(),
});

/** Set today's word for a day (today or later). A Naija word needs a hint. */
export async function setDayWord(raw: unknown): Promise<ActionResult> {
  const me = await currentAdmin();
  if (!me) return { ok: false, error: "Admins only." };
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the word." };
  if (p.data.day < lagosDay()) return { ok: false, error: "That day has passed." };
  // Changing today's word mid-day would scramble games already in progress.
  if (p.data.day === lagosDay()) {
    const { count } = await supabaseAdmin().from("solo_word_plays").select("user_id", { count: "exact", head: true }).eq("day", p.data.day);
    if (count) return { ok: false, error: "People have already played today's word. Pick tomorrow or later." };
  }
  if (p.data.naija && !p.data.hint) return { ok: false, error: "Naija words need a hint, so everyone has a fair chance." };
  if (!p.data.naija && !(await wordChecker())(p.data.word)) return { ok: false, error: `${p.data.word.toUpperCase()} isn't in the dictionary. Tick "Naija word" if it's one of ours.` };
  const { error } = await supabaseAdmin()
    .from("solo_word_days")
    .upsert({ day: p.data.day, word: p.data.word, naija: p.data.naija, hint: p.data.hint || null, set_by: me.id });
  if (error) return { ok: false, error: "Couldn't save that." };
  await audit(me, "word.set", p.data.day, { word: p.data.word, naija: p.data.naija });
  revalidatePath("/admin/words");
  return { ok: true, data: null };
}

/** Go back to the built-in word for a day. */
export async function clearDayWord(day: unknown): Promise<ActionResult> {
  const me = await currentAdmin();
  if (!me) return { ok: false, error: "Admins only." };
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(day);
  if (!d.success) return { ok: false, error: "That day didn't look right." };
  if (d.data <= lagosDay()) return { ok: false, error: "Today's word can't change once the day has started." };
  await supabaseAdmin().from("solo_word_days").delete().eq("day", d.data);
  await audit(me, "word.clear", d.data);
  revalidatePath("/admin/words");
  return { ok: true, data: null };
}
