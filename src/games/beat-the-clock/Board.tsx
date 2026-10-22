"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Status, TimerBar, useCountdown, useTickAtDeadline } from "@/games/_ui";
import { INKS, ROUND_MS, type ClockMove, type ClockView } from "./logic";

export function BeatTheClockBoard({ view, me, names, sendMove, clock, sound }: GameProps<ClockView, ClockMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const left = useCountdown(view.result ? null : view.deadline, clock, 100);
  const toStart = useCountdown(view.startsAt, clock, 100);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [lastStep, setLastStep] = useState(view.steps[me]);

  useTickAtDeadline(view.result ? null : view.deadline, clock, useCallback(() => void sendMove({ type: "tick" }, { silent: true }), [sendMove]));

  // Brief feedback when my step advances.
  useEffect(() => {
    if (view.steps[me] === lastStep) return;
    setLastStep(view.steps[me]);
    setFlash(view.lastWrong[me] === view.steps[me]! - 1 ? "wrong" : "right");
    const t = setTimeout(() => setFlash(null), 350);
    return () => clearTimeout(t);
  }, [view.steps, view.lastWrong, me, lastStep]);

  const answer = (choice: number) => {
    sound("tap");
    void sendMove({ type: "answer", step: view.steps[me]!, choice }, { silent: true });
  };

  if (view.phase === "lobby") {
    return (
      <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-5 text-center">
        <p className="display text-[clamp(2.4rem,9vw,3.6rem)] leading-none">{view.target} in 60s</p>
        <p className="text-muted">Sums, odd ones out, and colour words printed in the wrong ink. Every right answer counts for both of you.</p>
        <Button data-tour="btc-ready" size="lg" variant="accent" disabled={view.ready[me]} onClick={() => void sendMove({ type: "ready" })}>
          {view.ready[me] ? `Waiting for ${partnerName}…` : "I'm ready"}
        </Button>
        {view.ready[partner] && !view.ready[me] ? <p className="text-[0.9rem] font-semibold">{partnerName} is ready.</p> : null}
      </div>
    );
  }

  const counting = toStart !== null && toStart > 0;
  const c = view.current;

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="display tabular text-[3.2rem] leading-none">
            {view.score}
            <span className="text-[1.4rem] text-muted">/{view.target}</span>
          </p>
          <p className="text-[0.82rem] text-muted">
            You {view.rights[me]} · {partnerName} {view.rights[partner]}
          </p>
        </div>
        <p className="display tabular text-[2.4rem]">{left === null ? "60" : Math.ceil(left / 1000)}s</p>
      </div>
      <TimerBar left={left} total={ROUND_MS} />

      {view.result ? (
        <Status>{view.result === "win" ? "Clock beaten. Together." : `${view.score} of ${view.target}. So close.`}</Status>
      ) : counting ? (
        <div className="flex h-72 items-center justify-center" aria-live="assertive">
          <AnimatePresence mode="popLayout">
            <motion.span key={Math.ceil(toStart / 1000)} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="display text-[7rem]">
              {Math.ceil(toStart / 1000)}
            </motion.span>
          </AnimatePresence>
        </div>
      ) : c ? (
        <motion.div
          key={view.steps[me]}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="rounded-[22px] border-[1.5px] p-5 transition-colors"
          style={{ borderColor: flash === "wrong" ? "var(--accent)" : flash === "right" ? "#5f7a4f" : "var(--line-strong)" }}
        >
          <p className="eyebrow text-muted">{c.kind === "math" ? "Quick maths" : c.kind === "stroop" ? "Tap the ink colour" : "Odd one out"}</p>
          <p className="display mt-3 text-center text-[clamp(2.6rem,10vw,3.6rem)] uppercase" style={c.kind === "stroop" ? { color: INKS[c.ink as keyof typeof INKS] } : undefined}>
            {c.kind === "math" ? c.prompt : c.kind === "stroop" ? c.word : <span className="text-[0.6em] normal-case">Which doesn&apos;t belong?</span>}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {c.options.map((o, i) => (
              <button key={i} type="button" onClick={() => answer(i)} className="flex h-16 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-line bg-raised text-[1.15rem] font-bold capitalize hover:border-line-strong active:scale-[0.98]">
                {c.kind === "stroop" ? <span className="h-4 w-4 rounded-full" style={{ background: INKS[o as keyof typeof INKS] }} aria-hidden /> : null}
                {o}
              </button>
            ))}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
