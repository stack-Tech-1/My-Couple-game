import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { NO_FLAGS, parseGameFlags, type GameFlags } from "./flags";

/** Current game switches. One read per request; failure means "everything on". */
export const getGameFlags = cache(async (): Promise<GameFlags> => {
  try {
    const { data } = await supabaseAdmin().from("app_config").select("value").eq("key", "games").maybeSingle();
    return parseGameFlags(data?.value);
  } catch {
    return NO_FLAGS;
  }
});
