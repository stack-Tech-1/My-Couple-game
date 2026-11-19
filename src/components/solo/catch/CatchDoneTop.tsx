"use client";

import { useEffect, useState } from "react";
import { CATCH_LAST, type CatchLast } from "@/lib/solo/games/catch";

function readLast(): CatchLast | null {
  try {
    return JSON.parse(sessionStorage.getItem(CATCH_LAST) ?? "null") as CatchLast | null;
  } catch {
    return null;
  }
}

/** What the finish says, by how much went in the basket. */
export function catchLine(caught: number): string {
  if (caught >= 60) return "Mama Put go hire you.";
  if (caught >= 30) return "Sharp hands. The market is talking.";
  if (caught >= 10) return "Not bad. The pepper had other ideas.";
  return "Those peppers are wicked. Go again.";
}

/** The poster's line: "48 caught, 21 in a row". */
export function catchPoster(): string | null {
  const last = readLast();
  if (!last) return null;
  return last.bestCombo >= 3 ? `${last.caught} caught, ${last.bestCombo} in a row` : `${last.caught} caught`;
}

/**
 * The top of Catch Am's finish: the puff-puff seller, grinning over a full basket for a new best,
 * tossing puff-puff for a good game, or fanning her mouth when the pepper won.
 */
export function CatchDoneTop({ newBest }: { newBest: boolean }) {
  const [last, setLast] = useState<CatchLast | null>(null);
  useEffect(() => setLast(readLast()), []);
  if (!last) return null;
  const pose = newBest && last.caught > 0 ? "win" : last.caught >= 30 ? "toss" : "hot";
  return (
    <div className="mb-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small painted picture, already sized */}
      <img src={`/games/catch/seller-${pose}.webp`} alt="" className="ca-done-seller mx-auto block h-[190px] w-auto drop-shadow-[0_10px_14px_rgba(28,20,22,.3)]" />
      <p className="display mt-2 text-[1.5rem] leading-tight">{last.caught} caught</p>
      <p className="mt-0.5 text-[0.92rem] text-muted">{catchLine(last.caught)}</p>
      {last.gold || last.bestCombo >= 3 ? (
        <p className="mt-2 flex justify-center gap-4 text-[0.88rem] font-semibold">
          {last.gold ? <span>{last.gold} golden puff-puff</span> : null}
          {last.bestCombo >= 3 ? <span>Best run: {last.bestCombo} in a row</span> : null}
        </p>
      ) : null}
      <style>{`
        .ca-done-seller { animation: ca-done-seller .5s cubic-bezier(.3,1.5,.5,1) both; transform-origin: 50% 100%; }
        @keyframes ca-done-seller { from { transform: scale(.6) translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .ca-done-seller { animation: none; } }
      `}</style>
    </div>
  );
}
