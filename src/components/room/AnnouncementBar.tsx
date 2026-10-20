"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/design/icons";
import { cn } from "@/lib/cn";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "celebrate" | "heads_up";
  link_url: string | null;
  link_label: string | null;
};

const TONE: Record<Announcement["tone"], { icon: IconName; className: string }> = {
  info: { icon: "envelope", className: "border-line-strong bg-raised" },
  celebrate: { icon: "heart", className: "border-[var(--brass-ink)] bg-[color-mix(in_srgb,var(--brass)_14%,var(--bg-raised))]" },
  heads_up: { icon: "bolt", className: "border-accent-ink bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-raised))]" },
};

// Dismissals are a per-device convenience, so localStorage is the right home.
const KEY = "amah:announcements:dismissed";
function readDismissed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** The newest live announcement the reader hasn't dismissed, under the room header. */
export function AnnouncementBar({ items }: { items: Announcement[] }) {
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  useEffect(() => setDismissed(readDismissed()), []);

  // Render nothing until we know what was dismissed, so a closed banner never flashes.
  const current = dismissed ? items.find((a) => !dismissed.includes(a.id)) : undefined;

  function dismiss(id: string) {
    const next = [...(dismissed ?? []), id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked: it'll reappear next visit, which is fine
    }
  }

  return (
    <AnimatePresence initial={false}>
      {current ? (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="mx-auto mt-4 max-w-6xl px-4 sm:px-8"
        >
          <section role="status" aria-label="Announcement" className={cn("flex items-start gap-3 rounded-[16px] border-[1.5px] px-4 py-3.5", TONE[current.tone].className)}>
            <Icon name={TONE[current.tone].icon} size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{current.title}</p>
              <p className="mt-0.5 whitespace-pre-line text-[0.9rem] text-muted">{current.body}</p>
              {current.link_url ? (
                <a href={current.link_url} className="mt-2 inline-flex items-center gap-1 text-[0.88rem] font-semibold text-accent-ink underline-offset-2 hover:underline" {...(current.link_url.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                  {current.link_label ?? "Take a look"} <Icon name="arrowRight" size={14} />
                </a>
              ) : null}
            </div>
            <button type="button" onClick={() => dismiss(current.id)} aria-label="Dismiss announcement" className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-sunk">
              <Icon name="close" size={16} />
            </button>
          </section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
