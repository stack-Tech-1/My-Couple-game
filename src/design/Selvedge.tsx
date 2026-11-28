"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The news for the strip, from the app's layout (inside the app only, never the public pages). */
const News = createContext<string[] | null>(null);
export function NewsProvider({ news, children }: { news: string[]; children: ReactNode }) {
  return <News.Provider value={news}>{children}</News.Provider>;
}

/**
 * The selvedge: real wax cloth carries the maker's name printed along its edge. Ours runs under
 * each page's print, and moves like the headlines along the bottom of the TV news. Inside the app
 * it carries the news the admin sets (a message, the weekly winners, the week's best scores);
 * with no news, or on the public pages, it runs the page's own words. A finger resting on it
 * stops it; phones set to reduce motion see it still.
 */
export function Selvedge({ words = [], className }: { words?: string[]; className?: string }) {
  const news = useContext(News);
  const items = news?.length ? news : ["Amah", ...words];
  const line = items.join(" · ");
  // Long enough to fill the widest screen, then the same again so the loop has no seam.
  const copies = Math.max(2, Math.ceil(240 / Math.max(20, line.length)));
  const run = Array.from({ length: copies }, () => line).join(" · ");
  // Steady reading speed, whatever the length.
  const seconds = Math.max(18, Math.round((run.length + 3) * 0.28));
  return (
    <div className={cn("selvedge", className)} role={news?.length ? "marquee" : undefined} aria-label={news?.length ? `News: ${news.join(". ")}` : undefined} aria-hidden={news?.length ? undefined : true}>
      <span className="selvedge-run" style={{ animationDuration: `${seconds}s` }} aria-hidden>
        <span>{run} · </span>
        <span>{run} · </span>
      </span>
    </div>
  );
}
