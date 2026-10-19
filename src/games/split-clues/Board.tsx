"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { LIVES, type SplitMove, type SplitView } from "./logic";

export function SplitCluesBoard({ view, me, names, sendMove, pending, sound }: GameProps<SplitView, SplitMove>) {
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const lastAttempt = view.attempts.at(-1);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [view.chat.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    sound("tap");
    void sendMove({ type: "answer", text: answer.trim() }).then(() => setAnswer(""), () => {});
  };
  const say = (e: FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    void sendMove({ type: "say", text: msg.trim() }).then(() => setMsg(""), () => {});
  };

  return (
    <div className="mx-auto grid w-full max-w-[980px] gap-8 @4xl:grid-cols-[1.3fr_1fr]">
      <section aria-labelledby="case-title" className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow" style={{ color: "var(--cat-coop-ink)" }}>
            Case {view.index + 1} of {view.total}
          </p>
          <div className="flex gap-1" role="img" aria-label={`${view.lives} of ${LIVES} lives left`}>
            {Array.from({ length: LIVES }, (_, i) => (
              <Icon key={i} name="heart" size={18} className={i < view.lives ? "text-accent" : "text-line"} fill={i < view.lives ? "currentColor" : "none"} />
            ))}
          </div>
        </div>

        <div>
          <h2 id="case-title" className="display text-[clamp(2.2rem,7vw,3.2rem)]">{view.title}</h2>
          <p className="mt-2 text-[1.05rem] leading-relaxed text-muted">{view.setup}</p>
        </div>

        <div>
          <p className="eyebrow mb-3 text-muted">Only you can see these</p>
          <ul className="grid gap-3 @md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {view.clues.map((c, i) => (
                <motion.li
                  key={`${view.index}-${i}`}
                  initial={{ opacity: 0, y: 14, rotate: 0 }}
                  animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1.2 : -1.4 }}
                  transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 24 }}
                  className="relative rounded-[6px] border border-line bg-[#fbf3dc] p-4 pt-6 text-[0.98rem] leading-relaxed text-ink shadow-[0_8px_18px_-14px_rgba(28,20,22,.6)]"
                >
                  <span aria-hidden className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-accent shadow-[0_1px_0_rgba(0,0,0,.3)]" />
                  {c}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <p className="mt-3 text-[0.85rem] text-muted">{partnerName} has different clues. Neither of you can do this alone.</p>
        </div>

        {view.hint ? (
          <p className="rounded-[12px] border border-dashed border-brass p-3 text-[0.92rem]">
            <b>Hint:</b> {view.hint}
          </p>
        ) : null}

        {view.result ? (
          <Summary view={view} />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="sc-answer" className="text-[0.82rem] font-semibold">
              Your answer · {view.ask}
            </label>
            <div className="flex gap-2">
              <input
                id="sc-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={60}
                autoComplete="off"
                className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-raised px-5 focus:border-line-strong focus:outline-none"
              />
              <Button type="submit" variant="accent" loading={pending}>
                Try it
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[0.88rem] text-muted" aria-live="polite">
                {lastAttempt ? `“${lastAttempt.text}” wasn't it.` : ""}
              </p>
              {!view.hint ? (
                <Button variant="ghost" size="sm" icon="eye" onClick={() => void sendMove({ type: "hint" })}>
                  Hint (−1 star)
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <aside aria-label="Chat" className="flex max-h-[560px] flex-col rounded-[20px] border border-line bg-raised">
        <p className="eyebrow border-b border-line px-4 py-3 text-muted">Compare notes</p>
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
          {view.chat.length === 0 ? <p className="text-[0.9rem] text-muted">Read your clues to each other. Out loud works too.</p> : null}
          {view.chat.map((l, i) => (
            <p key={i} className={cn("max-w-[85%] rounded-[14px] px-3 py-2 text-[0.92rem]", l.by === me ? "ml-auto bg-fg text-bg" : "bg-sunk")}>
              <span className="sr-only">{l.by === me ? "You" : partnerName}: </span>
              {l.text}
            </p>
          ))}
          <div ref={chatEnd} />
        </div>
        <form onSubmit={say} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="sc-chat" className="sr-only">
            Message
          </label>
          <input id="sc-chat" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={200} placeholder="My clue says…" className="h-10 min-w-0 flex-1 rounded-full bg-sunk px-4 text-[0.92rem] focus:outline-none" />
          <Button type="submit" size="sm">
            Send
          </Button>
        </form>
      </aside>
    </div>
  );
}

function Summary({ view }: { view: SplitView }) {
  return (
    <div className="rounded-[20px] border-[1.5px] border-line-strong bg-raised p-5">
      <Status className="text-left">{view.result === "win" ? "Case closed." : "Out of lives."}</Status>
      <ul className="mt-4 space-y-2">
        {view.answers?.map((a, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span>
              Case {i + 1}: <b className="uppercase tracking-wide">{a}</b>
            </span>
            <span aria-label={`${view.stars[i]} stars`} className="flex gap-0.5 text-brass">
              {Array.from({ length: 3 }, (_, k) => (
                <svg key={k} width="16" height="16" viewBox="0 0 24 24" fill={k < view.stars[i]! ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
                </svg>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
