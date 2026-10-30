"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COLS, ROWS, newOkada, step, stepMs, turn, type Dir, type OkadaState } from "@/lib/solo/games/okada";
import type { SoloApi } from "../SoloShell";

const RIDER_COLORS = ["#f3c9b7", "#bcd3e6", "#e7d9f2", "#cde3c3", "#f6e0a8", "#ffd8c2"];

function draw(c: CanvasRenderingContext2D, s: OkadaState, cell: number, reduced: boolean) {
  const W = COLS * cell;
  const H = ROWS * cell;
  // Road with lane markings.
  c.fillStyle = "#4a4144";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(242,183,5,.35)";
  for (let x = 2; x < COLS; x += 4) for (let y = 0; y < ROWS; y += 2) c.fillRect(x * cell + cell / 2 - 2, y * cell + 4, 4, cell - 8);
  const xy = (i: number) => [(i % COLS) * cell, Math.floor(i / COLS) * cell] as const;
  const box = (x: number, y: number, w: number, h: number, fill: string, r = 6) => {
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(x + 2, y + 2, w - 4, h - 4, r);
    c.fill();
    c.strokeStyle = "#1c1416";
    c.lineWidth = 2;
    c.stroke();
  };
  // Traffic.
  for (const v of s.traffic) {
    const [x, y] = xy(v.cells[0]!);
    if (v.kind === "danfo") {
      box(x, y, cell * 2, cell, "#f2b705");
      c.fillStyle = "#1c1416";
      c.fillRect(x + 4, y + cell / 2 - 2, cell * 2 - 8, 4);
    } else box(x, y, cell, cell, "#3f8a5c", 8);
  }
  // Passenger waiting, arm up.
  if (s.rider >= 0) {
    const [x, y] = xy(s.rider);
    const pulse = reduced ? 0 : Math.sin(s.steps / 2) * 2;
    c.fillStyle = "#e8563a";
    c.beginPath();
    c.arc(x + cell / 2, y + cell / 2, cell / 2 - 3 + pulse, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fbf7f1";
    c.beginPath();
    c.arc(x + cell / 2, y + cell / 2 - 3, cell / 5, 0, Math.PI * 2);
    c.fill();
  }
  // Riders behind, then the okada.
  s.body.forEach((i, k) => {
    const [x, y] = xy(i);
    if (k === 0) {
      box(x, y, cell, cell, "#e8563a", 7);
      c.fillStyle = "#1c1416";
      c.beginPath();
      c.arc(x + cell / 2, y + cell / 2, cell / 5, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = RIDER_COLORS[k % RIDER_COLORS.length]!;
      c.beginPath();
      c.arc(x + cell / 2, y + cell / 2, cell / 2 - 3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#1c1416";
      c.lineWidth = 2;
      c.stroke();
    }
  });
}

export function OkadaRush({ api }: { api: SoloApi<OkadaState> }) {
  const [s, setS] = useState<OkadaState>(() => api.saved ?? newOkada(api.seed));
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(22);
  const [said, setSaid] = useState("");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCell(Math.floor(Math.min(el.clientWidth / COLS, (window.innerHeight * 0.62) / ROWS))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fixed-timestep loop: steps happen on a steady clock, drawing happens every frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = Math.min(250, t - last);
      last = t;
      const a = apiRef.current;
      if (!a.paused && !state.current.over) {
        acc += dt;
        let moved = false;
        while (acc >= stepMs(state.current)) {
          acc -= stepMs(state.current);
          const r = step(a.seed, state.current);
          state.current = r.state;
          moved = true;
          if (r.picked) {
            a.sound("flip");
            setSaid(`Passenger ${r.state.score} on board.`);
          }
          if (r.state.over) break;
        }
        if (moved) setS(state.current);
      } else acc = 0;
      const ctx = canvas.current?.getContext("2d");
      if (ctx) draw(ctx, state.current, cell, reduced);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cell, reduced]);

  useEffect(() => {
    api.save(s);
    if (s.over && !ended.current) {
      ended.current = true;
      api.sound("lose");
      api.end(s.score, { steps: s.steps });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  const go = useCallback((d: Dir) => {
    state.current = turn(state.current, d);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" } as Record<string, Dir>)[e.key];
      if (d) {
        e.preventDefault();
        go(d);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score}</p>
        <p className="text-[0.85rem] font-semibold text-muted">passengers</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div ref={wrap} data-tour="okada-road" className="mt-3 flex justify-center">
        <canvas
          ref={canvas}
          width={COLS * cell}
          height={ROWS * cell}
          role="img"
          aria-label={`Okada Rush. ${s.score} passengers. Swipe or use the arrow keys to steer.`}
          className="touch-none rounded-[16px] border-[3px] border-[#2a1a05] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
          onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
          onPointerMove={(e) => {
            const t = touch.current;
            if (!t) return;
            const dx = e.clientX - t.x;
            const dy = e.clientY - t.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
            go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
            touch.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => (touch.current = null)}
        />
      </div>
      <div data-tour="okada-keys" className="mx-auto mt-4 grid w-48 grid-cols-3 gap-2">
        <span />
        <button type="button" aria-label="Up" onClick={() => go("up")} className="glass h-12 rounded-[14px] text-[1.2rem] font-bold">↑</button>
        <span />
        <button type="button" aria-label="Left" onClick={() => go("left")} className="glass h-12 rounded-[14px] text-[1.2rem] font-bold">←</button>
        <button type="button" aria-label="Down" onClick={() => go("down")} className="glass h-12 rounded-[14px] text-[1.2rem] font-bold">↓</button>
        <button type="button" aria-label="Right" onClick={() => go("right")} className="glass h-12 rounded-[14px] text-[1.2rem] font-bold">→</button>
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted">Pick up passengers (the red dots). Don&apos;t hit the edge, your passengers, or the danfos and kekes.</p>
    </div>
  );
}
