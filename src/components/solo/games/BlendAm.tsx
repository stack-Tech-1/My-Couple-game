"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { BLEND_LAST, COLORS, SIZE, fits, fullLines, isOver, newBlend, place, type BlendLast, type BlendState, type Piece } from "@/lib/solo/games/blend";
import { GameAudio } from "@/lib/game-audio";
import type { SoloApi } from "../SoloShell";

const LIFT = 64; // how far above the finger a dragged piece floats, so you can see it
const ART = "/games/blend/";
const SOUNDS = ["bl-pick", "bl-place", "bl-sew", "bl-combo", "bl-snip", "bl-lose"];
/** The board's frame: border and padding (px), and the gap between squares. */
const FRAME = 3;
const PAD = 6;
const GAP = 2;
const SEW_MS = 1150;

/** A patch of the fabric for piece colour `color`, with the plain colour underneath while it loads. */
const fabric = (color: number): CSSProperties => ({ backgroundColor: COLORS[color], backgroundImage: `url(${ART}fabric-${color}.webp)`, backgroundSize: "cover" });

function bounds(p: Piece) {
  return { rows: Math.max(...p.cells.map((c) => c[0])) + 1, cols: Math.max(...p.cells.map((c) => c[1])) + 1 };
}

function PieceShape({ piece, cell, faded }: { piece: Piece; cell: number; faded?: boolean }) {
  const b = bounds(piece);
  return (
    <span aria-hidden className="relative block" style={{ width: b.cols * cell, height: b.rows * cell, opacity: faded ? 0.35 : 1 }}>
      {piece.cells.map(([r, c], i) => (
        <span key={i} className="absolute rounded-[4px] shadow-[0_2px_3px_rgba(28,20,22,.3)]" style={{ left: c * cell, top: r * cell, width: cell - 2, height: cell - 2, ...fabric(piece.color) }} />
      ))}
    </span>
  );
}

/** A full line being sewn up and lifted away: which line, and the fabrics that were in it. */
type Sew = { id: number; row: boolean; index: number; colors: number[] };
type Pop = { id: number; x: number; y: number; text: string; big?: boolean };

export function BlendAm({ api }: { api: SoloApi<BlendState> }) {
  const [s, setS] = useState<BlendState>(() => api.saved ?? newBlend(api.seed));
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [drag, setDrag] = useState<{ slot: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const [sews, setSews] = useState<Sew[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [fresh, setFresh] = useState<number[]>([]);
  const [said, setSaid] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const ignoreClick = useRef(false);
  const fxId = useRef(1);
  const bestCombo = useRef(s.combo);
  const ended = useRef(false);
  const [size, setSize] = useState(360);
  const over = useMemo(() => isOver(s), [s]);
  // One square's size, and where square j starts, inside the board's padding box.
  const sq = (size - 2 * FRAME - 2 * PAD - (SIZE - 1) * GAP) / SIZE;
  const at = (j: number) => PAD + j * (sq + GAP);
  const cell = sq + GAP;

  const audio = useRef<GameAudio | null>(null);
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    try {
      sessionStorage.removeItem(BLEND_LAST);
    } catch {
      // Nothing to clear.
    }
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the game
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    api.save(s);
    if (over && !ended.current) {
      ended.current = true;
      try {
        sessionStorage.setItem(BLEND_LAST, JSON.stringify({ lines: s.lines, bestCombo: bestCombo.current } satisfies BlendLast));
      } catch {
        // The finish just shows fewer numbers.
      }
      // The table is full: a snip of the scissors, then the finish.
      audio.current?.sfx("bl-snip", { volume: 0.9 });
      setTimeout(() => audio.current?.sfx("bl-lose", { volume: 0.8 }), 260);
      api.end(s.score, { lines: s.lines, placed: s.placed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the board changes
  }, [s, over]);

  const pop = (x: number, y: number, text: string, big = false) => {
    const id = fxId.current++;
    setPops((l) => [...l, { id, x, y, text, big }]);
    setTimeout(() => setPops((l) => l.filter((p) => p.id !== id)), 1000);
  };

  const tryPlace = (slot: number, r: number, c: number) => {
    if (api.paused) return false;
    const piece = s.tray[slot];
    const res = place(api.seed, s, slot, r, c);
    if (!res || !piece) return false;
    // Which lines fill, and with what fabrics, read before they're cleared.
    const board = [...s.board];
    const cells = piece.cells.map(([dr, dc]) => (r + dr) * SIZE + (c + dc));
    for (const i of cells) board[i] = piece.color + 1;
    const full = fullLines(board);
    setS(res.state);
    setSelected(null);
    setHover(null);
    const au = audio.current;
    au?.sfx("bl-place", { volume: 0.85, rate: 0.95 + Math.random() * 0.1 });
    setFresh(cells);
    setTimeout(() => setFresh([]), 320);
    if (res.cleared) {
      bestCombo.current = Math.max(bestCombo.current, res.state.combo);
      const lines: Sew[] = [
        ...full.rows.map((i) => ({ id: fxId.current++, row: true, index: i, colors: Array.from({ length: SIZE }, (_, j) => board[i * SIZE + j]! - 1) })),
        ...full.cols.map((i) => ({ id: fxId.current++, row: false, index: i, colors: Array.from({ length: SIZE }, (_, j) => board[j * SIZE + i]! - 1) })),
      ];
      setSews((l) => [...l, ...lines]);
      setTimeout(() => setSews((l) => l.filter((x) => !lines.includes(x))), SEW_MS);
      au?.sfx("bl-sew", { volume: 0.9, rate: 1 + Math.min(6, res.state.combo - 1) * 0.06 });
      if (res.state.combo > 1) setTimeout(() => au?.sfx("bl-combo", { volume: 0.8, rate: 1 + Math.min(6, res.state.combo - 2) * 0.1 }), 180);
      const first = lines[0]!;
      const mid = at(SIZE / 2) - GAP / 2;
      pop(first.row ? mid : at(first.index) + sq / 2, first.row ? at(first.index) : mid, `+${res.points}`, true);
      if (res.cleared > 1) pop(mid, mid + 34, `${res.cleared} lines!`, true);
      setSaid(`${res.cleared} line${res.cleared > 1 ? "s" : ""} sewn, ${res.points} points${res.state.combo > 1 ? `, ${res.state.combo} in a row` : ""}.`);
    } else {
      const b = bounds(piece);
      pop(at(c) + (b.cols * cell) / 2, at(r), `+${res.points}`);
      setSaid(`Placed. ${res.points} points.`);
    }
    return true;
  };

  // Where would the dragged piece's top-left land?
  const dropCell = (x: number, y: number, slot: number, dx: number, dy: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || !s.tray[slot]) return null;
    const left = x - dx - rect.left - FRAME - PAD;
    const top = y - dy - LIFT - rect.top - FRAME - PAD;
    return { r: Math.round(top / cell), c: Math.round(left / cell) };
  };

  const onDown = (slot: number) => (e: RPointerEvent) => {
    if (!s.tray[slot] || api.paused) return;
    audio.current?.wake();
    const target = e.currentTarget.getBoundingClientRect();
    const piece = s.tray[slot]!;
    const b = bounds(piece);
    // Grab point within the piece, scaled from tray size to board size.
    const scale = cell / 22;
    const inner = { left: target.left + (target.width - b.cols * 22) / 2, top: target.top + (target.height - b.rows * 22) / 2 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ slot, x: e.clientX, y: e.clientY, dx: (e.clientX - inner.left) * scale, dy: (e.clientY - inner.top) * scale });
  };
  // A press only becomes a drag once the finger moves; a plain tap selects the piece instead.
  const dragged = (e: RPointerEvent) => Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6;
  const onMove = (e: RPointerEvent) => {
    if (!drag || !dragged(e)) return;
    if (!hover) audio.current?.sfx("bl-pick", { volume: 0.6 });
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    setHover(dropCell(e.clientX, e.clientY, drag.slot, drag.dx, drag.dy));
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!dragged(e)) return;
    ignoreClick.current = true;
    const spot = dropCell(e.clientX, e.clientY, d.slot, d.dx, d.dy);
    if (spot && tryPlace(d.slot, spot.r, spot.c)) return;
    setHover(null);
  };

  const preview = (() => {
    const slot = drag?.slot ?? selected;
    const p = slot != null ? s.tray[slot] : null;
    if (!p || !hover) return null;
    const ok = fits(s.board, p, hover.r, hover.c);
    return { cells: new Set(p.cells.map(([dr, dc]) => (hover.r + dr) * SIZE + hover.c + dc)), ok, color: p.color };
  })();

  return (
    <div className="mx-auto max-w-[420px] select-none" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        {s.combo > 1 ? (
          <span key={s.combo} className="bl-chip rounded-full bg-[#23396e] px-3 py-1 text-[0.85rem] font-extrabold text-white">
            {s.combo} in a row
          </span>
        ) : (
          <p className="text-[0.85rem] font-semibold text-muted">{s.lines} lines sewn</p>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>

      <div className="relative mt-3">
        <div
          ref={boardRef}
          data-tour="blend-board"
          role="grid"
          aria-label="Blend Am board, 8 by 8"
          className="relative grid touch-none grid-cols-8 rounded-[16px] shadow-[0_20px_40px_-24px_rgba(28,20,22,.85)]"
          style={{ gap: GAP, padding: PAD, border: `${FRAME}px solid #6e4524`, backgroundColor: "#b27a46", backgroundImage: `url(${ART}table.webp)`, backgroundSize: "cover" }}
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
                    className={cn("aspect-square rounded-[4px]", v ? "shadow-[0_2px_3px_rgba(28,20,22,.35)]" : "shadow-[inset_0_0_0_1px_rgba(255,248,232,.42)]", fresh.includes(i) && "bl-settle")}
                    style={v ? fabric(v - 1) : pv ? (preview!.ok ? { ...fabric(preview!.color), opacity: 0.5 } : { background: "rgba(192,54,28,.45)" }) : undefined}
                  />
                );
              })}
            </div>
          ))}

          {/* Full lines: a stitch runs along, the machine with it, then the strip lifts away. */}
          {sews.map((w) => (
            <div
              key={w.id}
              aria-hidden
              className="pointer-events-none absolute z-10"
              style={w.row ? { left: PAD, top: at(w.index), width: SIZE * cell - GAP, height: sq } : { left: at(w.index), top: PAD, width: sq, height: SIZE * cell - GAP }}
            >
              <div className={cn("bl-strip absolute inset-0 flex", !w.row && "flex-col")} style={{ gap: GAP }}>
                {w.colors.map((c, j) => (
                  <span key={j} className="shrink-0 rounded-[4px]" style={{ width: sq, height: sq, ...fabric(c) }} />
                ))}
                <span className={cn("bl-stitch absolute", w.row ? "inset-x-0 top-1/2 border-t-[3px]" : "inset-y-0 left-1/2 border-l-[3px]")} style={{ borderStyle: "dashed", borderColor: "#fff" }} />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- a small painted picture */}
              <img src={`${ART}machine.webp`} alt="" className={w.row ? "bl-machine-x absolute" : "bl-machine-y absolute"} style={{ width: sq * 1.9, ...(w.row ? { top: -sq * 0.55 } : { left: -sq * 0.45 }) }} />
            </div>
          ))}

          {pops.map((p) => (
            <span key={p.id} aria-hidden className={cn("bl-pop pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap font-display font-black text-[#fff6d6]", p.big ? "text-[1.7rem]" : "text-[1.15rem]")} style={{ left: p.x, top: p.y, WebkitTextStroke: "1.4px #24170f" }}>
              {p.text}
            </span>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small painted picture */}
        <img src={`${ART}pins.webp`} alt="" aria-hidden className="pointer-events-none absolute -bottom-5 -right-3 z-20 w-[50px] rotate-[8deg] drop-shadow-[0_4px_4px_rgba(28,20,22,.35)]" />
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
              audio.current?.wake();
              if (selected !== slot) audio.current?.sfx("bl-pick", { volume: 0.6 });
              setSelected(selected === slot ? null : slot);
            }}
            className={cn("bl-tray flex h-28 touch-none items-center justify-center rounded-[16px] border-[1.5px]", selected === slot ? "border-[#1c1416] bg-raised" : "border-line bg-[rgba(255,250,244,.6)]")}
          >
            {p ? <PieceShape piece={p} cell={22} faded={drag?.slot === slot} /> : null}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted">Drag a patch onto the table, or tap it and then tap where it goes. Fill a row or column to sew it up.</p>

      {drag && hover && s.tray[drag.slot] ? (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy - LIFT }}>
          <PieceShape piece={s.tray[drag.slot]!} cell={cell} />
        </div>
      ) : null}

      <style>{`
        .bl-settle { animation: bl-settle .3s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes bl-settle { from { transform: scale(1.18); } to { transform: scale(1); } }
        .bl-stitch { transform-origin: 0 0; animation: bl-stitch .42s linear both; }
        @keyframes bl-stitch { from { clip-path: inset(0 100% 100% 0); } to { clip-path: inset(0 0 0 0); } }
        .bl-strip { animation: bl-strip ${SEW_MS}ms ease-in both; }
        @keyframes bl-strip { 0%, 42% { transform: none; opacity: 1; } 100% { transform: translateY(-46px) rotate(-3deg) scale(.96); opacity: 0; } }
        .bl-machine-x { left: 0; animation: bl-machine-x .45s linear both; }
        @keyframes bl-machine-x { from { left: -10%; opacity: 1; } 85% { opacity: 1; } to { left: 92%; opacity: 0; } }
        .bl-machine-y { top: 0; animation: bl-machine-y .45s linear both; }
        @keyframes bl-machine-y { from { top: -10%; opacity: 1; } 85% { opacity: 1; } to { top: 92%; opacity: 0; } }
        .bl-pop { animation: bl-pop 1s ease-out both; }
        @keyframes bl-pop { from { transform: translate(-50%, 4px) scale(.7); opacity: 0; } 15% { transform: translate(-50%, 0) scale(1.08); opacity: 1; } 70% { opacity: 1; } to { transform: translate(-50%, -34px) scale(1); opacity: 0; } }
        .bl-chip { animation: bl-chip .35s cubic-bezier(.3,1.7,.5,1) both; }
        @keyframes bl-chip { from { transform: scale(.5); } to { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .bl-settle, .bl-chip, .bl-machine-x, .bl-machine-y { animation: none; }
          .bl-machine-x, .bl-machine-y { display: none; }
          .bl-strip { animation: bl-fade ${SEW_MS}ms ease-in both; }
          @keyframes bl-fade { 0%, 40% { opacity: 1; } 100% { opacity: 0; } }
        }
      `}</style>
    </div>
  );
}
