"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type TabItem<K extends string> = { key: K; label: ReactNode };

/** WAI-ARIA tabs with roving focus (arrow keys, Home/End) and a sliding underline. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
  label,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
  label: string;
}) {
  const group = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const item = items[next];
    if (!item) return;
    onChange(item.key);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((it, i) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${group}-${it.key}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative shrink-0 px-3.5 pb-3 pt-2 text-[0.92rem] font-semibold transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {it.label}
            {active ? (
              <motion.span
                layoutId={`${group}-ink`}
                className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}