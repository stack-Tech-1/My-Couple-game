"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSoloLimits } from "../SoloLimits";
import { LEVELS, STALLS, rankFor, starsOfTakings, stallOf } from "@/lib/solo/games/zobo";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const STAR = "M12 2l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 16.8 5.9 20.2l1.5-6.7L2.3 8.9l6.8-.7z";

type Props = { level: number; score: number; totalBefore: number; totalAfter: number; left: number | null; again: () => void; share: () => void };

/** The end of a level: stars, takings, rank, and the next level. Drawn on the page (a portal), like Okada Rush's. */
export function ZoboLevelDone(props: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(<Done {...props} />, host) : null;
}

function Done({ level, score, totalBefore, totalAfter, left, again, share }: Props) {
  const { plusHref } = useSoloLimits();
  const [pours, setPours] = useState<{ moves: number; par: number } | null>(null);
  useEffect(() => {
    try {
      const last = JSON.parse(sessionStorage.getItem("amah:zobo:last") ?? "null") as { level: number; moves: number; par: number } | null;
      if (last?.level === level) setPours(last);
    } catch {
      // The pours just don't show.
    }
  }, [level]);
  const stars = starsOfTakings(level, score);
  const rank = rankFor(totalAfter);
  const rose = rank.index > rankFor(totalBefore).index;
  const next = level + 1;
  const hasNext = next <= LEVELS;
  const newStall = hasNext && stallOf(next) !== stallOf(level);
  const waiting = left === 0;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="solo-result-h" className="fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(180deg,#2c0816_0%,#5a1230_100%)] text-[#fbeedd]">
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col px-4 pb-6 pt-10">
        <div className="relative mx-auto h-[170px] w-full">
          <div aria-hidden className="zs-burst absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="relative flex h-full items-end justify-center gap-1.5 pb-3" role="img" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((k) => (
              <svg key={k} viewBox="0 0 24 24" width={k === 1 ? 104 : 78} height={k === 1 ? 104 : 78} className="zs-star drop-shadow-[0_6px_10px_rgba(0,0,0,.4)]" style={{ transform: k === 0 ? "rotate(-14deg) translateY(10px)" : k === 2 ? "rotate(14deg) translateY(10px)" : undefined, animationDelay: `${0.2 + k * 0.28}s` }}>
                <path d={STAR} fill={k < stars ? "#f2b632" : "rgba(255,255,255,.12)"} stroke={k < stars ? "#a77a00" : "rgba(255,255,255,.35)"} strokeWidth=".8" />
              </svg>
            ))}
          </div>
        </div>
        <div className="text-center">
          <h2 id="solo-result-h" className="display text-[2.5rem] leading-none">All sorted!</h2>
        </div>
        <dl className="mt-6 grid gap-2 text-[0.95rem]">
          {pours ? (
            <div className="flex justify-between border-b border-white/15 pb-2">
              <dt>Pours</dt>
              <dd className="font-bold tabular-nums">{pours.moves} (target {pours.par})</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-b border-white/15 pb-2">
            <dt>Takings</dt>
            <dd className="font-bold tabular-nums text-[#f2b632]">{naira(score)}</dd>
          </div>
          <div className="flex justify-between border-b border-white/15 pb-2">
            <dt>Rank</dt>
            <dd className="font-bold">{rank.name}{rank.next ? `, ${rank.next.stars - totalAfter} stars to ${rank.next.name}` : ""}</dd>
          </div>
        </dl>
        {rose ? <p className="mt-4 rounded-[16px] bg-[#f2b632] px-4 py-3 text-center font-extrabold text-[#2e1408]">New rank: {rank.name}!</p> : null}
        {newStall && !waiting ? <p className="mt-4 rounded-[16px] border-[1.5px] border-white/30 px-4 py-3 text-center text-[0.92rem]"><b>{STALLS[stallOf(next)]!.name} is open.</b> {STALLS[stallOf(next)]!.about}</p> : null}
        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          {hasNext && waiting ? (
            <div className="rounded-[18px] border-[1.5px] border-white/30 px-4 py-3 text-center">
              <p className="font-bold">Your next free level opens at midnight.</p>
              {plusHref ? <Link prefetch={false} href={plusHref} className="mt-1 inline-block text-[0.92rem] font-bold text-[#f2b632] underline underline-offset-4">Play every level with Amah Plus</Link> : null}
            </div>
          ) : hasNext ? (
            <Link prefetch={false} href={`/solo/zobo-sort?mode=lvl-${next}`} className="flex h-14 items-center justify-center rounded-full bg-[#f2b632] text-[1.05rem] font-extrabold text-[#2e1408]">
              Next level
            </Link>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={again} className="flex h-14 items-center justify-center rounded-full bg-white/10 text-[1rem] font-extrabold">
              {stars === 3 ? "Play again" : "Try for ★★★"}
            </button>
            <button type="button" onClick={share} className="flex h-14 items-center justify-center rounded-full bg-white/10 text-[1rem] font-extrabold">
              Share my rank
            </button>
          </div>
          <Link prefetch={false} href="/solo/zobo-sort" className="flex h-12 items-center justify-center rounded-full text-[0.95rem] font-bold underline underline-offset-4">
            Back to the stalls
          </Link>
        </div>
      </div>
      <style>{`
        .zs-burst { background: repeating-conic-gradient(rgba(242,182,50,.15) 0 10deg, transparent 10deg 20deg); mask: radial-gradient(circle, #000 30%, transparent 70%); animation: zs-spin 40s linear infinite; }
        @keyframes zs-spin { to { rotate: 360deg; } }
        .zs-star { animation: zs-star .55s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes zs-star { from { opacity: 0; scale: .2; } to { opacity: 1; scale: 1; } }
        @media (prefers-reduced-motion: reduce) { .zs-burst, .zs-star { animation: none; } }
      `}</style>
    </div>
  );
}
