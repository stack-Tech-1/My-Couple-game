"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { listNames, Status } from "@/games/_ui";
import { Button } from "@/design/Button";
import { cn } from "@/lib/cn";
import { topVoted, type MostLikelyMove, type MostLikelyRound, type MostLikelyView } from "./logic";

export function MostLikelyBoard({ view, me, names, sendMove, pending, sound }: GameProps<MostLikelyView, MostLikelyMove>) {
  const nameOf = (p: string) => (p === me ? "You" : (names[p] ?? "Someone"));
  const [seen, setSeen] = useState(view.done.length);
  const [sentFor, setSentFor] = useState<number | null>(null);
  const cur = view.current;
  useEffect(() => {
    if (sentFor !== null && cur?.index !== sentFor) setSentFor(null);
  }, [cur?.index, sentFor]);
  const reveal = view.done.length > seen ? view.done[seen]! : null;
  useEffect(() => {
    if (reveal) sound("flip");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per revealed round
  }, [seen, !!reveal]);

  if (reveal) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
        <Round round={reveal} index={seen} total={view.total} nameOf={nameOf} players={view.players} />
        <Button onClick={() => setSeen((n) => n + 1)} className="self-center">
          {seen === view.total - 1 ? "See the verdict" : "Next one"}
        </Button>
      </div>
    );
  }

  if (view.finished) {
    // Who topped the most prompts (shared tops count for everyone in them).
    const wins: Record<string, number> = Object.fromEntries(view.players.map((p) => [p, 0]));
    for (const r of view.done) for (const p of topVoted(r.counts)) wins[p]!++;
    const ranked = [...view.players].sort((a, b) => wins[b]! - wins[a]!);
    const champ = ranked.filter((p) => wins[p] === wins[ranked[0]!] && wins[p]! > 0);
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
        <Status>{champ.length ? `Most likely to everything: ${listNames(champ, names, me).replace(/^you/, "you")}.` : "Nobody stood out. Suspicious."}</Status>
        <ul className="flex flex-col gap-2">
          {view.done.map((r, i) => {
            const top = topVoted(r.counts);
            return (
              <li key={i} className="rounded-[14px] border border-line bg-raised px-4 py-3 text-[0.92rem]">
                <p className="font-semibold">Most likely to {r.prompt}</p>
                <p className="mt-1 text-muted">{top.length ? `${top.map(nameOf).join(" & ")} · ${r.counts[top[0]!]} ${r.counts[top[0]!] === 1 ? "vote" : "votes"}` : "No votes"}</p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!cur) {
    const waiting = view.players.filter((p) => !view.answered.includes(p));
    return <Status>Waiting for {listNames(waiting, names, me)} to vote…</Status>;
  }

  const locked = sentFor === cur.index || pending;
  const vote = (p: string) => {
    if (locked) return;
    sound("tap");
    setSentFor(cur.index);
    void sendMove({ index: cur.index, vote: p }).catch(() => setSentFor(null));
  };

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <div className="flex justify-between text-[0.85rem] text-muted">
        <span className="tabular">{cur.index + 1} of {view.total}</span>
        <span>{view.answered.length} of {view.players.length} have voted</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={cur.index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
          <p className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>Who&apos;s most likely to…</p>
          <h2 className="display mt-3 text-[clamp(1.7rem,6.5vw,2.3rem)] leading-tight">{cur.prompt}?</h2>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {view.players.map((p) => (
              <button key={p} type="button" disabled={locked} onClick={() => vote(p)} className="min-h-14 rounded-[14px] border-[1.5px] border-line px-4 py-3 text-left font-semibold transition-colors hover:border-line-strong hover:bg-sunk disabled:opacity-60">
                {nameOf(p)}
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-[0.85rem] text-muted">{locked ? "Voted. Nobody will know it was you." : "Votes are anonymous."}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Round({ round, index, total, nameOf, players }: { round: MostLikelyRound; index: number; total: number; nameOf: (p: string) => string; players: readonly string[] }) {
  const top = topVoted(round.counts);
  const max = Math.max(1, ...Object.values(round.counts));
  const ranked = [...players].sort((a, b) => round.counts[b]! - round.counts[a]!);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
      <p className="eyebrow tabular text-muted">{index + 1} of {total}</p>
      <h2 className="display mt-2 text-[1.5rem] leading-tight">Most likely to {round.prompt}</h2>
      <p className="mt-4 display text-[1.6rem]" role="status">{top.length === 1 ? `${nameOf(top[0]!)}.` : `${top.map(nameOf).join(" and ")}, tied.`}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {ranked.map((p) => (
          <li key={p} className="text-[0.88rem]">
            <div className="flex justify-between">
              <span className={cn(top.includes(p) && "font-semibold")}>{nameOf(p)}</span>
              <span className="tabular text-muted">{round.counts[p]}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk">
              <div className="h-full rounded-full" style={{ width: `${(round.counts[p]! / max) * 100}%`, background: top.includes(p) ? "var(--accent)" : "var(--fg)" }} />
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
