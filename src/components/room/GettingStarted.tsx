"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/design/icons";
import { cn } from "@/lib/cn";

/** `href` "#chat" opens the chat panel instead of navigating. */
export type StartItem = { label: string; done: boolean; href: string };

/**
 * A short "getting started" list on the room home. Ticks itself off as things happen and disappears
 * when everything's done. "Hide" tucks it away on this phone.
 */
export function GettingStarted({ roomId, items }: { roomId: string; items: StartItem[] }) {
  const key = `amah-start-hidden:${roomId}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  const left = items.filter((i) => !i.done).length;
  if (hidden || left === 0) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // storage unavailable: hidden for this visit only
    }
  };

  return (
    <section aria-labelledby="start-h" className="mt-8 rounded-[20px] border-[1.5px] border-line bg-raised p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="start-h" className="font-semibold">Getting started</h2>
        <span className="tabular text-[0.85rem] text-muted">
          {items.length - left} of {items.length} done
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              onClick={(e) => {
                if (it.href !== "#chat") return;
                e.preventDefault();
                window.dispatchEvent(new Event("amah:open-chat"));
              }}
              className={cn("flex items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-sunk", it.done && "pointer-events-none")}
              aria-disabled={it.done || undefined}
            >
              <span
                className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px]", it.done ? "border-sage-ink bg-sage-ink text-bg" : "border-line-strong")}
                aria-hidden
              >
                {it.done ? <Icon name="check" size={14} strokeWidth={2.5} /> : null}
              </span>
              <span className={cn("flex-1", it.done && "text-muted line-through")}>{it.label}</span>
              {it.done ? <span className="sr-only">done</span> : <Icon name="arrowRight" size={16} className="text-muted" />}
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={hide} className="mt-2 text-[0.85rem] text-muted underline underline-offset-2 hover:text-fg">
        Hide this
      </button>
    </section>
  );
}
