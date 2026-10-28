"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/design/Button";
import type { GameProps, PlayerId } from "@/games/_engine/types";
import { TimerBar, useCountdown, useTickAtDeadline } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { analyse, BONUS, LETTER_VALUES, LIVE_MS, QUICK_ROUNDS, RACK, SIZE, type Bonus, type LogEntry, type SpellMove, type SpellView } from "./logic";

type Pending = { cell: number; letter: string; blank: boolean; rackIdx: number };

const BONUS_STYLE: Record<Exclude<Bonus, null>, { label: string; bg: string; fg: string; name: string }> = {
  tw: { label: "3W", bg: "#c8553d", fg: "#fff", name: "triple word" },
  dw: { label: "2W", bg: "#eba596", fg: "#5b1a2b", name: "double word" },
  tl: { label: "3L", bg: "#3f6f8f", fg: "#fff", name: "triple letter" },
  dl: { label: "2L", bg: "#b5d2e3", fg: "#1f3d52", name: "double letter" },
  star: { label: "★", bg: "#e8563a", fg: "#fff", name: "start star" },
};
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

export function SpellAmBoard({ view, me, names, sendMove, pending, sound, clock }: GameProps<SpellView, SpellMove>) {
  const [placed, setPlaced] = useState<Pending[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(() => view.rack.map((_, i) => i));
  const [blankCell, setBlankCell] = useState<{ cell: number; rackIdx: number } | null>(null);
  const [swapping, setSwapping] = useState<Set<number> | null>(null);
  const current = view.players[view.turn]!;
  const myTurn = !view.winner && current === me;
  const live = view.mode === "live";
  const left = useCountdown(live && !view.winner ? view.deadline : null, clock);
  const name = useCallback((p: PlayerId) => (p === me ? "You" : (names[p] ?? "Someone")), [me, names]);

  useTickAtDeadline(
    live && !view.winner && view.awake.includes(current) ? view.deadline : null,
    clock,
    useCallback(() => void sendMove({ kind: "tick" }, { silent: true }), [sendMove]),
  );

  // A new turn (or a new rack) clears anything half-placed.
  const rackKey = view.rack.join("");
  const rackLen = view.rack.length;
  useEffect(() => {
    setPlaced([]);
    setSelected(null);
    setBlankCell(null);
    setSwapping(null);
    setOrder(Array.from({ length: rackLen }, (_, i) => i));
  }, [view.seq, rackKey, rackLen]);

  const used = new Set(placed.map((p) => p.rackIdx));
  const pendingAt = useMemo(() => new Map(placed.map((p) => [p.cell, p])), [placed]);
  const lastCells = new Set(view.last?.cells ?? []);
  const preview = useMemo(() => (placed.length ? analyse(view.board, placed) : null), [view.board, placed]);

  const tapCell = (cell: number) => {
    if (!myTurn || pending || swapping) return;
    const here = pendingAt.get(cell);
    if (here) {
      setPlaced(placed.filter((p) => p.cell !== cell));
      return;
    }
    if (view.board[cell] || selected === null) return;
    const letter = view.rack[selected]!;
    sound("drop");
    if (letter === "?") {
      setBlankCell({ cell, rackIdx: selected });
      setSelected(null);
      return;
    }
    setPlaced([...placed, { cell, letter, blank: false, rackIdx: selected }]);
    setSelected(null);
  };

  const tapRack = (i: number) => {
    if (!myTurn || pending) return;
    if (swapping) {
      const next = new Set(swapping);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      setSwapping(next);
      return;
    }
    if (used.has(i)) return;
    sound("tap");
    setSelected(selected === i ? null : i);
  };

  const play = () => {
    if (!preview?.ok) return;
    sound("drop");
    void sendMove({ kind: "play", tiles: placed.map((p) => ({ cell: p.cell, letter: p.letter, ...(p.blank ? { blank: true } : {}) })) });
  };

  const status = view.winner
    ? view.winner === "tie"
      ? "A tie. Rematch?"
      : view.winner === me
        ? "You win!"
        : `${names[view.winner] ?? "Someone"} wins.`
    : myTurn
      ? view.round === 1 && view.board.every((c) => !c)
        ? "You start. Cover the star."
        : "Your turn."
      : `${names[current] ?? "Someone"} is thinking…`;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center">
      <div data-tour="sa-scores" className="mb-2 flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-1">
        {view.players.map((p) => (
          <div key={p} className={cn("min-w-0", p !== current && "text-muted")}>
            <span className="display tabular mr-1.5 text-[1.6rem] leading-none text-fg">{view.scores[p]}</span>
            <span className="text-[0.85rem] font-semibold">{p === me ? "You" : (names[p] ?? "Player")}</span>
          </div>
        ))}
        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-muted">
          {view.mode === "quick" ? `Round ${Math.min(view.round, QUICK_ROUNDS)} of ${QUICK_ROUNDS} · ` : ""}
          {view.bagCount} in the bag
        </span>
      </div>
      <p className="display mb-2 text-center text-[1.25rem] leading-tight" aria-live="polite">
        {status}
      </p>
      {live && !view.winner ? <TimerBar left={left} total={LIVE_MS} className="mb-2" /> : null}

      <div
        role="grid"
        aria-label={`Spell Am board. ${status}`}
        data-tour="sa-board"
        className="grid w-full gap-[2px] rounded-[12px] bg-[#5b1a2b] p-[3px]"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {view.board.map((tile, cell) => {
          const mine = pendingAt.get(cell);
          const bonus = BONUS[cell] ?? null;
          const letter = tile?.l ?? mine?.letter;
          const blank = tile?.blank ?? mine?.blank;
          return (
            <button
              key={cell}
              type="button"
              role="gridcell"
              onClick={() => tapCell(cell)}
              aria-label={`Row ${Math.floor(cell / SIZE) + 1}, column ${(cell % SIZE) + 1}${letter ? `, ${letter.toUpperCase()}${mine ? ", yours to move" : ""}` : bonus ? `, ${BONUS_STYLE[bonus].name}` : ""}`}
              className={cn("relative aspect-square select-none rounded-[3px]", !letter && "bg-[#f5ead9]")}
              style={!letter && bonus ? { background: BONUS_STYLE[bonus].bg, color: BONUS_STYLE[bonus].fg } : undefined}
            >
              {letter ? (
                <TileFace letter={letter} blank={!!blank} tone={mine ? "pending" : lastCells.has(cell) ? "fresh" : "set"} />
              ) : bonus ? (
                <span aria-hidden className="text-[clamp(0.42rem,2vw,0.62rem)] font-bold">
                  {BONUS_STYLE[bonus].label}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-2 min-h-6 text-center text-[0.85rem]" aria-live="polite">
        {preview ? (
          preview.ok ? (
            <span>
              {preview.words.map((w, i) => (
                <span key={i} className="mr-2 inline-block">
                  <strong className="tracking-[0.06em]">{w.word.toUpperCase()}</strong> {w.score}
                  {w.naija ? <span className="ml-1 rounded-full bg-[#3f9a5c] px-1.5 text-[0.7rem] font-bold text-white">Naija +5</span> : null}
                </span>
              ))}
              {preview.sweep ? <span className="font-bold text-[#e8563a]">Clean sweep +40</span> : null}
            </span>
          ) : (
            <span className="text-muted">{preview.error}</span>
          )
        ) : myTurn && !swapping ? (
          <span className="text-muted">Tap a tile, then tap a square.</span>
        ) : null}
      </div>

      {blankCell ? (
        <div role="group" aria-label="Choose a letter for the blank" className="mt-2 w-full rounded-[16px] border border-line bg-raised p-3">
          <p className="mb-2 text-center text-[0.85rem] font-semibold">Which letter is the blank?</p>
          <div className="grid grid-cols-9 gap-1">
            {ALPHABET.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setPlaced([...placed, { cell: blankCell.cell, letter: l, blank: true, rackIdx: blankCell.rackIdx }]);
                  setBlankCell(null);
                }}
                className="h-9 rounded-[8px] bg-sunk text-[0.95rem] font-bold uppercase hover:bg-line"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div data-tour="sa-rack" className="mt-3 flex w-full justify-center gap-1.5">
        {order.map((i) => {
          const l = view.rack[i];
          if (l === undefined) return null;
          const gone = used.has(i) || blankCell?.rackIdx === i;
          const picked = swapping ? swapping.has(i) : selected === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => tapRack(i)}
              disabled={!myTurn || gone}
              aria-pressed={picked}
              aria-label={`${l === "?" ? "Blank tile" : `${l.toUpperCase()}, ${LETTER_VALUES[l]} points`}${gone ? ", on the board" : ""}`}
              className={cn("relative aspect-square w-[min(12.5vw,3.4rem)] rounded-[8px] transition-transform", gone && "opacity-25", picked && "-translate-y-2")}
            >
              <TileFace letter={l === "?" ? "" : l} blank={l === "?"} tone={picked ? "picked" : "set"} big />
            </button>
          );
        })}
        {!view.rack.length ? <span className="text-[0.85rem] text-muted">No tiles left.</span> : null}
      </div>

      {myTurn ? (
        <div data-tour="sa-actions" className="mt-4 flex w-full flex-wrap items-center justify-center gap-2">
          {swapping ? (
            <>
              <Button onClick={() => void sendMove({ kind: "swap", letters: [...swapping].map((i) => view.rack[i]!) })} disabled={pending || !swapping.size}>
                Swap {swapping.size || ""} {swapping.size === 1 ? "tile" : "tiles"}
              </Button>
              <Button variant="ghost" onClick={() => setSwapping(null)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={play} disabled={pending || !preview?.ok}>
                {preview?.ok ? `Play for ${preview.score}` : "Play"}
              </Button>
              {placed.length ? (
                <Button variant="outline" onClick={() => setPlaced([])}>
                  Take back
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setOrder(shuffled(order))}>
                    Shuffle
                  </Button>
                  {view.bagCount >= RACK ? (
                    <Button variant="ghost" onClick={() => setSwapping(new Set())}>
                      Swap
                    </Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => void sendMove({ kind: "pass" })} disabled={pending}>
                    Pass
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      ) : null}

      {view.finish ? (
        <p className="mt-4 text-center text-[0.85rem] text-muted">
          Leftover tiles:{" "}
          {view.players.map((p, i) => (
            <span key={p}>
              {i ? ", " : ""}
              {name(p)} {view.finish![p]! >= 0 ? "+" : ""}
              {view.finish![p]}
            </span>
          ))}
          .
        </p>
      ) : null}

      {view.log.length ? (
        <ol aria-label="Plays so far" className="mt-4 w-full space-y-1 text-[0.82rem] text-muted">
          {[...view.log]
            .reverse()
            .slice(0, 6)
            .map((e) => (
              <li key={e.id}>
                <strong className="font-semibold text-fg">{name(e.by)}</strong> {describe(e)}
              </li>
            ))}
        </ol>
      ) : null}
    </div>
  );
}

function describe(e: LogEntry): string {
  switch (e.kind) {
    case "play": {
      const words = (e.words ?? []).map((w) => `${w.word.toUpperCase()}${w.naija ? " (Naija +5)" : ""}`).join(", ");
      return `played ${words} for ${e.score}${e.sweep ? ", with a clean sweep" : ""}.`;
    }
    case "swap":
      return `swapped ${e.count} ${e.count === 1 ? "tile" : "tiles"}.`;
    case "pass":
      return "passed.";
    case "timeout":
      return "ran out of time.";
  }
}

function shuffled(xs: number[]): number[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function TileFace({ letter, blank, tone, big }: { letter: string; blank: boolean; tone: "set" | "fresh" | "pending" | "picked"; big?: boolean }) {
  const bg = tone === "pending" || tone === "picked" ? "#ffd9a8" : tone === "fresh" ? "#fff3d6" : "#fbf3e6";
  return (
    <span
      aria-hidden
      className={cn("absolute inset-0 flex items-center justify-center rounded-[inherit] border font-bold uppercase text-[#1c1416]", tone === "fresh" ? "border-[#e8563a]" : "border-[rgba(28,20,22,.25)]")}
      style={{ background: bg, boxShadow: "inset 0 -2px 0 rgba(28,20,22,.15)" }}
    >
      <span className={cn(big ? "text-[clamp(1rem,5vw,1.5rem)]" : "text-[clamp(0.6rem,3vw,1rem)]", blank && "text-[#8a6f66]")}>{letter}</span>
      {!blank && letter ? (
        <span className={cn("absolute bottom-[4%] right-[8%] font-semibold leading-none", big ? "text-[0.6rem]" : "text-[clamp(0.32rem,1.4vw,0.5rem)]")}>{LETTER_VALUES[letter]}</span>
      ) : null}
    </span>
  );
}
