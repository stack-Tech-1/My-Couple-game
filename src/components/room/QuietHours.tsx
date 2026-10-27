"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/design/Field";
import { toast } from "@/design/toast";
import { setQuietHours } from "@/lib/push/actions";
import { DEFAULT_QUIET, hourLabel } from "@/lib/push/quiet";

export type Quiet = { start: number | null; end: number | null };

const select = "h-10 rounded-[12px] border-[1.5px] border-line bg-raised px-3 font-semibold focus:border-line-strong focus:outline-none";
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Quiet hours: no notifications overnight (or whenever), in this phone's time zone. */
export function QuietHours({ initial }: { initial: Quiet }) {
  const [on, setOn] = useState(initial.start !== null);
  const [start, setStart] = useState(initial.start ?? DEFAULT_QUIET.start);
  const [end, setEnd] = useState(initial.end ?? DEFAULT_QUIET.end);
  const [, startSave] = useTransition();

  const save = (next: { on: boolean; start: number; end: number }) =>
    startSave(async () => {
      const res = await setQuietHours(next.on ? { start: next.start, end: next.end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(next.on ? `Quiet from ${hourLabel(next.start)} to ${hourLabel(next.end)}.` : "Quiet hours off.");
    });

  return (
    <div className="border-t border-line">
      <Toggle
        checked={on}
        onChange={(v) => {
          setOn(v);
          save({ on: v, start, end });
        }}
        label="Quiet hours"
        description="No notifications at night (or whenever you choose). Everything still waits for you in Amah."
      />
      {on ? (
        <div className="flex flex-wrap items-center gap-2 pb-4" role="group" aria-label="Quiet hours times">
          <span className="text-[0.9rem] text-muted">From</span>
          <select
            aria-label="Quiet from"
            value={start}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStart(v);
              save({ on, start: v, end });
            }}
            className={select}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <span className="text-[0.9rem] text-muted">to</span>
          <select
            aria-label="Quiet until"
            value={end}
            onChange={(e) => {
              const v = Number(e.target.value);
              setEnd(v);
              save({ on, start, end: v });
            }}
            className={select}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
