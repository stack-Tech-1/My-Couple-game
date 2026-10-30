"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { COLORS, SIZE, fits, isOver, newBlend, place, type BlendState, type Piece } from "@/lib/solo/games/blend";
import type { SoloApi } from "../SoloShell";

const LIFT = 64; // how far above the finger a dragged piece floats, so you can see it

function bounds(p: Piece) {
  return { rows: Math.max(...p.cells.map((c) => c[0])) + 1, cols: Math.max(...p.cells.map((c) => c[1])) + 1 };
}

function PieceShape({ piece, cell, faded }: { piece: Piece; cell: number; faded?: boolean }) {
  const b = bounds(piece);
  return (
    <span aria-hidden className="relative block" style={{ width: b.cols * cell, height: b.rows * cell, opacity: faded ? 0.35 : 1 }}>
      {piece.cells.map(([r, c], i) => (
        <span key={i} className="absolute rounded-[5px] border-2 border-[#1c1416]" style={{ left: c * cell, top: r * cell, width: cell - 2, height: cell - 2, background: COLORS[piece.color] }} />
      ))}
    </span>
  );
}

export function BlendAm({ api }: { api: SoloApi<BlendState> }) {
  const [s, setS] = useState<BlendState>(() => api.saved ?? newBlend(api.seed));
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [drag, setDrag] = useState<{ slot: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const [flash, setFlash] = useState<number[]>([]);
  const [said, setSaid] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const ignoreClick = useRef(false);
  const [cell, setCell] = useState(40);
  const over = useMemo(() => isOver(s), [s]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCell(el.getBoundingClientRect().width / SIZE));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    api.save(s);
    if (over) api.end(s.score, { lines: s.lines, placed: s.placed });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the board changes
  }, [s, over]);

  const tryPlace = (slot: number, r: number, c: number) => {
    if (api.paused) return false;
    const res = place(api.seed, s, slot, r, c);
    if (!res) return false;
    setS(res.state);
    setSelected(null);
    setHover(null);
    api.sound(res.cleared ? "win" : "drop");
    if (res.cleared) {
      setFlash(res.clearedCells);
      setTimeout(() => setFlash([]), 380);
      setSaid(`${res.cleared} line${res.cleared > 1 ? "s" : ""} cleared, ${res.points} points${res.state.combo > 1 ? `, ${res.state.combo} in a row` : ""}.`);
    } else setSaid(`Placed. ${res.points} points.`);
    return true;
  };

  // Where would the dragged piece's top-left land?
  const dropCell = (x: number, y: number, slot: number, dx: number, dy: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || !s.tray[slot]) return null;
    const left = x - dx - rect.left;
    const top = y - dy - LIFT - rect.top;
    return { r: Math.round(top / cell), c: Math.round(left / cell) };
  };

  const onDown = (slot: number) => (e: RPointerEvent) => {
    if (!s.tray[slot] || api.paused) return;
    const target = e.currentTarget.getBoundingClientRect();
    // Grab point within the piece, scaled from tray size to board size.
    const scale = cell / 22;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ slot, x: e.clientX, y: e.clientY, dx: (e.clientX - target.left) * scale, dy: (e.clientY - target.top) * scale });
  };
  // A press only becomes a drag once the finger moves; a plain tap selects the piece instead.
  const dragged = (e: RPointerEvent) => Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6;
  const onMove = (e: RPointerEvent) => {
    if (!drag || !dragged(e)) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    setHover(dropCell(e.clientX, e.clientY, drag.slot, drag.dx, drag.dy));
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!dragged(e)) return;
    ignoreClick.current = true;
    const at = dropCell(e.clientX, e.clientY, d.slot, d.dx, d.dy);
    if (at && tryPlace(d.slot, at.r, at.c)) return;
    setHover(null);
  };

  const preview = (() => {
    const slot = drag?.slot ?? selected;
    const p = slot != null ? s.tray[slot] : null;
    if (!p || !hover) return null;
    const ok = fits(s.board, p, hover.r, hover.c);
    return { cells: new Set(p.cells.map(([dr, dc]) => (hover.r + dr) * SIZE + hover.c + dc)), ok, color: COLORS[p.color]! };
  })();

  return (
    <div className="mx-auto max-w-[420px] select-none" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="text-[0.85rem] font-semibold text-muted">{s.combo > 1 ? `${s.combo} in a row` : `${s.lines} lines`}</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>

      <div
        ref={boardRef}
        data-tour="blend-board"
        role="grid"
        aria-label="Blend Am board, 8 by 8"
        className="mt-3 grid touch-none grid-cols-8 gap-[2px] rounded-[18px] bg-[#2a1a05] p-[6px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
      >
        {Array.from({ length: SIZE }, (_, r) => (
          <div key={r} role="row" className="contents">
            {Array.from({ length: SIZE }, (_, c) => {
              const i = r * SIZE + c;
              const v = s.board[i]!;
              const pv = preview?.cells.has(i);
              return (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  aria-label={`Row ${r + 1}, column ${c + 1}${v ? ", filled" : ""}`}
                  onClick={() => selected != null && tryPlace(selected, r, c)}
                  onPointerEnter={() => selected != null && !drag && setHover({ r, c })}
                  className={cn("aspect-square rounded-[5px] transition-colors", v ? "border-2 border-[#1c1416]" : "bg-[rgba(255,255,255,.08)]", flash.includes(i) && "animate-pulse bg-[#f6d26a]")}
                  style={{
                    background: flash.includes(i) ? "#f6d26a" : v ? COLORS[v - 1] : pv ? (preview!.ok ? `${preview!.color}99` : "rgba(232,86,58,.35)") : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div data-tour="blend-tray" role="group" aria-label="Pieces to place" className="mt-5 grid grid-cols-3 gap-2">
        {s.tray.map((p, slot) => (
          <button
            key={p?.id ?? `empty-${slot}`}
            type="button"
            disabled={!p}
            aria-pressed={selected === slot}
            aria-label={p ? `Piece of ${p.cells.length} square${p.cells.length > 1 ? "s" : ""}${selected === slot ? ", selected. Tap a square on the board to place it" : ""}` : "Used"}
            onPointerDown={onDown(slot)}
            onClick={() => {
              if (ignoreClick.current) {
                ignoreClick.current = false;
                return;
              }
              setSelected(selected === slot ? null : slot);
            }}
            className={cn("flex h-28 touch-none items-center justify-center rounded-[16px] border-[1.5px]", selected === slot ? "border-[#1c1416] bg-raised" : "border-line bg-[rgba(255,250,244,.6)]")}
          >
            {p ? <PieceShape piece={p} cell={22} faded={drag?.slot === slot} /> : null}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted">Drag a piece onto the board, or tap it and then tap where it goes. Fill a row or column to clear it.</p>

      {drag && hover && s.tray[drag.slot] ? (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy - LIFT }}>
          <PieceShape piece={s.tray[drag.slot]!} cell={cell} />
        </div>
      ) : null}
    </div>
  );
}
