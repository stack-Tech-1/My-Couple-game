"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/design/icons";
import { cn } from "@/lib/cn";

export type PlaceRow = { id: string; name: string; how: string; value: number; target: number; earned: boolean };

/**
 * Everything in Our place: what's earned (newest-to-you marked "New") and what's still to earn.
 * "New" is remembered on this phone only, a small nicety; a new phone just shows nothing as new.
 */
export function PlaceList({ roomId, rows }: { roomId: string; rows: PlaceRow[] }) {
  const [fresh, setFresh] = useState<string[]>([]);
  const have = rows.filter((r) => r.earned).map((r) => r.id);
  const key = have.join(",");
  useEffect(() => {
    const storeKey = `amah:place:${roomId}`;
    try {
      const raw = localStorage.getItem(storeKey);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      setFresh(raw ? key.split(",").filter((id) => id && !seen.includes(id)) : []);
      localStorage.setItem(storeKey, JSON.stringify(key.split(",").filter(Boolean)));
    } catch {
      setFresh([]);
    }
  }, [roomId, key]);

  const earned = rows.filter((r) => r.earned).sort((a, b) => Number(fresh.includes(b.id)) - Number(fresh.includes(a.id)));
  const todo = rows.filter((r) => !r.earned).sort((a, b) => b.value / b.target - a.value / a.target);
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section aria-labelledby="have-h">
        <h2 id="have-h" className="display text-[1.3rem]">In your place</h2>
        {earned.length ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {earned.map((r) => (
              <li key={r.id} className="glass flex items-center gap-3 rounded-[14px] px-3.5 py-2.5">
                <Icon name="check" size={16} className="text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{r.name}</span>
                  {fresh.includes(r.id) ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[0.68rem] font-extrabold text-[#fff8f0]">New</span> : null}
                  <span className="block text-[0.78rem] text-muted">For {r.how}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.9rem] text-muted">Nothing yet. Spend three days together on Amah and the sofa arrives.</p>
        )}
      </section>
      <section aria-labelledby="todo-h">
        <h2 id="todo-h" className="display text-[1.3rem]">Still to earn</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {todo.map((r) => (
            <li key={r.id} className="rounded-[14px] border border-line px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{r.name}</span>
                <span className="shrink-0 text-[0.78rem] font-bold tabular-nums text-muted">
                  {Math.min(r.value, r.target)} of {r.target}
                </span>
              </div>
              <p className="text-[0.78rem] text-muted">For {r.how}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunk" aria-hidden>
                <div className={cn("h-full rounded-full bg-accent")} style={{ width: `${Math.round(Math.min(1, r.value / r.target) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
