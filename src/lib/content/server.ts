import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deck, GAME_KINDS, type ContentPack, type Overrides } from "./catalog";

/** Admin additions and hidden built-ins. One read per request; on failure, built-ins only. */
export const getOverrides = cache(async (): Promise<Overrides> => {
  try {
    const admin = supabaseAdmin();
    const [{ data: added }, { data: hidden }] = await Promise.all([
      admin.from("content_items").select("id, kind, body, created_at").order("created_at").limit(5000),
      admin.from("content_hidden").select("kind, key, created_at").limit(10000),
    ]);
    return { added: (added ?? []) as Overrides["added"], hidden: (hidden ?? []) as Overrides["hidden"] };
  } catch {
    return { added: [], hidden: [] };
  }
});

/** Every game deck, for a session that's about to start. */
export async function getContentPack(): Promise<ContentPack> {
  const o = await getOverrides();
  const pack: ContentPack = {};
  for (const k of GAME_KINDS) (pack as Record<string, unknown>)[k] = deck(k, o);
  return pack;
}

/** Start of the current UTC day: Daily Question changes apply from here on. */
const startOfUtcDay = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

export async function dailyQuestions(): Promise<string[]> {
  return deck("daily_question", await getOverrides(), startOfUtcDay()).map((q) => q.text);
}

export async function dateIdeas() {
  return deck("date_idea", await getOverrides());
}
