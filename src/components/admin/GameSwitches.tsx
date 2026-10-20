"use client";

import { useRef, useState } from "react";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { CATEGORIES, CATEGORY_ORDER, gamesIn } from "@/games/catalog";
import { saveGameFlags } from "@/lib/admin/actions";
import type { GameFlags } from "@/lib/games/flags";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full border-[1.5px] transition-colors", checked ? "border-fg bg-fg" : "border-line bg-sunk")}
    >
      <span className={cn("absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-[left]", checked ? "left-[22px] bg-bg" : "left-[3px] bg-muted")} />
    </button>
  );
}

export function GameSwitches({ initial }: { initial: GameFlags }) {
  const [flags, setFlags] = useState(initial);
  const saved = useRef(initial);
  const queue = useRef(Promise.resolve());

  function update(next: GameFlags) {
    setFlags(next);
    // Saves run one after another so a quick double toggle can't land out of order.
    queue.current = queue.current.then(async () => {
      const res = await saveGameFlags(next);
      if (res.ok) {
        saved.current = next;
      } else {
        toast.error(res.error);
        setFlags(saved.current);
      }
    });
  }

  const toggle = (list: "off" | "new", id: string, on: boolean) => {
    const set = new Set(flags[list]);
    if (on) set.add(id);
    else set.delete(id);
    update({ ...flags, [list]: [...set] });
  };

  return (
    <div className="mt-8 space-y-8">
      {CATEGORY_ORDER.map((c) => (
        <section key={c} aria-labelledby={`cat-${c}`}>
          <h2 id={`cat-${c}`} className="eyebrow border-t-[1.5px] border-line-strong pt-4" style={{ color: CATEGORIES[c].ink }}>
            {c === "spicy" ? "After Dark (18+)" : CATEGORIES[c].label}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {gamesIn(c).map((g) => {
              const off = flags.off.includes(g.id);
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
                  <span className={cn("min-w-0 flex-1 font-semibold", off && "text-muted line-through decoration-1")}>{g.name}</span>
                  <span className="flex items-center gap-2 text-[0.82rem] text-muted">
                    Available
                    <Switch checked={!off} onChange={(v) => toggle("off", g.id, !v)} label={`${g.name} available`} />
                  </span>
                  <span className="flex items-center gap-2 text-[0.82rem] text-muted">
                    “New” tag
                    <Switch checked={flags.new.includes(g.id)} onChange={(v) => toggle("new", g.id, v)} label={`${g.name} tagged new`} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
