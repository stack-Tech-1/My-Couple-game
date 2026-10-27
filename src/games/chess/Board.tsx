"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/design/Button";
import type { GameProps } from "@/games/_engine/types";
import { cn } from "@/lib/cn";
import type { ChessMove, ChessView, EndReason, Piece, Promo } from "./logic";

const FILES = "abcdefgh";
const squareAt = (i: number) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;

// Filled glyphs for both sides (coloured by CSS); U+FE0E keeps phones from drawing them as emoji.
const GLYPH: Record<string, string> = { k: "♚︎", q: "♛︎", r: "♜︎", b: "♝︎", n: "♞︎", p: "♟︎" };
const NAME: Record<string, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const ENDED: Record<EndReason, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate. A draw",
  insufficient: "Not enough pieces to mate. A draw",
  threefold: "Same position three times. A draw",
  fifty: "Fifty moves with no capture. A draw",
  agreed: "Draw agreed",
};

export function ChessBoard({ view, me, names, sendMove, pending, sound }: GameProps<ChessView, ChessMove>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const partner = view.players.find((p) => p !== me) ?? "";
  const partnerName = names[partner] ?? "Your partner";
  const myTurn = !view.winner && view.turn === view.myColor;
  const flip = view.myColor === "b";

  // A new position clears any half-made move.
  const posKey = view.san.length;
  useEffect(() => {
    setSelected(null);
    setPromo(null);
    listRef.current?.scrollTo({ left: listRef.current.scrollWidth });
  }, [posKey]);

  const targets = useMemo(() => new Map(view.legal.filter((m) => m.from === selected).map((m) => [m.to, m])), [view.legal, selected]);
  const movable = useMemo(() => new Set(view.legal.map((m) => m.from)), [view.legal]);

  const send = (move: ChessMove) => {
    sound(move.kind === "move" ? "drop" : "tap");
    void sendMove(move);
  };

  const tap = (sq: string) => {
    if (!myTurn || pending) return;
    const target = selected ? targets.get(sq) : undefined;
    if (selected && target) {
      if (target.promotion) return setPromo({ from: selected, to: sq });
      return send({ kind: "move", from: selected, to: sq });
    }
    setSelected(movable.has(sq) && sq !== selected ? sq : null);
    if (movable.has(sq)) sound("tap");
  };

  const status = view.winner
    ? view.reason === "checkmate"
      ? view.winner === me
        ? "Checkmate. You win."
        : `Checkmate. ${partnerName} wins.`
      : `${ENDED[view.reason ?? "agreed"]}.`
    : view.check
      ? myTurn
        ? "Check! Protect your king."
        : `You've put ${partnerName} in check.`
      : myTurn
        ? "Your move."
        : `${partnerName} is thinking…`;

  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i));
  const theirColor = view.myColor === "w" ? "b" : "w";

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center">
      <p className="display mb-3 text-center text-[1.35rem] leading-tight" aria-live="polite">
        {status}
      </p>
      <div className="mb-2 w-full">
        <Side name={partnerName} color={theirColor} active={!view.winner && !myTurn} took={view.captured[view.myColor]} lost={view.captured[theirColor]} />
      </div>

      <div
        role="grid"
        aria-label={`Chess board, you play ${view.myColor === "w" ? "white" : "black"}. ${status}`}
        data-tour="chess-board"
        className="grid w-full grid-cols-8 overflow-hidden rounded-[14px] border-[2px] border-[#2a0b14] shadow-[0_20px_40px_-28px_rgba(28,20,22,.8)]"
      >
        {order.map((i) => {
          const sq = squareAt(i);
          const piece = view.board[i];
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const isTarget = targets.has(sq);
          const isLast = view.last && (view.last.from === sq || view.last.to === sq);
          const row = flip ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
          const col = flip ? 7 - (i % 8) : i % 8;
          return (
            <button
              key={sq}
              type="button"
              role="gridcell"
              onClick={() => tap(sq)}
              aria-label={`${sq}${piece ? `, ${piece[0] === "w" ? "white" : "black"} ${NAME[piece[1]!]}` : ""}${isTarget ? ", move here" : ""}`}
              aria-pressed={selected === sq || undefined}
              className={cn("relative aspect-square select-none", dark ? "bg-[#a8705a]" : "bg-[#f1e2cc]", myTurn && (movable.has(sq) || isTarget) ? "cursor-pointer" : "cursor-default")}
            >
              {isLast ? <span aria-hidden className="absolute inset-0 bg-[rgba(232,86,58,.28)]" /> : null}
              {selected === sq ? <span aria-hidden className="absolute inset-0 bg-[rgba(232,86,58,.5)]" /> : null}
              {view.check === sq ? <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle,rgba(220,38,38,.85)_0%,rgba(220,38,38,.35)_55%,transparent_75%)]" /> : null}
              {col === 0 ? <span aria-hidden className={cn("absolute left-[4%] top-[2%] text-[0.62rem] font-bold", dark ? "text-[#f1e2cc]" : "text-[#a8705a]")}>{sq[1]}</span> : null}
              {row === 7 ? <span aria-hidden className={cn("absolute bottom-[1%] right-[5%] text-[0.62rem] font-bold", dark ? "text-[#f1e2cc]" : "text-[#a8705a]")}>{sq[0]}</span> : null}
              {piece ? <PieceGlyph piece={piece} /> : null}
              {isTarget ? (
                piece ? (
                  <span aria-hidden className="absolute inset-[6%] rounded-full border-[4px] border-[rgba(28,20,22,.45)]" />
                ) : (
                  <span aria-hidden className="absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(28,20,22,.35)]" />
                )
              ) : null}
            </button>
          );
        })}
      </div>

      <div data-tour="chess-players" className="mt-2 w-full">
        <Side name={names[me] ?? "You"} color={view.myColor} active={myTurn} took={view.captured[theirColor]} lost={view.captured[view.myColor]} you />
      </div>

      {promo ? (
        <div role="group" aria-label="Promote your pawn" className="mt-4 flex items-center gap-2 rounded-[16px] border border-line bg-raised p-2">
          <span className="px-2 text-[0.85rem] font-semibold">Promote to</span>
          {(["q", "r", "b", "n"] as Promo[]).map((p) => (
            <button key={p} type="button" aria-label={NAME[p]} onClick={() => send({ kind: "move", from: promo.from, to: promo.to, promotion: p })} className="h-12 w-12 rounded-[10px] bg-[#f1e2cc] hover:bg-[#e9d2b3]">
              <PieceGlyph piece={`${view.myColor}${p}` as Piece} />
            </button>
          ))}
          <button type="button" onClick={() => setPromo(null)} className="px-2 text-[0.85rem] text-muted underline">
            Cancel
          </button>
        </div>
      ) : null}

      {!view.winner ? (
        <div data-tour="chess-draw" className="mt-4 flex min-h-11 flex-wrap items-center justify-center gap-2">
          {view.drawOffer && view.drawOffer !== me ? (
            <>
              <span className="text-[0.9rem] font-semibold">{partnerName} offers a draw.</span>
              <Button size="sm" onClick={() => send({ kind: "draw", action: "accept" })} disabled={pending}>
                Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => send({ kind: "draw", action: "decline" })} disabled={pending}>
                Play on
              </Button>
            </>
          ) : view.drawOffer === me ? (
            <span className="text-[0.85rem] text-muted">You offered a draw. Your next move takes it back.</span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => send({ kind: "draw", action: "offer" })} disabled={pending}>
              Offer a draw
            </Button>
          )}
        </div>
      ) : null}

      {view.san.length ? (
        <ol ref={listRef} aria-label="Moves" className="mt-3 flex w-full gap-3 overflow-x-auto whitespace-nowrap pb-1 text-[0.82rem] text-muted">
          {Array.from({ length: Math.ceil(view.san.length / 2) }, (_, n) => (
            <li key={n} className="tabular">
              <span className="mr-1">{n + 1}.</span>
              <span className="font-semibold text-fg">{view.san[n * 2]}</span> {view.san[n * 2 + 1] ?? ""}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-center text-[0.82rem] text-muted">Tap a piece to see where it can go.</p>
      )}
    </div>
  );
}

function PieceGlyph({ piece }: { piece: Piece }) {
  const white = piece[0] === "w";
  return (
    <span
      aria-hidden
      className="absolute inset-0 flex items-center justify-center leading-none"
      style={{
        fontSize: "min(9.5vw, 3.3rem)",
        fontFamily: "'Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols 2',serif",
        color: white ? "#fffaf3" : "#1c1416",
        WebkitTextStroke: white ? "1.2px #1c1416" : "0.6px #1c1416",
        textShadow: white ? "0 2px 0 rgba(28,20,22,.25)" : "0 2px 0 rgba(0,0,0,.2)",
      }}
    >
      {GLYPH[piece[1]!]}
    </span>
  );
}

function Side({ name, color, active, took, lost, you }: { name: string; color: "w" | "b"; active: boolean; took: Piece[]; lost: Piece[]; you?: boolean }) {
  const lead = took.reduce((a, p) => a + VALUE[p[1]!]!, 0) - lost.reduce((a, p) => a + VALUE[p[1]!]!, 0);
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
      {took.length ? (
        <span className="text-[0.95rem] leading-none tracking-[-0.12em] text-fg" aria-label={`Captured ${took.length}`}>
          {took.map((p, i) => (
            <span key={i}>{GLYPH[p[1]!]}</span>
          ))}
          {lead > 0 ? <span className="ml-1 text-[0.72rem] tracking-normal text-muted">+{lead}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
