"use client";

export type ThemePref = "day" | "night" | "auto";
export type ThemeName = "day" | "night" | "afterdark";

const KEY = "twain-theme";

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

export function saveThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // storage unavailable (private mode); theme still applies for this visit
  }
}

export function loadThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "day" || v === "night" || v === "auto") return v;
  } catch {
    // ignore
  }
  return "day";
}