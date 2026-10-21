"use client";

export type ThemePref = "day" | "night" | "auto";
export type ThemeName = "day" | "night" | "afterdark";

const KEY = "amah-theme";
/** Set when someone picks a theme on a page where we can't save it to their account (signed out). */
const PENDING = "amah-theme-pending";

export function resolveTheme(pref: ThemePref): Exclude<ThemeName, "afterdark"> {
  if (pref === "auto") {
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
  }
  return pref;
}

export function applyTheme(name: ThemeName): void {
  const root = document.documentElement;
  if (name === "day") delete root.dataset.theme;
  else root.dataset.theme = name;
}

export function saveThemePref(pref: ThemePref, opts?: { pending?: boolean }): void {
  try {
    localStorage.setItem(KEY, pref);
    if (opts?.pending) localStorage.setItem(PENDING, "1");
  } catch {
    // storage unavailable (private mode); theme still applies for this visit
  }
}

/** A choice made while signed out, waiting to be saved to the account. Cleared once read. */
export function takePendingThemePref(): ThemePref | null {
  try {
    if (localStorage.getItem(PENDING) !== "1") return null;
    localStorage.removeItem(PENDING);
    return loadThemePref();
  } catch {
    return null;
  }
}

export function loadThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "day" || v === "night" || v === "auto") return v;
  } catch {
    // ignore
  }
  // Never chosen: match the phone.
  return "auto";
}