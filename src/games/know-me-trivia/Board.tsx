"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Scoreline, Status } from "@/games/_ui";
import { KNOW_ME_BANK } from "@/content/know-me-bank";
import { cn } from "@/lib/cn";
import { questionSchema, type Question, type TriviaMove, type TriviaView } from "./logic";

const blank = (): Question => ({ prompt: "", answer: "", decoys: ["", "", ""] });

export function KnowMeTriviaBoard(props: GameProps<TriviaView, TriviaMove>) {
  const { view, me, names } = props;
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-6">
      {view.phase === "answer" ? (
        <Scoreline
          left={{ name: names[me] ?? "You", score: view.scores[me], sub: view.streaks[me]! > 1 ? `${view.streaks[me]} in a row` : `${view.toAnswer.filter((c) => c.mine).length}/${view.count} answered` }}
          right={{ name: partnerName, score: view.scores[partner], sub: `${view.partnerOnMine.length}/${view.count} answered` }}
          active={null}
        />
      ) : null}
      {view.phase === "write" ? (
        view.myQuestions ? (
          <Waiting partnerName={partnerName} done={view.submitted[partner]!} />
        ) : (
          <Writer {...props} />
        )
      ) : (
        <Answerer {...props} partnerName={partnerName} />
      )}
    </div>
  );
}

function Waiting({ partnerName, done }: { partnerName: string; done: boolean }) {
  return (
    <div className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-8 text-center">
      <Status>{done ? "Both in. Shuffling…" : "Locked in."}</Status>
      <p className="mt-2 text-muted">{done ? "" : `${partnerName} is still writing. Probably agonising over the fake answers.`}</p>
    </div>
  );
}

function Writer({ view, sendMove, pending, sound }: GameProps<TriviaView, TriviaMove>) {
  const [qs, setQs] = useState<Question[]>(() => Array.from({ length: view.count }, blank));
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const q = qs[i]!;
  const set = (patch: Partial<Question>) => setQs((all) => all.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const valid = (x: Question) => questionSchema.safeParse(x).success;
  const allValid = qs.every(valid);

  const fromBank = () => {
    const used = new Set(qs.map((x) => x.prompt));
    const pool = KNOW_ME_BANK.filter((p) => !used.has(p));
    set({ prompt: pool[Math.floor(Math.random() * pool.length)] ?? KNOW_ME_BANK[0]! });
    sound("roll");
  };

  const next = () => {
    const r = questionSchema.safeParse(q);
    if (!r.success) return setError(r.error.issues[0]?.message === "Answers must all be different." ? "Your four answers need to be different." : "Fill in the question, the real answer and three fakes.");
    setError(null);
    setI((n) => Math.min(view.count - 1, n + 1));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow text-accent-ink">Question {i + 1} of {view.count}</p>
        <h2 className="display mt-2 text-[2rem]">About you.</h2>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {qs.map((x, k) => (
            <button key={k} type="button" tabIndex={-1} onClick={() => setI(k)} className={cn("h-1.5 flex-1 rounded-full", k === i ? "bg-fg" : valid(x) ? "bg-accent" : "bg-sunk")} />
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField label="The question" placeholder="What's my comfort meal after a bad day?" value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} maxLength={120} />
        </div>
        <Button variant="outline" icon="dice" onClick={fromBank} aria-label="Pick a question from the bank">
          Bank
        </Button>
      </div>
      <TextField label="The real answer" value={q.answer} onChange={(e) => set({ answer: e.target.value })} maxLength={60} />
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1.5 text-[0.82rem] font-semibold">Three convincing fakes</legend>
        {q.decoys.map((d, k) => (
          <input
            key={k}
            aria-label={`Fake answer ${k + 1}`}
            value={d}
            maxLength={60}
            onChange={(e) => set({ decoys: q.decoys.map((x, j) => (j === k ? e.target.value : x)) })}
            className="h-12 w-full rounded-[var(--radius)] border-[1.5px] border-line bg-raised px-4 focus:border-line-strong focus:outline-none"
          />
        ))}
      </fieldset>
      {error ? <p role="alert" className="font-medium text-accent-ink">{error}</p> : null}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} icon="arrowLeft">
          Back
        </Button>
        {i < view.count - 1 ? (
          <Button className="flex-1" onClick={next} iconRight="arrowRight">
            Next question
          </Button>
        ) : (
          <Button className="flex-1" variant="accent" loading={pending} disabled={!allValid} onClick={() => void sendMove({ type: "submit", questions: qs.map((x) => ({ ...x, prompt: x.prompt.trim() })) })}>
            Lock them in
          </Button>
        )}
      </div>
    </div>
  );
}

function Answerer({ view, sendMove, pending, sound, partnerName, me }: GameProps<TriviaView, TriviaMove> & { partnerName: string }) {
  const answeredCount = view.toAnswer.filter((c) => c.mine).length;
  const [reveal, setReveal] = useState<number | null>(null);
  const current = reveal ?? answeredCount;
  const card = view.toAnswer[current];
  const finishedMine = answeredCount >= view.count;

  // Hold the reveal for a beat after each answer, then move on.
  useEffect(() => {
    if (reveal === null) return;
    const t = setTimeout(() => setReveal(null), 1400);
    return () => clearTimeout(t);
  }, [reveal]);

  const rightOnMine = useMemo(() => view.partnerOnMine.filter((a) => a.correct).length, [view.partnerOnMine]);

  if (finishedMine && reveal === null) {
    return (
      <div className="flex flex-col gap-5">
        <Status>
          {view.winner
            ? view.winner === "tie"
              ? "Dead even. You know each other equally well. Or equally badly."
              : view.winner === me
                ? "You know them better."
                : `${partnerName} knows you better.`
            : `All answered. ${partnerName} is still going…`}
        </Status>
        <ul className="flex flex-col gap-3">
          {view.myQuestions?.map((q, i) => {
            const a = view.partnerOnMine[i];
            return (
              <li key={i} className="rounded-[16px] border border-line bg-raised p-4">
                <p className="font-semibold">{q.prompt}</p>
                <p className="mt-1 text-[0.9rem] text-muted">
                  You said <b className="text-fg">{q.answer}</b>
                  {a ? (a.correct ? ` · ${partnerName} got it` : ` · ${partnerName} missed it`) : ` · ${partnerName} hasn't answered yet`}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!card) return null;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-[0.88rem] text-muted">
        {partnerName} has {view.partnerOnMine.length ? `got ${rightOnMine} of ${view.partnerOnMine.length}` : "not answered any"} of yours so far.
      </p>
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity: 0, x: 30, rotate: 1 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -30, rotate: -1, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
          <p className="eyebrow text-accent-ink">
            About {partnerName} · {current + 1} of {view.count}
          </p>
          <h2 className="display mt-3 text-[clamp(1.7rem,6vw,2.3rem)] leading-tight">{card.prompt}</h2>
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {card.options.map((o, k) => {
              const answered = !!card.mine;
              const isRight = card.correctIndex === k;
              const isMine = card.mine?.choice === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={answered || pending}
                  onClick={() => {
                    sound("tap");
                    setReveal(current);
                    void sendMove({ type: "answer", index: current, choice: k }).catch(() => setReveal(null));
                  }}
                  className={cn(
                    "min-h-14 rounded-[14px] border-[1.5px] px-4 py-3 text-left font-semibold transition-colors",
                    !answered && "border-line hover:border-line-strong hover:bg-sunk",
                    answered && isRight && "border-[#5f7a4f] bg-[#5f7a4f] text-[#fbf7f1]",
                    answered && isMine && !isRight && "border-accent bg-accent text-on-accent",
                    answered && !isRight && !isMine && "border-line opacity-50",
                  )}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {card.mine ? (
            <p className="mt-4 font-semibold" role="status">
              {card.mine.correct ? `Yes! +${card.mine.points}` : "Nope. Noted, though."}
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
