"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/design/Button";
import type { GameProps } from "@/games/_engine/types";
import { cn } from "@/lib/cn";
import { sqAt, type Cell, type Color, type DraughtsMove, type DraughtsView, type EndReason } from "./logic";

const ENDED: Record<EndReason, string> = {
  "no-moves": "No moves left",
  threefold: "Same position three times. A draw",
  quiet: "25 king moves each with no capture. A draw",
  endgame: "The lone king held out. A draw",
  agreed: "Draw agreed",
};

const startsWith = (path: readonly number[], prefix: readonly number[]) => prefix.every((x, i) => path[i] === x);

export function DraughtsBoard({ view, me, names, sendMove, pending, sound }: GameProps<DraughtsView, DraughtsMove>) {
  // The squares tapped so far this move: the piece, then each landing square of a multi-jump.
  const [prefix, setPrefix] = useState<number[]>([]);
  const listRef = useRef<HTMLOListElement>(null);
  const partner = view.players.find((p) => p !== me) ?? "";
  const partnerName = names[partner] ?? "Your partner";
  const myTurn = !view.winner && view.turn === view.myColor;
  const flip = view.myColor === "b";
  const theirColor: Color = view.myColor === "w" ? "b" : "w";

  const posKey = view.notation.length;
  useEffect(() => {
    setPrefix([]);
    listRef.current?.scrollTo({ left: listRef.current.scrollWidth });
  }, [posKey]);

  const matching = useMemo(() => (prefix.length ? view.legal.filter((m) => startsWith(m.path, prefix)) : []), [view.legal, prefix]);
  const nextSteps = useMemo(() => new Set(matching.map((m) => m.path[prefix.length]).filter((n): n is number => n !== undefined)), [matching, prefix]);
  const movable = useMemo(() => new Set(view.legal.map((m) => m.path[0]!)), [view.legal]);
  // Pieces already jumped in the half-made move, shown faded.
  const jumping = new Set(matching[0]?.captured.slice(0, Math.max(0, prefix.length - 1)) ?? []);
  const lastPath = new Set(view.last?.path ?? []);
  const lastTaken = new Set(view.last?.captured ?? []);

  const tap = (sq: number) => {
    if (!myTurn || pending) return;
    if (prefix.length && nextSteps.has(sq)) {
      const next = [...prefix, sq];
      const left = view.legal.filter((m) => startsWith(m.path, next));
      if (left.length === 1 && left[0]!.path.length === next.length) {
        sound("drop");
        void sendMove({ kind: "move", path: next });
        return;
      }
      sound("tap");
      return setPrefix(next);
    }
    if (movable.has(sq) && sq !== prefix[0]) {
      sound("tap");
      return setPrefix([sq]);
    }
    setPrefix([]);
  };

  const status = view.winner
    ? view.winner === "tie"
      ? `${ENDED[view.reason ?? "agreed"]}.`
      : view.winner === me
        ? "You win."
        : `${partnerName} wins.`
    : myTurn
      ? prefix.length > 1
        ? "Keep jumping."
        : view.mustCapture
          ? "You must capture."
          : "Your move."
      : `${partnerName} is thinking…`;

  const cells = Array.from({ length: 100 }, (_, i) => {
    const r = flip ? 9 - Math.floor(i / 10) : Math.floor(i / 10);
    const c = flip ? 9 - (i % 10) : i % 10;
    return sqAt(r, c);
  });

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center">
      <p className="display mb-3 text-center text-[1.35rem] leading-tight" aria-live="polite">
        {status}
      </p>
      <div className="mb-2 w-full">
        <Side name={partnerName} color={theirColor} active={!view.winner && !myTurn} left={view.pieces[theirColor]} />
      </div>

      <div
        role="grid"
        aria-label={`Draughts board, you play ${view.myColor === "w" ? "white" : "black"}. ${status}`}
        data-tour="draughts-board"
        className="grid w-full grid-cols-10 overflow-hidden rounded-[14px] border-[2px] border-[#2a0b14] shadow-[0_20px_40px_-28px_rgba(28,20,22,.8)]"
      >
        {cells.map((sq, i) =>
          sq === null ? (
            <div key={`l${i}`} aria-hidden className="aspect-square bg-[#f1e2cc]" />
          ) : (
            <Square
              key={sq}
              sq={sq}
              piece={view.board[sq - 1] ?? null}
              onTap={() => tap(sq)}
              selected={prefix.includes(sq)}
              target={nextSteps.has(sq)}
              hint={myTurn && view.mustCapture && !prefix.length && movable.has(sq)}
              last={lastPath.has(sq)}
              justTaken={lastTaken.has(sq) && !view.board[sq - 1]}
              fading={jumping.has(sq)}
              clickable={myTurn && (movable.has(sq) || nextSteps.has(sq))}
            />
          ),
        )}
      </div>

      <div data-tour="draughts-players" className="mt-2 w-full">
        <Side name={names[me] ?? "You"} color={view.myColor} active={myTurn} left={view.pieces[view.myColor]} you />
      </div>

      {!view.winner ? (
        <div data-tour="draughts-draw" className="mt-4 flex min-h-11 flex-wrap items-center justify-center gap-2">
          {view.drawOffer && view.drawOffer !== me ? (
            <>
              <span className="text-[0.9rem] font-semibold">{partnerName} offers a draw.</span>
              <Button size="sm" onClick={() => void sendMove({ kind: "draw", action: "accept" })} disabled={pending}>
                Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void sendMove({ kind: "draw", action: "decline" })} disabled={pending}>
                Play on
              </Button>
            </>
          ) : view.drawOffer === me ? (
            <span className="text-[0.85rem] text-muted">You offered a draw. Your next move takes it back.</span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => void sendMove({ kind: "draw", action: "offer" })} disabled={pending}>
              Offer a draw
            </Button>
          )}
        </div>
      ) : null}

      {view.notation.length ? (
        <ol ref={listRef} aria-label="Moves" className="mt-3 flex w-full gap-3 overflow-x-auto whitespace-nowrap pb-1 text-[0.82rem] text-muted">
          {Array.from({ length: Math.ceil(view.notation.length / 2) }, (_, n) => (
            <li key={n} className="tabular">
              <span className="mr-1">{n + 1}.</span>
              <span className="font-semibold text-fg">{view.notation[n * 2]}</span> {view.notation[n * 2 + 1] ?? ""}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-center text-[0.82rem] text-muted">Tap a piece to see where it can go.</p>
      )}
    </div>
  );
}

type SquareProps = {
  sq: number;
  piece: Cell;
  onTap: () => void;
  selected: boolean;
  target: boolean;
  hint: boolean;
  last: boolean;
  justTaken: boolean;
  fading: boolean;
  clickable: boolean;
};

function Square({ sq, piece, onTap, selected, target, hint, last, justTaken, fading, clickable }: SquareProps) {
  const label = `Square ${sq}${piece ? `, ${piece.toLowerCase() === "w" ? "white" : "black"} ${piece === "W" || piece === "B" ? "king" : "man"}` : ""}${target ? ", move here" : ""}`;
  return (
    <button
      type="button"
      role="gridcell"
      onClick={onTap}
      aria-label={label}
      aria-selected={selected}
      className={cn("relative aspect-square select-none bg-[#a8705a]", clickable ? "cursor-pointer" : "cursor-default")}
    >
      {last ? <span aria-hidden className="absolute inset-0 bg-[rgba(232,86,58,.28)]" /> : null}
      {selected ? <span aria-hidden className="absolute inset-0 bg-[rgba(232,86,58,.55)]" /> : null}
      {justTaken ? <span aria-hidden className="absolute inset-[30%] rounded-full border-2 border-dashed border-[rgba(28,20,22,.45)]" /> : null}
      {piece ? <Disc piece={piece} faded={fading} ring={hint} /> : null}
      {target ? <span aria-hidden className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(28,20,22,.4)]" /> : null}
    </button>
  );
}

function Disc({ piece, faded, ring }: { piece: NonNullable<Cell>; faded?: boolean; ring?: boolean }) {
  const white = piece.toLowerCase() === "w";
  const king = piece === "W" || piece === "B";
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-[12%] flex items-center justify-center rounded-full border-[2px]",
        white ? "border-[#1c1416] bg-[#fffaf3]" : "border-[#000] bg-[#1c1416]",
        ring && "outline outline-[3px] outline-offset-1 outline-[#e8563a]",
        faded && "opacity-35",
      )}
      style={{ boxShadow: "inset 0 -3px 0 rgba(0,0,0,.18), 0 2px 0 rgba(28,20,22,.3)" }}
    >
      {king ? (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill={white ? "#e8563a" : "#f6c453"}>
          <path d="M3 18h18l-1.6-10-4.4 4-3-7-3 7-4.4-4z" />
        </svg>
      ) : null}
    </span>
  );
}

function Side({ name, color, active, left, you }: { name: string; color: Color; active: boolean; left: number; you?: boolean }) {
  return (
    <div className={cn("flex min-h-7 min-w-0 items-center justify-between gap-3", !active && "text-muted")}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className={cn("h-4 w-4 shrink-0 rounded-full border-[1.5px] border-fg", color === "w" ? "bg-[#fffaf3]" : "bg-[#1c1416]")} />
        <span className="truncate text-[0.9rem] font-semibold">
          {name}
          <span className="sr-only">
            {" "}
            ({you ? "you, " : ""}
            {color === "w" ? "white" : "black"})
          </span>
        </span>
      </span>
      <span className="tabular text-[0.85rem]">{left} pieces</span>
    </div>
  );
}
