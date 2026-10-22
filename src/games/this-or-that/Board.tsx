"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import type { ToTMove, ToTView } from "./logic";

const SECONDS = 10;

export function ThisOrThatBoard({ view, me, names, sendMove, sound }: GameProps<ToTView, ToTMove>) {
  const reduce = useReducedMotion();
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const index = view.mine.length;
  const pair = view.pairs[index];
  const sent = useRef(-1);

  const pick = (p: 0 | 1 | null) => {
    if (sent.current === index) return;
    sent.current = index;
    if (p !== null) sound("tap");
    void sendMove({ index, pick: p }, { silent: true });
  };

  // Ten seconds a card; out of time counts as a skip.
  useEffect(() => {
    if (!pair || view.done) return;
    const t = setTimeout(() => pick(null), SECONDS * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the card changes
  }, [index, view.done]);

  if (view.done) {
    return (
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-5">
        <Status>
          {view.matches} of {view.pairs.length} in common.
        </Status>
        <p className="text-center text-muted">{view.matches! >= 9 ? "Practically the same person." : view.matches! >= 6 ? "Plenty in common, plenty to argue about." : "Opposites attract. Allegedly."}</p>
        <ul className="flex flex-col gap-2">
          {view.pairs.map(([a, b], i) => {
            const m = view.mine[i];
            const t = view.theirs![i];
            const match = m !== null && m === t;
            return (
              <li key={i} className={cn("grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[14px] border px-4 py-3 text-[0.92rem]", match ? "border-[#5f7a4f] bg-[color-mix(in_srgb,var(--sage)_14%,transparent)]" : "border-line")}>
                <span className={cn(m === 0 && "font-bold", t === 0 && "underline decoration-accent decoration-2 underline-offset-4")}>{a}</span>
                <span className="text-[0.75rem] text-muted">{match ? "both" : "or"}</span>
                <span className={cn("text-right", m === 1 && "font-bold", t === 1 && "underline decoration-accent decoration-2 underline-offset-4")}>{b}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-center text-[0.82rem] text-muted">Bold is you. Underlined is {partnerName}.</p>
      </div>
    );
  }

  if (!pair) return <Status>Done! Waiting for {partnerName} ({view.partnerProgress}/{view.pairs.length})…</Status>;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <div className="flex items-center justify-between text-[0.85rem] text-muted">
        <span className="tabular">{index + 1} / {view.pairs.length}</span>
        <span>{partnerName}: {view.partnerProgress}/{view.pairs.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
        <motion.div key={index} className="h-full bg-accent" initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: reduce ? 0 : SECONDS, ease: "linear" }} />
      </div>
      <AnimatePresence mode="popLayout">
        <motion.div key={index} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-3">
          {pair.map((label, k) => (
            <button
              key={k}
              type="button"
              onClick={() => pick(k as 0 | 1)}
              className={cn(
                "display flex aspect-[3/4] items-center justify-center rounded-[22px] border-[1.5px] p-4 text-center text-[clamp(1.4rem,5.5vw,2.2rem)] leading-tight transition-transform hover:-translate-y-1 active:scale-[0.98]",
                k === 0 ? "border-line-strong bg-raised" : "border-transparent bg-fg text-bg",
              )}
            >
              {label}
            </button>
          ))}
        </motion.div>
      </AnimatePresence>
      <button type="button" onClick={() => pick(null)} className="mx-auto text-[0.88rem] text-muted underline underline-offset-2">
        Skip
      </button>
    </div>
  );
}