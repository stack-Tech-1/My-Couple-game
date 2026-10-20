import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyUnsubscribe } from "./unsubscribe";

/** Turn announcement emails off (or back on) for the user a signed link points at. */
export async function applyOptOut(u: unknown, t: unknown, emails: boolean): Promise<boolean> {
  const id = z.uuid().safeParse(u);
  if (!id.success || typeof t !== "string" || !verifyUnsubscribe(id.data, t)) return false;
  const { error } = await supabaseAdmin().from("profiles").update({ announcement_emails: emails }).eq("id", id.data);
  return !error;
}
