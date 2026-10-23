"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { daysIn, formatBirthday, MONTHS } from "@/lib/birthdays";
import { setBirthday } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";

const select = "h-11 rounded-[12px] border-[1.5px] border-line bg-raised px-3 font-semibold focus:border-line-strong focus:outline-none";

/** Your birthday: day and month only. Your people get a heads-up and the room celebrates. */
export function BirthdayEditor() {
  const { bundle } = useRoom();
  const router = useRouter();
  const p = bundle.me.profile;
  const [month, setMonth] = useState<number | "">(p.birth_month ?? "");
  const [day, setDay] = useState<number | "">(p.birth_day ?? "");
  const [pending, start] = useTransition();
  const saved = p.birth_month && p.birth_day ? formatBirthday(p.birth_month, p.birth_day) : null;
  const changed = month !== (p.birth_month ?? "") || day !== (p.birth_day ?? "");
  const maxDay = month ? daysIn(month) : 31;

  const save = (value: { month: number; day: number } | null) =>
    start(async () => {
      const res = await setBirthday(value);
      if (!res.ok) return void toast.error(res.error);
      toast.success(value ? "Birthday saved. Your people will be reminded." : "Birthday removed.");
      router.refresh();
    });

  return (
    <div className="mt-8">
      <p className="text-[0.82rem] font-semibold" id="birthday-label">Your birthday</p>
      <p className="mt-1 text-[0.85rem] text-muted">Just the day and month, never the year. Everyone in your rooms gets a heads-up, and the room celebrates on the day.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-labelledby="birthday-label">
        <select aria-label="Birthday day" value={day} onChange={(e) => setDay(e.target.value ? Number(e.target.value) : "")} className={select}>
          <option value="">Day</option>
          {Array.from({ length: maxDay }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          aria-label="Birthday month"
          value={month}
          onChange={(e) => {
            const m = e.target.value ? Number(e.target.value) : "";
            setMonth(m);
            if (m && day && day > daysIn(m)) setDay("");
          }}
          className={select}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <Button size="sm" variant={changed ? "accent" : "ghost"} disabled={!changed || !month || !day} loading={pending} onClick={() => month && day && save({ month, day })}>
          Save
        </Button>
        {saved && !changed ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => (setMonth(""), setDay(""), save(null))}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
