"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Scoreline, Status, TimerBar, useCountdown, useTickAtDeadline } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { MAX_HEARTS, MAX_PER_ROUND, type ComplimentMove, type ComplimentView } from "./logic";

export function ComplimentBattleBoard({ view, me, names, sendMove, pending, clock, sound }: GameProps<ComplimentView, ComplimentMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const [text, setText] = useState("");
  const [hearts, setHearts] = useState<number[]>([]);
  const left = useCountdown(view.phase === "writing" && !view.winner ? view.deadline : null, clock);

  useTickAtDeadline(view.phase === "writing" && !view.winner ? view.deadline : null, clock, useCallback(() => void sendMove({ type: "tick" }, { silent: true }), [sendMove]));
  useEffect(() => setHearts(view.theirs ? view.theirs.map(() => 0) : []), [view.round, view.theirs]);

  const say = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 2) return;
    sound("tap");
    void sendMove({ type: "say", text: text.trim() }).then(() => setText(""), () => {});
  };

  const last = view.history.at(-1);

  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col gap-5">
      <Scoreline
        left={{ name: names[me] ?? "You", score: view.scores[me], sub: "hearts received" }}
        right={{ name: partnerName, score: view.scores[partner], sub: "hearts received" }}
        active={null}
      />
      <p className="text-center text-[0.85rem] text-muted">
        Round {view.round} of {view.rounds}
      </p>

      {view.winner ? (
        <Status>{view.winner === "tie" ? "A dead heat of affection." : view.winner === me ? "You're officially the sweet-talker." : `${partnerName} out-flattered you.`}</Status>
      ) : view.phase === "writing" ? (
        <>
          <TimerBar left={left} total={view.writeMs} />
          <Status>{view.iAmDone ? `Done. ${partnerName} is still gushing…` : `Tell ${partnerName} something true and lovely.`}</Status>
          {!view.iAmDone ? (
            <form onSubmit={say} className="flex gap-2">
              <label htmlFor="compliment" className="sr-only">
                A compliment
              </label>
              <input
                id="compliment"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={140}
                disabled={view.mine.length >= MAX_PER_ROUND}
                autoComplete="off"
                placeholder={view.mine.length >= MAX_PER_ROUND ? "That's five. Show-off." : "You're the only person who…"}
                className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-raised px-5 focus:border-line-strong focus:outline-none disabled:opacity-60"
              />
              <Button type="submit" variant="accent" disabled={pending || view.mine.length >= MAX_PER_ROUND}>
                Add
              </Button>
            </form>
          ) : null}
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {view.mine.map((c, i) => (
                <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[14px] border border-line bg-raised px-4 py-3">
                  {c}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <div className="flex items-center justify-between text-[0.88rem] text-muted">
            <span>
              {partnerName} has written {view.theirCount}
            </span>
            {!view.iAmDone ? (
              <Button variant="ghost" size="sm" onClick={() => void sendMove({ type: "done" })}>
                I&apos;m done
              </Button>
            ) : null}
          </div>
        </>
      ) : view.iJudged ? (
        <Status>Hearts awarded. Waiting for {partnerName}&apos;s verdict…</Status>
      ) : (
        <>
          <Status>Award your hearts.</Status>
          {view.theirs!.length === 0 ? <p className="text-center text-muted">{partnerName} wrote nothing this round. Bold strategy.</p> : null}
          <ul className="flex flex-col gap-3">
            {view.theirs!.map((c, i) => (
              <li key={i} className="rounded-[16px] border-[1.5px] border-line-strong bg-raised p-4">
                <p className="display text-[1.25rem] leading-snug">“{c}”</p>
                <div className="mt-3 flex gap-1" role="radiogroup" aria-label={`Hearts for compliment ${i + 1}`}>
                  {Array.from({ length: MAX_HEARTS }, (_, k) => {
                    const on = (hearts[i] ?? 0) > k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={hearts[i] === k + 1}
                        aria-label={`${k + 1} heart${k ? "s" : ""}`}
                        onClick={() => setHearts((h) => h.map((v, j) => (j === i ? (v === k + 1 ? 0 : k + 1) : v)))}
                        className={cn("rounded-full p-1.5 transition-transform active:scale-90", on ? "text-accent" : "text-line")}
                      >
                        <Icon name="heart" size={26} fill={on ? "currentColor" : "none"} />
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <Button size="lg" variant="accent" loading={pending} onClick={() => (sound("win"), void sendMove({ type: "judge", hearts }))}>
            Hand them over
          </Button>
        </>
      )}

      {last ? (
        <details className="rounded-[14px] border border-line px-4 py-3 text-[0.9rem]">
          <summary className="cursor-pointer font-semibold">Round {last.round}, revealed</summary>
          <ul className="mt-3 space-y-1.5">
            {view.players.flatMap((p) =>
              (last.said[p] ?? []).map((c, i) => (
                <li key={`${p}-${i}`}>
                  <span className="text-muted">{p === me ? "You" : partnerName}:</span> {c} <span className="text-accent-ink">{"♥".repeat(last.hearts[p]?.[i] ?? 0)}</span>
                </li>
              )),
            )}
          </ul>
        </details>
      ) : null}
    </div>
  );
}