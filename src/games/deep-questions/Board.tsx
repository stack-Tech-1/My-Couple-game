"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import type { DeepMove, DeepView } from "./logic";

export function DeepQuestionsBoard({ view, me, names, sendMove, pending, sound }: GameProps<DeepView, DeepMove>) {
  const who = view.answerer === me ? "You answer this one" : `${names[view.answerer] ?? "Your partner"} answers this one`;
  const next = view.levels[view.level + 1];

  if (view.ended) {
    return (
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-5">
        <Status>{view.asked.length ? `${view.asked.length} questions, answered together.` : "Maybe next time."}</Status>
        <ol className="flex flex-col gap-2">
          {view.asked.map((a, i) => (
            <li key={i} className="rounded-[14px] border border-line px-4 py-3">
              <p className="eyebrow text-muted">{a.level} · {a.answerer === me ? "you" : names[a.answerer]}</p>
              <p className="mt-1">{a.question}</p>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-6">
      <div className="flex gap-2" aria-label="Depth">
        {view.levels.map((l, i) => (
          <div key={l.level} className={cn("flex-1 rounded-full border px-3 py-1.5 text-center text-[0.8rem] font-semibold", i === view.level ? "border-line-strong bg-fg text-bg" : i < view.level ? "border-line text-muted" : "border-line text-muted opacity-60")}>
            {l.level}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.article
          key={view.card ?? "empty"}
          initial={{ opacity: 0, rotateX: -12, y: 16 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.45 }}
          className="relative flex min-h-[18rem] flex-col justify-between rounded-[26px] border-[1.5px] border-line-strong bg-raised p-7"
          style={{ background: view.level === 2 ? "linear-gradient(160deg, var(--bg-raised), color-mix(in srgb, var(--wine) 10%, var(--bg-raised)))" : undefined }}
        >
          <p className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>{view.levels[view.level]!.level} · {view.levels[view.level]!.blurb}</p>
          <p className="display my-6 text-[clamp(1.8rem,6.5vw,2.6rem)] leading-[1.1]">{view.card ?? "You've been through every card at this level."}</p>
          <p className="text-[0.9rem] font-semibold text-muted">{who}</p>
        </motion.article>
      </AnimatePresence>
      <div className="flex flex-wrap gap-3">
        <Button className="flex-1" onClick={() => (sound("flip"), void sendMove({ type: "next" }))} disabled={pending || !view.card} iconRight="arrowRight">
          Next question
        </Button>
        <Button variant="outline" onClick={() => void sendMove({ type: "skip" })} disabled={pending || !view.card || view.remainingAtLevel === 0}>
          Skip
        </Button>
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        {next ? (
          <Button variant="ghost" onClick={() => void sendMove({ type: "deeper" })} disabled={pending}>
            Go deeper: {next.level}
          </Button>
        ) : <span />}
        <Button variant="ghost" onClick={() => void sendMove({ type: "end" })} disabled={pending}>
          We&apos;re done for now
        </Button>
      </div>
    </div>
  );
}