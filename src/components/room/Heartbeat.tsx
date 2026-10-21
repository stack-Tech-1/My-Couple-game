"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const EVERY_MS = 45_000;

/**
 * Tells the server "I'm looking at Amah right now", so notifications skip things this person is
 * already seeing. Writes straight to Supabase (no server round trip), only while the tab is
 * visible, and marks them away the moment it's hidden.
 */
export function Heartbeat({ userId }: { userId: string }) {
  useEffect(() => {
    const sb = supabaseBrowser();
    const beat = (here: boolean) =>
      void sb
        .from("user_presence")
        .upsert({ user_id: userId, seen_at: here ? new Date().toISOString() : new Date(0).toISOString() })
        .then(() => {});
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      beat(true);
      clearInterval(timer);
      timer = setInterval(() => beat(true), EVERY_MS);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else {
        clearInterval(timer);
        beat(false);
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", () => beat(false));
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId]);
  return null;
}
