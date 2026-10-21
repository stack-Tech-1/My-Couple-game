"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { applyTheme, loadThemePref, resolveTheme, saveThemePref } from "@/lib/theme/theme";

/**
 * Light/dark switch for the pages outside a room (home, sign-in, legal pages, onboarding). The
 * choice is remembered on this phone and saved to the account at the next sign-in. Inside a room the
 * setting lives in Settings. Self-contained on purpose: the home page stays light.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Unknown until mounted: the server can't see the phone's setting.
  const [night, setNight] = useState<boolean | null>(null);
  useEffect(() => setNight(resolveTheme(loadThemePref()) === "night"), []);

  const flip = () => {
    const next = night ? "day" : "night";
    saveThemePref(next, { pending: true });
    applyTheme(next);
    setNight(!night);
  };

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={night ? "Switch to light mode" : "Switch to dark mode"}
      title={night ? "Light mode" : "Dark mode"}
      className={cn("flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunk", night === null && "opacity-0", className)}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {night ? (
          // Sun: tap for light.
          <path d="M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        ) : (
          // Moon: tap for dark.
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />
        )}
      </svg>
    </button>
  );
}
