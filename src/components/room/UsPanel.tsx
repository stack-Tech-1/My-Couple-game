"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/design/icons";
import { useToasts } from "@/design/toast";
import { cn } from "@/lib/cn";
import { badgesOf, levelOf, xpOf, type Stats } from "@/lib/progress/model";

const SEEN_KEY = (roomId: string) => `amah:badges-seen:${roomId}`;

/** Level, couple streak and badges: the "us" scoreboard, as opposed to the head to head. */
export function UsPanel({ roomId, stats }: { roomId: string; stats: Stats }) {
  const xp = xpOf(stats);
  const lvl = levelOf(xp);
  const badges = useMemo(() => badgesOf(stats), [stats]);
  const earned = badges.filter((b) => b.earned);
  // The three locked badges you're closest to.
  const next = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.value / b.target - a.value / a.target)
    .slice(0, 3);
  const [all, setAll] = useState(false);

  // Celebrate badges earned since this device last looked (per-device convenience: localStorage).
  useEffect(() => {
    let seen: string[] | null = null;
    try {
      const raw = localStorage.getItem(SEEN_KEY(roomId));
      seen = raw ? (JSON.parse(raw) as string[]) : null;
      localStorage.setItem(SEEN_KEY(roomId), JSON.stringify(earned.map((b) => b.id)));
    } catch {
      return;
    }
    // First visit on this device: record silently rather than announcing every old badge.
    if (!seen) return;
    for (const b of earned.filter((x) => !seen!.includes(x.id))) {
      useToasts.getState().push({ tone: "success", icon: "trophy", title: `New badge: ${b.name}`, body: b.description, duration: 7000 });
    }
  }, [roomId, earned]);

  const shown = all ? badges : [...earned, ...next];

  return (
    <section aria-labelledby="us-h" className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="us-h" className="eyebrow text-muted">
            Us
          </h2>
          <p className="display mt-1 text-[1.9rem] leading-none">
            Level {lvl.level} <span className="text-muted">·</span> {lvl.name}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5" title={`Best streak: ${stats.best_streak} days`}>
          <Icon name="flame" size={18} className={stats.streak ? "text-accent-ink" : "text-muted"} />
          <span className="text-[0.92rem] font-semibold">
            {stats.streak} {stats.streak === 1 ? "day" : "days"}
          </span>
          <span className="sr-only">in a row together. Best streak {stats.best_streak} days.</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--series)_18%,var(--bg-raised))]" role="meter" aria-label={`Progress to level ${lvl.level + 1}`} aria-valuemin={lvl.floor} aria-valuemax={lvl.next} aria-valuenow={xp}>
          <div className="h-full rounded-full bg-[var(--series)] transition-[width] duration-700" style={{ width: `${Math.max(3, lvl.progress * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-[0.8rem] text-muted">
          {xp.toLocaleString()} / {lvl.next.toLocaleString()} XP to level {lvl.level + 1}. Play, answer the Daily Question and show up together to level up.
        </p>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Badges">
        {shown.map((b) => (
          <li key={b.id} className={cn("rounded-[14px] border p-3", b.earned ? "border-line-strong bg-bg" : "border-dashed border-line")}>
            <div className="flex items-center gap-2">
              <Icon name={b.earned ? "trophy" : "lock"} size={16} className={b.earned ? "text-[var(--brass-ink)]" : "text-muted"} />
              <p className={cn("text-[0.88rem] font-semibold leading-tight", !b.earned && "text-muted")}>{b.name}</p>
            </div>
            <p className="mt-1 text-[0.75rem] leading-snug text-muted">{b.description}</p>
            {!b.earned ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                  <div className="h-full rounded-full bg-[var(--series)]" style={{ width: `${(b.value / b.target) * 100}%` }} />
                </div>
                <span className="text-[0.7rem] tabular-nums text-muted">
                  {b.value}/{b.target}
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-[0.85rem] font-semibold text-muted underline underline-offset-2 hover:text-fg">
        {all ? "Show less" : `All badges (${earned.length} of ${badges.length})`}
      </button>
    </section>
  );
}
