"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { canSlide, fixScore, gapOf, newFix, slide, solved, type FixState } from "@/lib/solo/games/fixam";
import type { SoloApi } from "../SoloShell";

export type FixPicture = { id: string; name: string; place: string; note: string; link: string | null; credit: string | null; url: string };
type Saved = FixState & { picture: string };

/** The puzzle itself, for one picture at one size. */
export function FixAm({ api, picture, n }: { api: SoloApi<Saved>; picture: FixPicture; n: number }) {
  const [s, setS] = useState<FixState>(() => (api.saved && api.saved.picture === picture.id && api.saved.n === n ? api.saved : newFix(`${picture.id}:${n}`, n)));
  const [peek, setPeek] = useState(false);
  const [said, setSaid] = useState("");
  const t0 = useRef(performance.now());
  const done = solved(s);

  useEffect(() => {
    api.save({ ...s, picture: picture.id });
    if (done) {
      const secs = Math.round((performance.now() - t0.current) / 1000);
      api.sound("win");
      api.end(fixScore(n, s.moves, secs), { moves: s.moves, picture: picture.name, size: n });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the board changes
  }, [s, done]);

  const go = (i: number) => {
    if (api.paused || done) return;
    const next = slide(s, i);
    if (!next) return;
    setS(next);
    api.sound("tap");
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

  const pct = 100 * n;
  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.moves}</p>
        <p className="text-[0.85rem] font-semibold text-muted">moves</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div className="relative mt-3 rounded-[22px] bg-[#2a1a05] p-2 shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]">
        <div role="grid" aria-label={`${picture.name}, cut into ${n} by ${n} tiles`} className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
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
                    onClick={() => go(i)}
                    aria-label={gap ? "Gap" : `Tile ${v + 1}${canSlide(s, i) ? ", next to the gap" : ""}`}
                    className={cn("aspect-square overflow-hidden rounded-[6px] bg-cover", gap ? "border-2 border-dashed border-white/25 bg-white/5" : "cursor-pointer disabled:cursor-default")}
                    style={gap ? undefined : { backgroundImage: `url(${picture.url})`, backgroundSize: `${pct}% ${pct}%`, backgroundPosition: `${(vc / (n - 1)) * 100}% ${(vr / (n - 1)) * 100}%` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {peek ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo from storage
          <img src={picture.url} alt={picture.name} className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-[14px] object-cover" />
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onKeyDown={(e) => e.key === " " && setPeek(true)}
          onKeyUp={() => setPeek(false)}
          className="glass rounded-full px-5 py-2.5 font-bold"
        >
          Hold to peek
        </button>
        {picture.credit ? <p className="text-right text-[0.72rem] text-muted">{picture.credit}</p> : null}
      </div>
    </div>
  );
}
