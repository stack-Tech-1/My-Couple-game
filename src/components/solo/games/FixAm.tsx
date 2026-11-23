"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { FIX_LAST, canSlide, fixScore, gapOf, newFix, slide, solved, type FixLast, type FixState } from "@/lib/solo/games/fixam";
import { GameAudio } from "@/lib/game-audio";
import type { SoloApi } from "../SoloShell";
import { Credit } from "../Credit";

export type FixPicture = { id: string; name: string; place: string; note: string; link: string | null; credit: string | null; creditUrl?: string | null; url: string };
type Saved = FixState & { picture: string };
const SOUNDS = ["fx-slide", "fx-lock", "fx-win"];

/** The puzzle itself, for one picture at one size. */
export function FixAm({ api, picture, n }: { api: SoloApi<Saved>; picture: FixPicture; n: number }) {
  const [s, setS] = useState<FixState>(() => (api.saved && api.saved.picture === picture.id && api.saved.n === n ? api.saved : newFix(`${picture.id}:${n}`, n)));
  const [peek, setPeek] = useState(false);
  const [said, setSaid] = useState("");
  const [glint, setGlint] = useState<{ i: number; k: number } | null>(null);
  // A tile under a finger: where the drag started, which way the gap is, and how far it has come.
  const drag = useRef<{ i: number; id: number; x: number; y: number; ax: number; ay: number; size: number; t: number } | null>(null);
  const [pull, setPull] = useState<{ i: number; d: number; ax: number; ay: number } | null>(null);
  const t0 = useRef(performance.now());
  const ended = useRef(false);
  const done = solved(s);

  const audio = useRef<GameAudio | null>(null);
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    try {
      sessionStorage.removeItem(FIX_LAST);
    } catch {
      // Nothing to clear.
    }
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the puzzle
  }, []);

  useEffect(() => {
    api.save({ ...s, picture: picture.id });
    if (done && !ended.current) {
      ended.current = true;
      const secs = Math.round((performance.now() - t0.current) / 1000);
      try {
        sessionStorage.setItem(FIX_LAST, JSON.stringify({ moves: s.moves, seconds: secs } satisfies FixLast));
      } catch {
        // The finish just shows fewer numbers.
      }
      audio.current?.sfx("fx-win", { volume: 0.9 });
      api.end(fixScore(n, s.moves, secs), { moves: s.moves, picture: picture.name, size: n });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the board changes
  }, [s, done]);

  const go = (i: number) => {
    if (api.paused || done) return;
    const next = slide(s, i);
    if (!next) return;
    const g = gapOf(s);
    setS(next);
    audio.current?.wake();
    // A tile that lands in its own place locks in with a click and a glint.
    if (next.tiles[g] === g) {
      audio.current?.sfx("fx-lock", { volume: 0.8, rate: 0.95 + Math.random() * 0.1 });
      setGlint({ i: g, k: next.moves });
      setTimeout(() => setGlint((x) => (x?.k === next.moves ? null : x)), 700);
    } else audio.current?.sfx("fx-slide", { volume: 0.7, rate: 0.92 + Math.random() * 0.16 });
    setSaid(`Moved. ${next.moves} moves.`);
  };

  // Arrow keys move the tile next to the gap into it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gapOf(s);
      const map: Record<string, number> = { ArrowUp: g + n, ArrowDown: g - n, ArrowLeft: g + 1, ArrowRight: g - 1 };
      const i = map[e.key];
      if (i === undefined) return;
      e.preventDefault();
      if (i >= 0 && i < n * n && canSlide(s, i)) go(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Drag a tile into the gap with a finger: it follows along the one way it can go, and lands if
  // it's pulled past a third of the way or flicked. A touch that barely moves is a tap.
  const onDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (api.paused || done || !canSlide(s, i)) return;
    const g = gapOf(s);
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, id: e.pointerId, x: e.clientX, y: e.clientY, ax: (g % n) - (i % n), ay: Math.floor(g / n) - Math.floor(i / n), size: rect.width + 2, t: performance.now() };
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const along = (e.clientX - d.x) * d.ax + (e.clientY - d.y) * d.ay;
    setPull({ i: d.i, d: Math.max(0, Math.min(d.size, along)), ax: d.ax, ay: d.ay });
  };
  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const along = Math.max(0, (e.clientX - d.x) * d.ax + (e.clientY - d.y) * d.ay);
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    const flick = along / Math.max(1, performance.now() - d.t) > 0.5;
    setPull(null);
    if (moved < 8 || along > d.size / 3 || (flick && along > 12)) go(d.i);
  };
  const onCancel = () => {
    drag.current = null;
    setPull(null);
  };

  const pct = 100 * n;
  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.moves}</p>
        <p className="text-[0.85rem] font-semibold text-muted">moves</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div data-tour="fixam-board" className={cn("relative mt-3 overflow-hidden rounded-[22px] bg-[#2a1a05] p-2 shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]", done && "fx-done")}>
        {/* Solved: the seams close up and the photo comes back whole. */}
        <div role="grid" aria-label={`${picture.name}, cut into ${n} by ${n} tiles`} className="grid touch-none transition-[gap] duration-500" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gap: done ? 0 : 2 }}>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="contents">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c;
                const v = s.tiles[i]!;
                const gap = v === n * n - 1 && !done;
                const vr = Math.floor(v / n);
                const vc = v % n;
                return (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    disabled={gap || !canSlide(s, i)}
                    // Keyboards still press; fingers and mice go through the drag.
                    onClick={(e) => e.detail === 0 && go(i)}
                    onPointerDown={onDown(i)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onCancel}
                    aria-label={gap ? "Gap" : `Tile ${v + 1}${canSlide(s, i) ? ", next to the gap" : ""}`}
                    className={cn(
                      "relative aspect-square overflow-hidden bg-cover transition-[border-radius] duration-500",
                      done ? "rounded-none" : "rounded-[6px]",
                      gap ? "border-2 border-dashed border-white/25 bg-white/5" : "cursor-pointer disabled:cursor-default",
                      glint?.i === i && !done && "fx-glint",
                      pull?.i === i ? "z-10 shadow-[0_8px_18px_-6px_rgba(0,0,0,.7)]" : "transition-transform duration-150",
                    )}
                    style={gap ? undefined : { transform: pull?.i === i ? `translate(${pull.ax * pull.d}px, ${pull.ay * pull.d}px)` : undefined, backgroundImage: `url(${picture.url})`, backgroundSize: `${pct}% ${pct}%`, backgroundPosition: `${(vc / (n - 1)) * 100}% ${(vr / (n - 1)) * 100}%` }}
                  >
                    {glint?.i === i && !done ? <span key={glint.k} aria-hidden className="fx-shine absolute inset-0" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {done ? (
          <>
            <span aria-hidden className="fx-sweep pointer-events-none absolute inset-0" />
            <span aria-hidden className="fx-stamp pointer-events-none absolute left-1/2 top-1/2 rounded-[10px] border-[4px] border-[#f6c453] bg-[rgba(28,20,22,.45)] px-4 py-1 font-display text-[2.2rem] font-black text-[#f6c453]">
              Fixed!
            </span>
          </>
        ) : null}
        {peek ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo from storage
          <img src={picture.url} alt={picture.name} className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-[14px] object-cover" />
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          data-tour="fixam-peek"
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onKeyDown={(e) => e.key === " " && setPeek(true)}
          onKeyUp={() => setPeek(false)}
          className="glass rounded-full px-5 py-2.5 font-bold"
        >
          Hold to peek
        </button>
        {picture.credit ? <Credit picture={picture} className="text-right" /> : null}
      </div>
      <style>{`
        .fx-glint { box-shadow: 0 0 0 2px #f6c453, 0 0 14px rgba(246,196,83,.8); transition: box-shadow .6s; }
        .fx-shine { background: linear-gradient(115deg, transparent 30%, rgba(255,246,214,.75) 50%, transparent 70%) no-repeat; background-size: 250% 100%; animation: fx-shine .6s ease-out both; }
        @keyframes fx-shine { from { background-position: 120% 0; } to { background-position: -40% 0; } }
        .fx-sweep { background: linear-gradient(115deg, transparent 35%, rgba(255,246,214,.6) 50%, transparent 65%) no-repeat; background-size: 250% 100%; animation: fx-sweep 1.1s .35s ease-out both; }
        @keyframes fx-sweep { from { background-position: 120% 0; } to { background-position: -40% 0; } }
        .fx-stamp { animation: fx-stamp .55s .5s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes fx-stamp { from { transform: translate(-50%, -50%) rotate(-10deg) scale(2); opacity: 0; } to { transform: translate(-50%, -50%) rotate(-6deg) scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .fx-shine, .fx-sweep { animation: none; display: none; }
          .fx-stamp { animation: none; transform: translate(-50%, -50%) rotate(-6deg); }
        }
      `}</style>
    </div>
  );
}

