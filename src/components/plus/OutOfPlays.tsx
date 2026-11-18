"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/design/icons";
import { PlusTag } from "./PlusTag";
import { FREE_PLAYS_PER_DAY } from "@/lib/plus/plans";

export type OpenNow = { label: string; hint: string; href: string };

function left(iso: string) {
  const ms = Math.max(0, Date.parse(iso) - Date.now());
  const s = Math.floor(ms / 1000);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: ms === 0 };
}
const two = (n: number) => String(n).padStart(2, "0");

/**
 * Today's free plays are used up. Never a dead end: when it opens again (ticking down to
 * Lagos midnight), Plus for unlimited play, and what's still open right now.
 */
export function OutOfPlays({ gameName, note, resetsAt, plusHref, openNow, onReopen }: { gameName: string; note?: string; resetsAt: string; plusHref: string | null; openNow: OpenNow[]; onReopen?: () => void }) {
  const [t, setT] = useState(() => left(resetsAt));
  useEffect(() => {
    const id = setInterval(() => {
      const next = left(resetsAt);
      setT(next);
      if (next.done) {
        clearInterval(id);
        onReopen?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [resetsAt, onReopen]);

  return (
    <section aria-labelledby="oop-h" className="glass mt-6 overflow-hidden rounded-[26px]">
      <div className="px-5 pb-5 pt-6 text-center">
        <p className="text-[0.85rem] font-bold text-muted">{note ?? `That's today's ${FREE_PLAYS_PER_DAY} free games of ${gameName}`}</p>
        <h2 id="oop-h" className="display mt-2 text-[1.9rem] leading-tight">It opens again at midnight</h2>
        <p className="mt-4 flex items-end justify-center gap-1.5 font-semibold tabular-nums" role="timer" aria-label={`${t.h} hours ${t.m} minutes left`}>
          {[
            [t.h, "hrs"],
            [t.m, "min"],
            [t.s, "sec"],
          ].map(([v, u], i) => (
            <span key={u as string} className="flex items-end gap-1.5">
              {i ? <span className="display pb-4 text-[1.6rem] text-muted" aria-hidden>:</span> : null}
              <span className="flex w-[4.2rem] flex-col items-center rounded-[16px] bg-sunk py-2">
                <span className="display text-[2.2rem] leading-none">{two(v as number)}</span>
                <span className="mt-1 text-[0.7rem] text-muted">{u}</span>
              </span>
            </span>
          ))}
        </p>
      </div>
      {plusHref ? (
        <Link prefetch={false} href={plusHref} className="mx-4 flex items-center gap-3 rounded-[20px] bg-[#2a1f4e] px-4 py-3.5 text-[#f6efe6]">
          <PlusTag />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Play as much as you like</span>
            <span className="block text-[0.82rem] text-[#d9cff5]">Amah Plus has no daily limits. Try it free for 7 days.</span>
          </span>
          <Icon name="arrowRight" size={18} className="text-[#f6d26a]" />
        </Link>
      ) : null}
      {openNow.length ? (
        <div className="px-4 pb-4 pt-5">
          <p className="px-1 text-[0.85rem] font-bold text-muted">Still open today</p>
          <ul className="mt-2 grid gap-2">
            {openNow.map((o) => (
              <li key={o.href}>
                <Link prefetch={false} href={o.href} className="flex items-center gap-3 rounded-[16px] border border-line px-4 py-3 hover:border-line-strong">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{o.label}</span>
                    <span className="block truncate text-[0.82rem] text-muted">{o.hint}</span>
                  </span>
                  <Icon name="arrowRight" size={16} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </section>
  );
}

/** "1 free game left today" near a start button. `left` counts the game about to start. */
export function PlaysLeft({ left: n, className = "mt-3" }: { left: number; className?: string }) {
  return (
    <p className={`${className} text-[0.85rem] font-semibold text-muted`} aria-live="polite">
      {n === 1 ? "Last free game of this today." : `${n} free games of this left today.`} <span className="font-normal">More at midnight.</span>
    </p>
  );
}
