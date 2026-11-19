"use client";

import { useEffect, useState } from "react";
import { BLEND_LAST, type BlendLast } from "@/lib/solo/games/blend";

function readLast(): BlendLast | null {
  try {
    return JSON.parse(sessionStorage.getItem(BLEND_LAST) ?? "null") as BlendLast | null;
  } catch {
    return null;
  }
}

/** What the finish says, by how many lines were sewn. */
export function blendLine(lines: number): string {
  if (lines >= 40) return "Master tailor. Owambe ready.";
  if (lines >= 20) return "Fine work. Your customer go happy.";
  if (lines >= 8) return "Neat stitching. Keep sewing.";
  return "The table filled up fast. Try again.";
}

/** The poster's line: "31 lines sewn, 6 in a row". */
export function blendPoster(): string | null {
  const last = readLast();
  if (!last) return null;
  const sewn = `${last.lines} line${last.lines === 1 ? "" : "s"} sewn`;
  return last.bestCombo >= 2 ? `${sewn}, ${last.bestCombo} in a row` : sewn;
}

/**
 * The top of Blend Am's finish: the tailor, holding up a patchwork dress for a new best, measuring
 * for a good game (20 lines or more), or scratching her head when the table filled up early.
 */
export function BlendDoneTop({ newBest }: { newBest: boolean }) {
  const [last, setLast] = useState<BlendLast | null>(null);
  useEffect(() => setLast(readLast()), []);
  if (!last) return null;
  const pose = newBest && last.lines > 0 ? "proud" : last.lines >= 20 ? "measure" : "puzzled";
  return (
    <div className="mb-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small painted picture, already sized */}
      <img src={`/games/blend/tailor-${pose}.webp`} alt="" className="bl-done-tailor mx-auto block h-[190px] w-auto drop-shadow-[0_10px_14px_rgba(28,20,22,.3)]" />
      <p className="display mt-2 text-[1.5rem] leading-tight">
        {last.lines} line{last.lines === 1 ? "" : "s"} sewn
      </p>
      <p className="mt-0.5 text-[0.92rem] text-muted">{blendLine(last.lines)}</p>
      {last.bestCombo >= 2 ? <p className="mt-2 text-[0.88rem] font-semibold">Best run: {last.bestCombo} in a row</p> : null}
      <style>{`
        .bl-done-tailor { animation: bl-done-tailor .5s cubic-bezier(.3,1.5,.5,1) both; transform-origin: 50% 100%; }
        @keyframes bl-done-tailor { from { transform: scale(.6) translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .bl-done-tailor { animation: none; } }
      `}</style>
    </div>
  );
}
