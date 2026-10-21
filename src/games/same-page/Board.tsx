"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import type { SamePageMove, SamePageView } from "./logic";

export function SamePageBoard({ view, me, names, sendMove, pending, sound }: GameProps<SamePageView, SamePageMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const index = view.mine.length;
  const [sentFor, setSentFor] = useState<number | null>(null);
  useEffect(() => {
    if (sentFor !== null && sentFor !== index) setSentFor(null);
  }, [index, sentFor]);
  const locked = sentFor === index || pending;

  if (view.theirs) {
    const theirs = view.theirs;
    const pct = Math.round(((view.matches ?? 0) / view.items.length) * 100);
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
        <Status>{pct}% on the same page.</Status>
        <p className="text-center text-muted">
          {view.matches} of {view.items.length} matched. The others are worth a chat, not a fight.
        </p>
        <ul className="flex flex-col gap-3">
          {view.items.map((it, i) => {
            const same = view.mine[i] === theirs[i];
            return (
              <li key={i} className={cn("rounded-[16px] border bg-raised p-4", same ? "border-line" : "border-accent")}>
                <p className="font-semibold">{it.q}</p>
                {same ? (
                  <p className="mt-1 text-[0.9rem] text-sage-ink">Both: {it.options[view.mine[i]!]}</p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-3 text-[0.9rem]">
                    <div>
                      <p className="text-muted">You</p>
                      <p className="font-semibold">{it.options[view.mine[i]!]}</p>
                    </div>
                    <div>
                      <p className="text-muted">{partnerName}</p>
                      <p className="font-semibold">{it.options[theirs[i]!]}</p>
                    </div>
                  </div>
                )}
                {same ? null : <p className="mt-2 text-[0.8rem] text-accent-ink">Worth a conversation</p>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const it = view.items[index];
  if (!it) return <Status>All answered. Waiting for {partnerName} ({view.partnerProgress}/{view.items.length})…</Status>;

  const pick = (k: number) => {
    if (locked) return;
    sound("tap");
    setSentFor(index);
    void sendMove({ index, pick: k }).catch(() => setSentFor(null));
  };
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <div className="flex justify-between text-[0.85rem] text-muted">
        <span className="tabular">{index + 1} of {view.items.length}</span>
        <span>{partnerName}: {view.partnerProgress}/{view.items.length}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
          <p className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>Your honest answer</p>
          <h2 className="display mt-3 text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">{it.q}</h2>
          <div className="mt-6 grid gap-2.5">
            {it.options.map((o, k) => (
              <button key={k} type="button" disabled={locked} onClick={() => pick(k)} className="min-h-14 rounded-[14px] border-[1.5px] border-line px-4 py-3 text-left font-semibold transition-colors hover:border-line-strong hover:bg-sunk disabled:opacity-60">
                {o}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
