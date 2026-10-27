"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/design/Button";
import type { GameProps } from "@/games/_engine/types";
import { cn } from "@/lib/cn";
import { TO_WIN, type Mark, type TttMove, type TttView } from "./logic";

const COLOR: Record<1 | 2, string> = { 1: "#e8563a", 2: "#3f6f8f" };

export function TicTacToeBoard({ view, me, names, sendMove, pending, sound }: GameProps<TttView, TttMove>) {
  const reduce = useReducedMotion();
  const you = view.you;
  const them: 0 | 1 = you === 0 ? 1 : 0;
  const partnerName = names[view.players[them]] ?? "Your partner";
  const myTurn = !view.winner && !view.roundResult && view.turn === you;
  const line = new Set(view.roundResult?.line ?? []);
  const myMark: 1 | 2 = you === 0 ? 1 : 2;

  const tap = (cell: number) => {
    if (!myTurn || pending || view.board[cell] !== 0) return;
    sound("drop");
    void sendMove({ kind: "mark", cell });
  };

  const result = view.roundResult;
  const status = view.winner
    ? view.winner === "tie"
      ? "All square. A tied match."
      : view.winner === me
        ? "You take the match."
        : `${partnerName} takes the match.`
    : result
      ? result.winner === null
        ? "A draw. Nobody scores."
        : result.winner === you
          ? "You win the round."
          : `${partnerName} wins the round.`
      : myTurn
        ? "Your move."
        : `${partnerName}'s move…`;

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center">
      <div data-tour="ttt-score" className="mb-2 flex w-full items-center justify-between">
        <Score name={names[me] ?? "You"} mark={myMark} score={view.score[you]} active={myTurn} />
        <span className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Round {view.round} · first to {TO_WIN}
        </span>
        <Score name={partnerName} mark={myMark === 1 ? 2 : 1} score={view.score[them]} active={!view.winner && !result && !myTurn} align="right" />
      </div>
      <p className="display mb-4 text-center text-[1.4rem]" aria-live="polite">
        {status}
      </p>

      <div role="grid" aria-label={`Noughts and crosses board. ${status}`} data-tour="ttt-board" className="grid w-full grid-cols-3 gap-2 rounded-[22px] bg-[#5b1a2b] p-2">
        {view.board.map((c, i) => (
          <button
            key={i}
            type="button"
            role="gridcell"
            onClick={() => tap(i)}
            disabled={!myTurn || pending || c !== 0}
            aria-label={`Square ${i + 1}${c ? `, ${c === 1 ? "X" : "O"}` : ", empty"}`}
            className={cn("relative aspect-square rounded-[14px] bg-raised transition-colors", myTurn && c === 0 && "hover:bg-sunk", line.has(i) && "bg-[#fff3ea]")}
          >
            {c ? <MarkSvg mark={c} fresh={view.last === i && !reduce} win={line.has(i)} /> : null}
          </button>
        ))}
      </div>

      {result && !view.winner ? (
        <Button className="mt-5" onClick={() => void sendMove({ kind: "next" })} disabled={pending}>
          Next round
        </Button>
      ) : null}
    </div>
  );
}

function MarkSvg({ mark, fresh, win }: { mark: Mark; fresh: boolean; win: boolean }) {
  const color = COLOR[mark as 1 | 2];
  const draw = { initial: fresh ? { pathLength: 0 } : false, animate: { pathLength: 1 }, transition: { duration: 0.28, ease: "easeOut" as const } };
  return (
    <svg viewBox="0 0 100 100" className={cn("absolute inset-[16%]", win && "drop-shadow-[0_0_6px_rgba(232,86,58,.5)]")} aria-hidden>
      {mark === 1 ? (
        <>
          <motion.path d="M20 20 L80 80" stroke={color} strokeWidth={13} strokeLinecap="round" fill="none" {...draw} />
          <motion.path d="M80 20 L20 80" stroke={color} strokeWidth={13} strokeLinecap="round" fill="none" {...draw} transition={{ ...draw.transition, delay: fresh ? 0.12 : 0 }} />
        </>
      ) : (
        <motion.circle cx={50} cy={50} r={32} stroke={color} strokeWidth={13} fill="none" {...draw} />
      )}
    </svg>
  );
}

function Score({ name, mark, score, active, align }: { name: string; mark: 1 | 2; score: number; active: boolean; align?: "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right", !active && "text-muted")}>
      <span className="display tabular text-[1.8rem] leading-none text-fg">{score}</span>
      <span className="min-w-0">
        <span className="block truncate text-[0.85rem] font-semibold">{name}</span>
        <span className="block text-[0.72rem] font-bold" style={{ color: COLOR[mark] }}>
          {mark === 1 ? "X" : "O"}
        </span>
      </span>
    </div>
  );
}
