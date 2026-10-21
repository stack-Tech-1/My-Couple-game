"use client";

import { useEffect } from "react";
import { updateMyPrefs } from "@/lib/room/actions";
import { applyTheme, resolveTheme, saveThemePref, takePendingThemePref, type ThemePref } from "@/lib/theme/theme";

/**
 * Keeps this phone's theme in step with the person's account. A choice made while signed out (the
 * button on the home or sign-in page) is saved to the account; otherwise the account's choice wins,
 * so a new phone picks it up right after signing in.
 */
export function ThemeSync({ account }: { account: ThemePref | null }) {
  useEffect(() => {
    if (!account) return;
    const pending = takePendingThemePref();
    const pref = pending ?? account;
    saveThemePref(pref);
    if (pending && pending !== account) void updateMyPrefs({ theme: pending });
    // After Dark sets its own look; leave it alone.
    if (document.documentElement.dataset.theme !== "afterdark") applyTheme(resolveTheme(pref));
  }, [account]);
  return null;
}
