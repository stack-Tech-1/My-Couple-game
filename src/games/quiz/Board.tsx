"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { listNames, Scores, Status } from "@/games/_ui";
import { Button } from "@/design/Button";
import { cn } from "@/lib/cn";
import type { QuizMove, QuizRound, QuizView } from "./logic";

export function QuizBoard({ view, me, names, sendMove, pending, sound }: GameProps<QuizView, QuizMove>) {
  const others = view.players.filter((p) => p !== me);
  const two = view.players.length === 2;
  const nameOf = (p: string) => (p === me ? "You" : (names[p] ?? "Someone"));
  // Rounds already shown to this player. Starts at what's done, so a reload doesn't replay old reveals.
  const [seen, setSeen] = useState(view.done.length);
  const [sentFor, setSentFor] = useState<number | null>(null);
  const cur = view.current;
  useEffect(() => {
    if (sentFor !== null && cur?.index !== sentFor) setSentFor(null);
  }, [cur?.index, sentFor]);
  const reveal = view.done.length > seen ? view.done[seen]! : null;
  const revealRight = reveal ? reveal.picks[me] === reveal.answer : null;
  useEffect(() => {
    if (revealRight !== null) sound(revealRight ? "win" : "flip");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per revealed round
  }, [seen, revealRight]);

  const score = <Scores players={view.players} me={me} names={names} scores={view.scores} className="mb-2" />;

  if (reveal) {
    const last = seen === view.total - 1;
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
        {score}
        <RoundCard round={reveal} index={seen} view={view} me={me} nameOf={nameOf} />
        <Button onClick={() => setSeen((n) => n + 1)} className="self-center">
          {last ? "See the result" : "Next question"}
        </Button>
      </div>
    );
  }

  if (view.winner) {
    const winnerText =
      view.winner === "tie"
        ? two
          ? "Level. Nobody's sleeping on the couch."
          : "A tie at the top."
        : view.winner === me
          ? "You win this one."
          : `${nameOf(view.winner)} wins this one.`;
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
        {score}
        <Status>{winnerText}</Status>
        <ul className="flex flex-col gap-2">
          {view.done.map((r, i) => (
            <li key={i} className="rounded-[14px] border border-line bg-raised px-4 py-3 text-[0.92rem]">
              <p className={cn("font-semibold", view.look === "emoji" && "text-[1.4rem]")}>{r.q}</p>
              <p className="mt-1 text-muted">
                {r.options[r.answer]}
                {r.note ? ` · ${r.note}` : ""} ·{" "}
                {view.players.map((p) => `${nameOf(p).toLowerCase() === "you" ? "you" : nameOf(p)} ${r.picks[p] === r.answer ? "✓" : "✗"}`).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const waiting = others.filter((p) => !view.answered.includes(p));

  if (!cur) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
        {score}
        <Status>Waiting for {listNames(waiting, names)} to answer…</Status>
      </div>
    );
  }

  const locked = sentFor === cur.index || pending;
  const pick = (k: number) => {
    if (locked) return;
    sound("tap");
    setSentFor(cur.index);
    void sendMove({ index: cur.index, pick: k }).catch(() => setSentFor(null));
  };
  const theyAnswered = others.filter((p) => view.answered.includes(p));

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      {score}
      <div className="flex justify-between gap-3 text-[0.85rem] text-muted">
        <span className="tabular">{cur.index + 1} of {view.total}</span>
        <span className="text-right">
          {two
            ? theyAnswered.length
              ? `${nameOf(others[0]!)} has answered`
              : `${nameOf(others[0]!)} is thinking…`
            : `${theyAnswered.length} of ${others.length} have answered`}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={cur.index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
          <p className="eyebrow" style={{ color: "var(--cat-competitive-ink)" }}>{cur.ask ?? view.ask}</p>
          <h2 className={cn("mt-3 leading-tight", view.look === "emoji" ? "text-center text-[clamp(2.6rem,12vw,3.6rem)]" : "display text-[clamp(1.5rem,6vw,2.1rem)]")}>{cur.q}</h2>
          <div className="mt-6 grid gap-2.5">
            {cur.options.map((o, k) => (
              <button key={k} type="button" disabled={locked} onClick={() => pick(k)} className="min-h-14 rounded-[14px] border-[1.5px] border-line px-4 py-3 text-left font-semibold transition-colors hover:border-line-strong hover:bg-sunk disabled:opacity-60">
                {o}
              </button>
            ))}
          </div>
          {locked ? <p className="mt-4 text-center text-[0.88rem] text-muted">Locked in.</p> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function RoundCard({ round, index, view, me, nameOf }: { round: QuizRound; index: number; view: QuizView; me: string; nameOf: (p: string) => string }) {
  const right = round.picks[me] === round.answer;
  // Me first, then everyone else in seat order.
  const order = [me, ...view.players.filter((p) => p !== me)];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
      <p className="eyebrow tabular text-muted">{index + 1} of {view.total}</p>
      <h2 className={cn("mt-2 leading-tight", view.look === "emoji" ? "text-center text-[2.6rem]" : "display text-[1.5rem]")}>{round.q}</h2>
      <p className="mt-4 display text-[1.6rem]" role="status">{right ? "You got it." : "Not this time."}</p>
      <p className="mt-1 font-semibold">
        {round.options[round.answer]}
        {round.note ? <span className="font-normal text-muted"> · {round.note}</span> : null}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-[0.9rem]">
        {order.map((p) => (
          <div key={p}>
            <p className="text-muted">{p === me ? "You said" : `${nameOf(p)} said`}</p>
            <p className={cn("font-semibold", round.picks[p] === round.answer ? "text-sage-ink" : "text-accent-ink")}>{round.options[round.picks[p]!]}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
