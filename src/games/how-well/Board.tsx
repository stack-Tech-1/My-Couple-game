"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import type { HowWellMove, HowWellView } from "./logic";

export function HowWellBoard({ view, me, names, sendMove, pending, sound }: GameProps<HowWellView, HowWellMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const index = view.mine.length;
  const [self, setSelf] = useState<number | null>(null);
  // Locked from the moment a pair is sent until the server confirms it (index advances).
  const [sentFor, setSentFor] = useState<number | null>(null);
  const locked = sentFor === index || pending;
  useEffect(() => {
    if (sentFor !== null && sentFor !== index) setSentFor(null);
  }, [index, sentFor]);
  const q = view.questions[index];

  if (view.theirs) return <Reveal view={view} me={me} partnerName={partnerName} />;
  if (!q) return <Status>All answered. Waiting for {partnerName} ({view.partnerProgress}/{view.questions.length})…</Status>;

  const pick = (k: number) => {
    if (locked) return;
    sound("tap");
    if (self === null) return setSelf(k);
    setSentFor(index);
    setSelf(null);
    void sendMove({ index, self, guess: k }).catch(() => setSentFor(null));
  };

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <div className="flex justify-between text-[0.85rem] text-muted">
        <span className="tabular">{index + 1} of {view.questions.length}</span>
        <span>{partnerName}: {view.partnerProgress}/{view.questions.length}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={`${index}-${self === null ? "self" : "guess"}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
          <p className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>{self === null ? "Your answer" : `Now guess ${partnerName}'s`}</p>
          <h2 className="display mt-3 text-[clamp(1.8rem,7vw,2.4rem)] leading-tight">{q.q}</h2>
          <div className="mt-6 grid gap-2.5">
            {q.options.map((o, k) => (
              <button key={k} type="button" disabled={locked} onClick={() => pick(k)} className={cn("min-h-14 rounded-[14px] border-[1.5px] px-4 py-3 text-left font-semibold transition-colors hover:border-line-strong hover:bg-sunk", self === k ? "border-line-strong" : "border-line")}>
                {o}
                {self === k ? <span className="ml-2 text-[0.8rem] font-normal text-muted">(you)</span> : null}
              </button>
            ))}
          </div>
          {self !== null ? (
            <button type="button" onClick={() => setSelf(null)} className="mt-4 text-[0.88rem] text-muted underline underline-offset-2">
              Change my answer
            </button>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Reveal({ view, me, partnerName }: { view: HowWellView; me: string; partnerName: string }) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <Status>
        {view.winner === "tie" ? "Equally clued in." : view.winner === me ? "You know them better." : `${partnerName} knows you better.`}
      </Status>
      <p className="text-center text-muted">
        You guessed {view.scores![me]} right · {partnerName} guessed {view.scores![partner]} right
      </p>
      <ul className="flex flex-col gap-3">
        {view.questions.map((q, i) => {
          const m = view.mine[i]!;
          const t = view.theirs![i]!;
          return (
            <li key={i} className="rounded-[16px] border border-line bg-raised p-4">
              <p className="font-semibold">{q.q}</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-[0.9rem]">
                <div>
                  <p className="text-muted">You</p>
                  <p className="font-semibold">{q.options[m.self]}</p>
                  <p className={cn("mt-1", t.guess === m.self ? "text-sage-ink" : "text-accent-ink")}>{partnerName} guessed {t.guess === m.self ? "right" : q.options[t.guess]}</p>
                </div>
                <div>
                  <p className="text-muted">{partnerName}</p>
                  <p className="font-semibold">{q.options[t.self]}</p>
                  <p className={cn("mt-1", m.guess === t.self ? "text-sage-ink" : "text-accent-ink")}>You guessed {m.guess === t.self ? "right" : q.options[m.guess]}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}