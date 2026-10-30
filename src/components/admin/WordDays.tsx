"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { clearDayWord, setDayWord } from "@/lib/admin/word-actions";
import type { DayWord } from "@/lib/solo/oro-days";

const label = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** The next two weeks of today's word: see each one, change any future day, or put it back. */
export function WordDays({ days, today, plays }: { days: DayWord[]; today: string; plays: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [word, setWord] = useState("");
  const [naija, setNaija] = useState(false);
  const [hint, setHint] = useState("");
  const [pending, start] = useTransition();

  const open = (d: DayWord) => {
    setEditing(d.day);
    setWord(d.set ? d.word : "");
    setNaija(d.set ? d.naija : new Date(`${d.day}T12:00:00Z`).getUTCDay() === 5);
    setHint(d.set ? (d.hint ?? "") : "");
  };

  return (
    <ul className="mt-6 divide-y divide-line rounded-[18px] border border-line bg-raised">
      {days.map((d) => {
        const isToday = d.day === today;
        return (
          <li key={d.day} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("w-28 text-[0.88rem] font-semibold", isToday && "text-accent-ink")}>{isToday ? `Today, ${label(d.day)}` : label(d.day)}</span>
              <span className="font-mono text-[1.05rem] font-bold uppercase tracking-[0.18em]">{d.word}</span>
              {d.naija ? <span className="rounded-full bg-[#e9b13c] px-2 py-0.5 text-[0.7rem] font-bold text-[#1c1416]">Naija</span> : null}
              {d.set ? <span className="rounded-full bg-fg px-2 py-0.5 text-[0.7rem] font-bold text-bg">Set by hand</span> : null}
              {d.hint ? <span className="text-[0.82rem] text-muted">Hint: {d.hint}</span> : null}
              <span className="ml-auto flex gap-2">
                {isToday ? <span className="text-[0.8rem] text-muted">{plays} played so far</span> : null}
                {!isToday || plays === 0 ? (
                  <Button size="sm" variant="ghost" onClick={() => (editing === d.day ? setEditing(null) : open(d))}>
                    {editing === d.day ? "Close" : "Change"}
                  </Button>
                ) : null}
                {d.set && !isToday ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await clearDayWord(d.day);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Back to the built-in word.");
                        router.refresh();
                      })
                    }
                  >
                    Undo
                  </Button>
                ) : null}
              </span>
            </div>
            {editing === d.day ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-3 rounded-[14px] bg-sunk p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await setDayWord({ day: d.day, word, naija, hint: hint || undefined });
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(`${word.toUpperCase()} is the word for ${label(d.day)}.`);
                    setEditing(null);
                    router.refresh();
                  });
                }}
              >
                <label className="block">
                  <span className="text-[0.8rem] font-semibold">Word (5 letters)</span>
                  <input value={word} onChange={(e) => setWord(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5))} className="mt-1 block h-11 w-32 rounded-[10px] border-[1.5px] border-line bg-raised px-3 font-mono font-bold uppercase tracking-[0.18em]" />
                </label>
                <label className="flex items-center gap-2 pb-2.5 text-[0.88rem] font-semibold">
                  <input type="checkbox" className="h-5 w-5" checked={naija} onChange={(e) => setNaija(e.target.checked)} /> Naija word
                </label>
                <label className="block min-w-[14rem] flex-1">
                  <span className="text-[0.8rem] font-semibold">Hint {naija ? "(needed)" : "(optional)"}</span>
                  <input value={hint} onChange={(e) => setHint(e.target.value.slice(0, 80))} placeholder="The yellow bus of Lagos" className="mt-1 block h-11 w-full rounded-[10px] border-[1.5px] border-line bg-raised px-3" />
                </label>
                <Button type="submit" loading={pending} disabled={word.length !== 5}>
                  Save
                </Button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
