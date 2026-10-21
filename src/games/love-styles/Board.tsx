"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { LOVE_STYLE_INFO, LOVE_STYLES, type LoveStyle } from "@/content/together-quizzes";
import { topStyles, type LoveStylesMove, type LoveStylesView, type Profile } from "./logic";

export function LoveStylesBoard({ view, me, names, sendMove, pending, sound }: GameProps<LoveStylesView, LoveStylesMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const index = view.mine.length;
  const [sentFor, setSentFor] = useState<number | null>(null);
  useEffect(() => {
    if (sentFor !== null && sentFor !== index) setSentFor(null);
  }, [index, sentFor]);
  const locked = sentFor === index || pending;

  if (view.result) return <Result view={view} me={me} partner={partner} partnerName={partnerName} />;

  const pair = view.pairs[index];
  if (pair) {
    const pick = (side: 0 | 1) => {
      if (locked) return;
      sound("tap");
      setSentFor(index);
      void sendMove({ type: "pick", index, side }).catch(() => setSentFor(null));
    };
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
        <p className="tabular text-[0.85rem] text-muted">{index + 1} of {view.pairs.length}</p>
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
            <p className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>Which would mean more to you?</p>
            <div className="mt-5 grid gap-3">
              {pair.map((text, side) => (
                <button key={side} type="button" disabled={locked} onClick={() => pick(side as 0 | 1)} className="min-h-16 rounded-[14px] border-[1.5px] border-line px-4 py-3 text-left font-semibold transition-colors hover:border-line-strong hover:bg-sunk disabled:opacity-60">
                  {text}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (!view.myGuess) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
        <p className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>Last one</p>
        <h2 className="display text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">How do you think {partnerName} most likes to be loved?</h2>
        <div className="grid gap-2.5">
          {LOVE_STYLES.map((s) => (
            <button key={s} type="button" disabled={pending} onClick={() => (sound("tap"), void sendMove({ type: "guess", style: s }))} className="min-h-14 rounded-[14px] border-[1.5px] border-line px-4 py-3 text-left font-semibold transition-colors hover:border-line-strong hover:bg-sunk">
              {LOVE_STYLE_INFO[s].label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <Status>Done. Waiting for {partnerName} to finish…</Status>;
}

function Result({ view, me, partner, partnerName }: { view: LoveStylesView; me: string; partner: string; partnerName: string }) {
  const r = view.result!;
  const myTop = topStyles(r.profiles[me]!);
  const theirTop = topStyles(r.profiles[partner]!);
  const label = (styles: LoveStyle[]) => styles.map((s) => LOVE_STYLE_INFO[s].label).join(" and ");
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <Status>You: {label(myTop)}. {partnerName}: {label(theirTop)}.</Status>
      <p className="text-center text-muted">
        You guessed {theirTop.includes(r.guesses[me]!) ? "right" : `${LOVE_STYLE_INFO[r.guesses[me]!].label}, not quite`} · {partnerName} guessed{" "}
        {myTop.includes(r.guesses[partner]!) ? "right" : `${LOVE_STYLE_INFO[r.guesses[partner]!].label}, not quite`}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Bars title="You" profile={r.profiles[me]!} />
        <Bars title={partnerName} profile={r.profiles[partner]!} />
      </div>
      <div className="rounded-[16px] border border-line bg-raised p-4">
        <p className="font-semibold">To love {partnerName} well</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-[0.92rem] text-muted">
          {theirTop.map((s) => (
            <li key={s}>{LOVE_STYLE_INFO[s].tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Bars({ title, profile }: { title: string; profile: Profile }) {
  const top = topStyles(profile);
  return (
    <div className="rounded-[16px] border border-line bg-raised p-4">
      <p className="font-semibold">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {LOVE_STYLES.map((s) => (
          <li key={s} className="text-[0.85rem]">
            <div className="flex justify-between">
              <span className={cn(top.includes(s) && "font-semibold")}>{LOVE_STYLE_INFO[s].label}</span>
              <span className="tabular text-muted">{profile[s]}/4</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk">
              <div className="h-full rounded-full" style={{ width: `${(profile[s] / 4) * 100}%`, background: top.includes(s) ? "var(--accent)" : "var(--fg)" }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
