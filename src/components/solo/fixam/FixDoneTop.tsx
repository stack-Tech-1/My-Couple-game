"use client";

import { useEffect, useState } from "react";
import { FIX_LAST, type FixLast } from "@/lib/solo/games/fixam";
import type { FixPicture } from "../games/FixAm";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The top of Fix Am's finish: the place you put back together, and how you did it. */
export function FixDoneTop({ picture, n }: { picture: FixPicture; n: number }) {
  const [last, setLast] = useState<FixLast | null>(null);
  useEffect(() => {
    try {
      setLast(JSON.parse(sessionStorage.getItem(FIX_LAST) ?? "null") as FixLast | null);
    } catch {
      // The numbers just don't show.
    }
  }, []);
  return (
    <div className="mb-3">
      <div className="fx-card relative mx-auto max-w-[300px] overflow-hidden rounded-[18px] shadow-[0_12px_24px_-14px_rgba(28,20,22,.6)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo from storage */}
        <img src={picture.url} alt="" className="block h-[150px] w-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(28,20,22,.75))] px-3 pb-2 pt-6 text-left text-[#f6efe6]">
          <span className="block font-display text-[1.15rem] font-black leading-tight">{picture.name}</span>
          <span className="block text-[0.78rem] opacity-90">{picture.place}</span>
        </span>
      </div>
      <p className="display mt-3 text-[1.5rem] leading-tight">Fixed!</p>
      {last ? (
        <p className="mt-0.5 text-[0.92rem] text-muted">
          {n}×{n} in {last.moves} moves, {clock(last.seconds)}
        </p>
      ) : null}
      <style>{`
        .fx-card { animation: fx-card .5s cubic-bezier(.3,1.5,.5,1) both; }
        @keyframes fx-card { from { transform: scale(.85) rotate(-2deg); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .fx-card { animation: none; } }
      `}</style>
    </div>
  );
}
