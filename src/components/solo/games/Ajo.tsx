"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { N, canMove, move, newAjo, noteOf, type AjoState, type Dir } from "@/lib/solo/games/ajo";
import type { SoloApi } from "../SoloShell";

/** Each note's own colour, roughly like the real ones. */
const TONE = ["#d9c7a3", "#e9a77d", "#c9b26a", "#e8a0b0", "#b6a3d6", "#7fb0d8", "#9cc79a", "#e9b13c", "#f2d27a", "#f6c453", "#e8563a", "#c43b2a", "#7a3a6a", "#2a1f4e", "#1c1416"];

export function Ajo({ api }: { api: SoloApi<AjoState> }) {
  const [s, setS] = useState<AjoState>(() => api.saved ?? newAjo(api.seed));
  const [said, setSaid] = useState("");
  const [bump, setBump] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const over = !canMove(s);

  useEffect(() => {
    api.save(s);
    if (over) api.end(s.score, { best: noteOf(s.best), moves: s.moves });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the board changes
  }, [s, over]);

  const go = useCallback(
    (dir: Dir) => {
      if (api.paused || over) return;
      const r = move(api.seed, s, dir);
      if (!r) return;
      setS(r.state);
      setBump((b) => b + 1);
      api.sound(r.merged >= 8 ? "win" : r.merged ? "flip" : "tap");
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

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="text-[0.85rem] font-semibold text-muted">Top note: {s.best ? noteOf(s.best) : "₦5"}</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div
        data-tour="ajo-board"
        role="grid"
        aria-label="Ajo board. Swipe or use the arrow keys to slide the notes."
        tabIndex={0}
        className="mt-3 grid touch-none grid-cols-4 gap-2 rounded-[20px] bg-[#2a1a05] p-2 shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#e8563a]"
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
              const v = s.tiles[r * N + c]!;
              return (
                <div
                  key={`${c}-${v ? bump : 0}`}
                  role="gridcell"
                  aria-label={v ? noteOf(v) : "Empty"}
                  className={cn("flex aspect-square items-center justify-center rounded-[12px] font-extrabold", v ? "border-2 border-[#1c1416] shadow-[inset_0_-3px_0_rgba(0,0,0,.15)]" : "bg-[rgba(255,255,255,.08)]")}
                  style={v ? { background: TONE[v - 1], color: v >= 13 ? "#f6efe6" : "#1c1416", fontSize: noteOf(v).length > 5 ? "1rem" : "1.25rem" } : undefined}
                >
                  {v ? noteOf(v) : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:hidden" aria-hidden>
        {(["left", "up", "down", "right"] as Dir[]).map((d) => (
          <button key={d} type="button" tabIndex={-1} onClick={() => go(d)} className="glass h-11 rounded-full text-[1.1rem] font-bold">
            {d === "left" ? "←" : d === "up" ? "↑" : d === "down" ? "↓" : "→"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted">Swipe to slide every note. Two the same make the next one up. Reach ₦1,000, then keep saving.</p>
    </div>
  );
}
