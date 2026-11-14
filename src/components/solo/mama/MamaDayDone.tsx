"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AREAS, DAYS, ITEM_NAME, areaIndex, careerDay, newOnDay } from "@/lib/solo/games/mama";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const STAR = "M12 2l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 16.8 5.9 20.2l1.5-6.7L2.3 8.9l6.8-.7z";
const LINES = ["Mama says try again. You've got this.", "One star. The customers are warming to you.", "Two stars. Mama is proud of you.", "Three stars! The whole street is talking about your buka."];

/**
 * The end of a career day: stars over a sunburst, what you took in, and the way on. Drawn on
 * the page itself (a portal): inside the frosted result panel, "fixed" would be pinned to the
 * panel instead of the screen.
 */
export function MamaDayDone(props: { day: number; score: number; newBest: boolean; again: () => void; share: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(<DayDone {...props} />, host) : null;
}

function DayDone({ day, score, newBest, again, share }: { day: number; score: number; newBest: boolean; again: () => void; share: () => void }) {
  const cfg = careerDay(day);
  const stars = cfg.stars.filter((x) => score >= x).length;
  const toNext = stars < 3 ? cfg.stars[stars]! - score : 0;
  const next = day + 1;
  const opened = stars >= 1 && next <= DAYS;
  const newArea = opened && areaIndex(next) !== areaIndex(day);
  const dishes = opened ? newOnDay(next) : [];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="solo-result-h" className="fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(180deg,#2a1a10_0%,#4a2412_100%)] text-white">
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col px-4 pb-6 pt-10">
        <div className="relative mx-auto h-[180px] w-full">
          <div aria-hidden className="mp-burst absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="relative flex h-full items-end justify-center gap-1.5 pb-4" role="img" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((k) => (
              <svg key={k} viewBox="0 0 24 24" width={k === 1 ? 104 : 78} height={k === 1 ? 104 : 78} className="mp-star drop-shadow-[0_6px_10px_rgba(0,0,0,.4)]" style={{ transform: k === 0 ? "rotate(-14deg) translateY(10px)" : k === 2 ? "rotate(14deg) translateY(10px)" : undefined, animationDelay: `${0.25 + k * 0.3}s` }}>
                <path d={STAR} fill={k < stars ? "#f6c453" : "rgba(255,255,255,.12)"} stroke={k < stars ? "#b07a0a" : "rgba(255,255,255,.35)"} strokeWidth=".8" />
              </svg>
            ))}
          </div>
        </div>
        <div className="text-center">
          <p className="text-[0.75rem] font-extrabold text-[#f6c453]">
            Day {day} · {AREAS[areaIndex(day)]} · {stars ? "Cleared" : "Not yet"}
          </p>
          <h2 id="solo-result-h" className="display mt-1.5 text-[2.4rem] leading-none">
            {naira(score)}
          </h2>
          <p className="mx-auto mt-2 max-w-[22rem] text-[0.93rem] text-[#f1dccb]">
            {LINES[stars]} {toNext > 0 ? `${naira(toNext)} more for ${stars ? "the next star" : "a star"}.` : ""} {newBest ? "Your best on this day." : ""}
          </p>
        </div>
        {opened ? (
          <div className="mt-6 flex items-center gap-3 rounded-[16px] border-[1.5px] border-[rgba(46,155,87,.6)] bg-[rgba(46,155,87,.18)] px-3.5 py-3 text-[0.88rem]">
            <svg width="30" height="30" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="11" fill="#2e9b57" />
              <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              <b className="block">{newArea ? `${AREAS[areaIndex(next)]} is open!` : `Day ${next} is open`}</b>
              {dishes.length ? `New on the menu: ${dishes.map((x) => ITEM_NAME[x]).join(", ")}.` : newArea ? "A new part of Lagos, a new restaurant to kit out." : "Customers get a little quicker to vex."}
            </span>
          </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          {opened ? (
            <Link prefetch={false} href={`/solo/mama-put?mode=day-${next}`} className="flex h-14 items-center justify-center rounded-full bg-[#f6c453] text-[1.05rem] font-extrabold text-[#2a1a10]">
              Play day {next}
            </Link>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={again} className={`flex h-14 items-center justify-center rounded-full text-[1rem] font-extrabold ${opened ? "bg-white/10" : "col-span-2 bg-[#f6c453] text-[#2a1a10]"}`}>
              {stars === 3 ? "Play again" : stars ? "Try for ★★★" : "Try again"}
            </button>
            <button type="button" onClick={share} className={`flex h-14 items-center justify-center rounded-full bg-white/10 text-[1rem] font-extrabold ${opened ? "" : "col-span-2"}`}>
              Share
            </button>
          </div>
          <Link prefetch={false} href="/solo/mama-put" className="flex h-12 items-center justify-center rounded-full text-[0.95rem] font-bold text-[#f1dccb] underline underline-offset-4">
            Back to the map
          </Link>
        </div>
      </div>
      <style>{`
        .mp-burst { background: repeating-conic-gradient(rgba(246,196,83,.16) 0 10deg, transparent 10deg 20deg); mask: radial-gradient(circle, #000 30%, transparent 70%); animation: mp-spin 40s linear infinite; }
        @keyframes mp-spin { to { rotate: 360deg; } }
        .mp-star { animation: mp-star .55s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes mp-star { from { opacity: 0; scale: .2; } to { opacity: 1; scale: 1; } }
        @media (prefers-reduced-motion: reduce) { .mp-burst, .mp-star { animation: none; } }
      `}</style>
    </div>
  );
}
