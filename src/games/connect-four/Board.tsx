"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState, type KeyboardEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { cn } from "@/lib/cn";
import { COLS, ROWS, dropRow, idx, type C4Move, type C4View, type Cell } from "./logic";

const DISC: Record<1 | 2, { fill: string; rim: string; name: string }> = {
  1: { fill: "#e8563a", rim: "#a8361f", name: "ember" },
  2: { fill: "#efd6a0", rim: "#b8893b", name: "brass" },
};

export function ConnectFourBoard({ view, me, names, sendMove, pending, sound }: GameProps<C4View, C4Move>) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const colRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const myTurn = !view.winner && view.players[view.turn] === me;
  const myPiece = view.you;
  const theirPiece: 1 | 2 = myPiece === 1 ? 2 : 1;
  const winSet = new Set(view.winLine ?? []);

  const drop = (col: number) => {
    if (!myTurn || pending || dropRow(view.board, col) === -1) return;
    sound("drop");
    void sendMove({ col });
  };

  const onKey = (e: KeyboardEvent, col: number) => {
    let next = col;
    if (e.key === "ArrowRight") next = Math.min(COLS - 1, col + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, col - 1);
    else if (e.key >= "1" && e.key <= "7") next = Number(e.key) - 1;
    else return;
    e.preventDefault();
    colRefs.current[next]?.focus();
    setHover(next);
  };

  const status = view.winner
    ? view.winner === "tie"
      ? "A full frame and no winner."
      : view.winner === me
        ? "Four in a row. Yours."
        : `${names[view.winner] ?? "They"} found four.`
    : myTurn
      ? "Your move."
      : `${names[view.players[view.turn]] ?? "Your partner"} is thinking…`;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center">
      <div data-tour="c4-players" className="mb-5 flex w-full items-center justify-between gap-4">
        <PlayerChip name={names[me] ?? "You"} piece={myPiece} active={myTurn} label="you" />
        <p className="display text-center text-[1.4rem] leading-tight" aria-live="polite">{status}</p>
        <PlayerChip name={names[view.players.find((p) => p !== me) ?? ""] ?? "Partner"} piece={theirPiece} active={!view.winner && !myTurn} align="right" />
      </div>

      {/* ghost disc row */}
      <div className="grid w-full px-[3.5%]" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} aria-hidden>{/* aligned with columns */}
        {Array.from({ length: COLS }, (_, c) => (
          <div key={c} className="flex justify-center pb-1.5">
            <span
              className="block aspect-square w-[82%] rounded-full transition-[opacity,transform] duration-150"
              style={{
                background: DISC[myPiece].fill,
                boxShadow: `inset 0 -3px 0 ${DISC[myPiece].rim}`,
                opacity: myTurn && hover === c ? 0.85 : 0,
                transform: myTurn && hover === c ? "none" : "translateY(-6px)",
              }}
            />
          </div>
        ))}
      </div>

      <div
        role="group"
        aria-label={`Connect Four board. ${status}`}
        data-tour="c4-board"
        className="relative w-full rounded-[20px] border-[2px] border-[#2a0b14] bg-[#5b1a2b] p-[3.5%] shadow-[inset_0_-6px_0_rgba(0,0,0,.25),0_20px_40px_-28px_rgba(28,20,22,.8)]"
        onMouseLeave={() => setHover(null)}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {Array.from({ length: COLS }, (_, c) => {
            const free = dropRow(view.board, c);
            const full = free === -1;
            return (
              <button
                key={c}
                ref={(el) => {
                  colRefs.current[c] = el;
                }}
                type="button"
                disabled={!myTurn || pending}
                aria-disabled={full || undefined}
                aria-label={`Column ${c + 1}${full ? ", full" : `, ${free + 1} spaces free`}`}
                onClick={() => drop(c)}
                onMouseEnter={() => setHover(c)}
                onFocus={() => setHover(c)}
                onKeyDown={(e) => onKey(e, c)}
                className={cn(
                  "flex flex-col rounded-[12px] py-[4%] transition-colors focus-visible:outline-offset-1",
                  myTurn && !full && "cursor-pointer hover:bg-[rgba(255,255,255,.06)]",
                  "disabled:cursor-default",
                )}
              >
                {Array.from({ length: ROWS }, (_, r) => (
                  <Hole key={r} cell={view.board[idx(r, c)] as Cell} drop={view.last?.col === c && view.last.row === r} row={r} winning={winSet.has(idx(r, c))} reduce={!!reduce} />
                ))}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-center text-[0.82rem] text-muted">
        <span className="hidden sm:inline">Arrow keys or 1–7 to aim, Enter to drop.</span>
        <span className="sm:hidden">Tap a column to drop.</span>
      </p>
    </div>
  );
}

function Hole({ cell, drop, row, winning, reduce }: { cell: Cell; drop: boolean; row: number; winning: boolean; reduce: boolean }) {
  return (
    <span className="block w-full p-[9%]">
    <span className="relative block aspect-square w-full rounded-full bg-sunk shadow-[inset_0_3px_0_rgba(0,0,0,.28)]">
      {cell ? (
        <motion.span
          key={`${cell}`}
          className="absolute inset-0 rounded-full"
          style={{ background: DISC[cell].fill, boxShadow: `inset 0 -4px 0 ${DISC[cell].rim}, inset 0 2px 0 rgba(255,255,255,.35)` }}
          initial={drop && !reduce ? { y: `-${(row + 1) * 125}%` } : false}
          animate={{ y: 0, scale: winning ? [1, 1.12, 1] : 1 }}
          transition={
            winning
              ? { scale: { repeat: Infinity, duration: 1.1, ease: "easeInOut" } }
              : { type: "spring", stiffness: 520, damping: 22, mass: 0.9 + row * 0.05 }
          }
        />
      ) : null}
      {winning ? <span aria-hidden className="absolute -inset-[8%] rounded-full border-[2.5px] border-[#fff3ea]" /> : null}
    </span>
    </span>
  );
}

function PlayerChip({ name, piece, active, align, label }: { name: string; piece: 1 | 2; active: boolean; align?: "right"; label?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2 transition-colors", align === "right" && "flex-row-reverse text-right", !active && "text-muted")}>
      <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: DISC[piece].fill, boxShadow: `inset 0 -2px 0 ${DISC[piece].rim}` }} aria-hidden />
      <span className="truncate text-[0.9rem] font-semibold">
        {name}
        {label ? <span className="sr-only"> ({label}, {DISC[piece].name})</span> : <span className="sr-only"> ({DISC[piece].name})</span>}
      </span>
    </div>
  );
}
