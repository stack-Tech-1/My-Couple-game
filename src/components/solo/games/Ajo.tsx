"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AJO_LAST, N, canMove, move, newAjo, noteOf, type AjoLast, type AjoState, type Dir } from "@/lib/solo/games/ajo";
import { GameAudio } from "@/lib/game-audio";
import type { SoloApi } from "../SoloShell";

const ART = "/games/ajo/";
const SOUNDS = ["aj-slide", "aj-merge", "aj-stamp", "aj-top", "aj-lose"];
/** Each level's own colour, under the painting while it loads (and for the top-note chip). */
const TONE = ["#b9a2d8", "#e9a77d", "#9cc79a", "#7fb0d8", "#f2a0b0", "#d9c27a", "#6fb8b0", "#f0c27a", "#e0b25a", "#d9a043", "#c98a2e", "#c0392b", "#b03028", "#9c2a20", "#3a3a3a"];
/** Levels 1 to 8 are notes (the value goes in the oval); from 9 they're bundles of money. */
const isNote = (v: number) => v <= 8;
const STAMP_MS = 750;

function Tile({ v, size }: { v: number; size: number }) {
  const label = noteOf(v);
  if (isNote(v))
    return (
      <span className="relative grid h-full w-full place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a painted note */}
        <img src={`${ART}tile-${v}.webp`} alt="" className="w-[96%] drop-shadow-[0_2px_2px_rgba(42,26,16,.35)]" />
        <span className="absolute font-display font-black tabular text-[#2a1a10]" style={{ fontSize: Math.max(11, size * (label.length > 4 ? 0.17 : 0.21)) }}>
          {label}
        </span>
      </span>
    );
  return (
    <span className="relative grid h-full w-full place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a painted bundle */}
      <img src={`${ART}tile-${v}.webp`} alt="" className="max-h-[84%] max-w-[90%] drop-shadow-[0_3px_3px_rgba(42,26,16,.4)]" />
      <span className="absolute bottom-[2%] rounded-full bg-[#2a1a10] px-1.5 font-display font-black tabular text-[#f6c453]" style={{ fontSize: Math.max(10, size * 0.16) }}>
        {label}
      </span>
    </span>
  );
}

type Fx = { id: number; i: number };

export function Ajo({ api }: { api: SoloApi<AjoState> }) {
  const [s, setS] = useState<AjoState>(() => api.saved ?? newAjo(api.seed));
  const [said, setSaid] = useState("");
  const [stamps, setStamps] = useState<Fx[]>([]);
  const [fresh, setFresh] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [size, setSize] = useState(80);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fxId = useRef(1);
  const ended = useRef(false);
  const over = !canMove(s);

  const audio = useRef<GameAudio | null>(null);
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    try {
      sessionStorage.removeItem(AJO_LAST);
    } catch {
      // Nothing to clear.
    }
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the game
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.getBoundingClientRect().width / N));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    api.save(s);
    if (over && !ended.current) {
      ended.current = true;
      try {
        sessionStorage.setItem(AJO_LAST, JSON.stringify({ best: s.best, moves: s.moves } satisfies AjoLast));
      } catch {
        // The finish just shows fewer numbers.
      }
      audio.current?.sfx("aj-lose", { volume: 0.8 });
      api.end(s.score, { best: noteOf(s.best), moves: s.moves });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the board changes
  }, [s, over]);

  const go = useCallback(
    (dir: Dir) => {
      if (api.paused || over) return;
      const r = move(api.seed, s, dir);
      if (!r) return;
      const au = audio.current;
      au?.wake();
      setS(r.state);
      au?.sfx("aj-slide", { volume: 0.6, rate: 0.95 + Math.random() * 0.1 });
      setFresh(r.spawnedAt);
      if (r.mergedAt.length) {
        // A PAID stamp on every merge, and a snap of cash, higher for bigger notes.
        const marks: Fx[] = r.mergedAt.map((i) => ({ id: fxId.current++, i }));
        setStamps((l) => [...l, ...marks]);
        setTimeout(() => setStamps((l) => l.filter((m) => !marks.includes(m))), STAMP_MS);
        au?.sfx("aj-merge", { volume: 0.85, rate: 0.9 + Math.min(14, r.merged) * 0.03 });
        setTimeout(() => au?.sfx("aj-stamp", { volume: 0.7 }), 90);
      }
      // A new top note: ka-ching, and its value across the card.
      if (r.merged > s.best) {
        const id = fxId.current++;
        setToast({ id, text: `${noteOf(r.merged)}!` });
        setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1300);
        if (r.merged >= 4) setTimeout(() => au?.sfx("aj-top", { volume: 0.85 }), 140);
      }
      if (r.merged >= 8 && !s.won) setSaid("₦1,000 note! Keep going.");
      else setSaid(r.merged ? `Merged into ${noteOf(r.merged)}. ${r.points} points.` : "Moved.");
    },
    [api, s, over],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" } as Record<string, Dir>)[e.key];
      if (dir) {
        e.preventDefault();
        go(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const merging = new Set(stamps.map((m) => m.i));

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="flex items-center gap-1.5 text-[0.85rem] font-semibold text-muted">
          Top:
          <span key={s.best} className={cn("aj-chip rounded-full px-2 py-0.5 font-extrabold", s.best >= 12 ? "text-[#fff6e8]" : "text-[#2a1a10]")} style={{ background: TONE[Math.max(0, (s.best || 1) - 1)] }}>
            {s.best ? noteOf(s.best) : "₦5"}
          </span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div
        ref={boardRef}
        data-tour="ajo-board"
        role="grid"
        aria-label="Ajo board. Swipe or use the arrow keys to slide the notes."
        tabIndex={0}
        className="relative mt-3 grid touch-none grid-cols-4 gap-2 rounded-[18px] bg-[#f2a7b5] bg-cover p-3 shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#e8563a]"
        style={{ backgroundImage: `url(${ART}card.webp)` }}
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.clientX - t.x;
          const dy = e.clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}
      >
        {Array.from({ length: N }, (_, r) => (
          <div key={r} role="row" className="contents">
            {Array.from({ length: N }, (_, c) => {
              const i = r * N + c;
              const v = s.tiles[i]!;
              return (
                <div
                  key={`${c}-${v}-${merging.has(i) ? "m" : ""}${fresh === i ? "f" : ""}`}
                  role="gridcell"
                  aria-label={v ? noteOf(v) : "Empty"}
                  className={cn("relative aspect-square rounded-[10px]", !v && "border-[1.5px] border-dashed border-[rgba(179,38,30,.35)] bg-[rgba(255,255,255,.18)]", merging.has(i) && "aj-merge", fresh === i && "aj-in")}
                >
                  {v ? <Tile v={v} size={size} /> : null}
                  {stamps
                    .filter((m) => m.i === i)
                    .map((m) => (
                      <span key={m.id} aria-hidden className="aj-stamp pointer-events-none absolute left-1/2 top-1/2 z-10 rounded-[6px] border-[3px] border-[#b3261e] px-1.5 font-display font-black text-[#b3261e]" style={{ fontSize: Math.max(10, size * 0.17) }}>
                        PAID
                      </span>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
        {toast ? (
          <span key={toast.id} aria-hidden className="aj-toast pointer-events-none absolute inset-x-0 top-[40%] z-20 text-center font-display text-[2.4rem] font-black text-[#fff6d6]" style={{ WebkitTextStroke: "1.6px #2a1a10" }}>
            {toast.text}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:hidden" aria-hidden>
        {(["left", "up", "down", "right"] as Dir[]).map((d) => (
          <button key={d} type="button" tabIndex={-1} onClick={() => go(d)} className="glass h-11 rounded-full text-[1.1rem] font-bold">
            {d === "left" ? "←" : d === "up" ? "↑" : d === "down" ? "↓" : "→"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted">Swipe to slide every note. Two the same make the next one up. Reach ₦1,000, then keep saving.</p>
      <style>{`
        .aj-merge { animation: aj-merge .28s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes aj-merge { from { transform: scale(1.22); } to { transform: scale(1); } }
        .aj-in { animation: aj-in .22s ease-out both; }
        @keyframes aj-in { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .aj-stamp { animation: aj-stamp ${STAMP_MS}ms ease-out both; }
        @keyframes aj-stamp { 0% { transform: translate(-50%, -50%) rotate(-14deg) scale(1.9); opacity: 0; } 18% { transform: translate(-50%, -50%) rotate(-14deg) scale(1); opacity: .95; } 70% { opacity: .9; } 100% { transform: translate(-50%, -50%) rotate(-14deg) scale(1); opacity: 0; } }
        .aj-toast { animation: aj-toast 1.3s ease-out both; }
        @keyframes aj-toast { from { transform: scale(.5); opacity: 0; } 15% { transform: scale(1.1); opacity: 1; } 70% { opacity: 1; } to { transform: translateY(-30px); opacity: 0; } }
        .aj-chip { animation: aj-chip .35s cubic-bezier(.3,1.7,.5,1) both; }
        @keyframes aj-chip { from { transform: scale(.5); } to { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .aj-merge, .aj-in, .aj-chip { animation: none; }
          .aj-stamp { animation: aj-fade ${STAMP_MS}ms ease-out both; transform: translate(-50%, -50%) rotate(-14deg); }
          .aj-toast { animation: aj-fade 1.3s ease-out both; }
          @keyframes aj-fade { from, 70% { opacity: 1; } to { opacity: 0; } }
        }
      `}</style>
    </div>
  );
}
