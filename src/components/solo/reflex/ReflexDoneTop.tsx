"use client";

import { useEffect, useState } from "react";
import { REFLEX_LAST, keeperRank, savesOf, type ReflexLast } from "@/lib/solo/reflex";

function readLast(): ReflexLast | null {
  try {
    return JSON.parse(sessionStorage.getItem(REFLEX_LAST) ?? "null") as ReflexLast | null;
  } catch {
    return null;
  }
}

/** The poster's line: "Super Eagles keeper, 4 of 5 saved". */
export function reflexPoster(score: number): string {
  const last = readLast();
  const rank = keeperRank(score).name;
  return last ? `${rank}, ${savesOf(last.times)} of ${last.times.length} saved` : rank;
}

/**
 * The top of Reflex Training's finish: the keeper holding the ball up for a new best, diving for a
 * good average (under 280 ms), or sitting on the grass after a slow one. Then the rank and saves.
 */
export function ReflexDoneTop({ score, newBest }: { score: number; newBest: boolean }) {
  const [last, setLast] = useState<ReflexLast | null>(null);
  useEffect(() => setLast(readLast()), []);
  const rank = keeperRank(score);
  const pose = newBest ? "keeper-hold" : score < 280 ? "keeper-dive-l" : "keeper-sit";
  return (
    <div className="mb-3">
      <div className="rx-done-pic relative mx-auto h-[180px] max-w-[300px] overflow-hidden rounded-[20px] bg-cover bg-[center_38%]" style={{ backgroundImage: "url(/games/reflex/pitch.webp)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small painted picture, already sized */}
        <img src={`/games/reflex/${pose}.webp`} alt="" className={pose === "keeper-dive-l" ? "absolute left-1/2 top-[28%] w-[78%] -translate-x-1/2" : "absolute bottom-0 left-1/2 h-[92%] w-auto -translate-x-1/2"} />
      </div>
      <p className="display mt-3 text-[1.5rem] leading-tight">{rank.name}</p>
      <p className="mt-0.5 text-[0.92rem] text-muted">{rank.line}</p>
      {last ? (
        <p className="mt-2 text-[0.88rem] font-semibold">
          {savesOf(last.times)} of {last.times.length} saved, fastest {Math.min(...last.times)} ms
        </p>
      ) : null}
      <style>{`
        .rx-done-pic img { animation: rx-done .5s cubic-bezier(.3,1.5,.5,1) both; }
        @keyframes rx-done { from { opacity: 0; margin-bottom: -30px; } to { opacity: 1; margin-bottom: 0; } }
        @media (prefers-reduced-motion: reduce) { .rx-done-pic img { animation: none; } }
      `}</style>
    </div>
  );
}
