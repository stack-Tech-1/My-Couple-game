"use client";

import { useEffect, useState } from "react";
import { AJO_LAST, noteOf, type AjoLast } from "@/lib/solo/games/ajo";

function readLast(): AjoLast | null {
  try {
    return JSON.parse(sessionStorage.getItem(AJO_LAST) ?? "null") as AjoLast | null;
  } catch {
    return null;
  }
}

/** What the finish says, by the top note reached (levels: 8 is ₦1,000, 11 is ₦10k). */
export function ajoLine(best: number): string {
  if (best >= 11) return "Big saver. Your ajo don ripe!";
  if (best >= 8) return "₦1,000 reached. Collect your money!";
  if (best >= 6) return "Small small, the card dey full.";
  return "Your card is almost empty. Save again.";
}

/** The poster's line: "Top note: ₦5k". */
export function ajoPoster(): string | null {
  const last = readLast();
  return last?.best ? `Top note: ${noteOf(last.best)}` : null;
}

/**
 * The top of Ajo's finish, once you reached ₦1,000: the collector hands over a full Ghana-must-go
 * bag for a new best, or counts out notes. Short of ₦1,000 he shakes his head at the card (even on
 * a first game, which is always a new best).
 */
export function AjoDoneTop({ newBest }: { newBest: boolean }) {
  const [last, setLast] = useState<AjoLast | null>(null);
  useEffect(() => setLast(readLast()), []);
  if (!last) return null;
  const pose = last.best >= 8 ? (newBest ? "bag" : "count") : "empty";
  return (
    <div className="mb-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small painted picture, already sized */}
      <img src={`/games/ajo/collector-${pose}.webp`} alt="" className="aj-done mx-auto block h-[180px] w-auto drop-shadow-[0_10px_14px_rgba(28,20,22,.3)]" />
      <p className="display mt-2 text-[1.5rem] leading-tight">Top note: {noteOf(Math.max(1, last.best))}</p>
      <p className="mt-2 text-[0.88rem] font-semibold">{last.moves} moves</p>
      <style>{`
        .aj-done { animation: aj-done .5s cubic-bezier(.3,1.5,.5,1) both; transform-origin: 50% 100%; }
        @keyframes aj-done { from { transform: scale(.6) translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .aj-done { animation: none; } }
      `}</style>
    </div>
  );
}
