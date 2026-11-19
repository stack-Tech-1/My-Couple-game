"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SITES, WALLS, rankFor, siteOf, starsOfTakings, wallPay } from "@/lib/solo/games/bashwall";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const STAR = "M12 2l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 16.8 5.9 20.2l1.5-6.7L2.3 8.9l6.8-.7z";
const LINES = ["", "It fell, but it fought back.", "Good job. One clean run from three stars.", "Not one ball dropped. Clean job."];

type Props = { wall: number; score: number; totalBefore: number; totalAfter: number; again: () => void; share: () => void };

/** The end of a wall: a new building rises if you cleared it. */
export function BashWallDone(props: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(<Done {...props} />, host) : null;
}

function Done({ wall, score, totalBefore, totalAfter, again, share }: Props) {
  const [last, setLast] = useState<{ wall: number; dropped: number; broken: number } | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem("amah:bash:last") ?? "null") as { wall: number; dropped: number; broken: number } | null;
      if (v?.wall === wall) setLast(v);
    } catch {
      // The counts just don't show.
    }
  }, [wall]);
  const won = score > 0;
  const stars = starsOfTakings(wall, score);
  const rank = rankFor(totalAfter);
  const rose = rank.index > rankFor(totalBefore).index;
  const next = wall + 1;
  const hasNext = won && next <= WALLS;
  const newSite = hasNext && siteOf(next) !== siteOf(wall);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="solo-result-h" className={won ? "fixed inset-0 z-[90] overflow-y-auto bg-[#fbf4ea] text-[#1c1416]" : "fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(180deg,#2a1a14_0%,#5a2a18_100%)] text-[#f8f0e4]"}>
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col px-4 pb-6">
        {won ? (
          <svg viewBox="0 0 326 150" aria-hidden className="-mx-4 block h-auto w-[calc(100%+2rem)] max-w-none">
            <rect width="326" height="150" fill="#f4a65e" />
            <circle cx="72" cy="52" r="26" fill="#fff0c2" />
            <path d="M0 150V116l40-8 44 10 50-14 56 12 56-10 80 10v34z" fill="#c9764a" />
            <g className="ba-rise">
              <rect x="124" y="46" width="84" height="94" fill="#d8cfc2" />
              <g fill="#3f7a8f">
                {[58, 84, 110].flatMap((y) => [134, 158, 182].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="18" height="18" />))}
              </g>
            </g>
            <path d="M112 140V34M220 140V34M112 58h108M112 92h108" stroke="#1c1416" strokeWidth="3" fill="none" />
            <path d="M262 140V22h-70" stroke="#f6c453" strokeWidth="6" fill="none" />
            <rect y="138" width="326" height="12" fill="#6d5a4d" />
          </svg>
        ) : <div className="h-14" />}
        <div className="mt-4 text-center">
          <h2 id="solo-result-h" className="display text-[2.5rem] leading-none">{won ? "Wall don fall!" : "The wall won this one"}</h2>
          <p className="mx-auto mt-2 max-w-[22rem] text-[0.95rem]">{won ? `Wall ${wall} cleared. ${LINES[stars]}` : `You ran out of balls on wall ${wall}. Pick up your plank and try again.`}</p>
        </div>
        {won ? (
          <div className="mt-3 flex justify-center gap-1" role="img" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((k) => (
              <svg key={k} viewBox="0 0 24 24" width="52" height="52" className="ba-star" style={{ animationDelay: `${0.3 + k * 0.25}s` }}>
                <path d={STAR} fill={k < stars ? "#e3a417" : "rgba(46,20,8,.14)"} />
              </svg>
            ))}
          </div>
        ) : null}
        <dl className={won ? "mt-4 grid gap-2 rounded-[18px] bg-white px-4 py-3 text-[0.95rem]" : "mt-6 grid gap-2 text-[0.95rem]"}>
          {last ? (
            <>
              <Row label="Bricks broken" value={String(last.broken)} />
              <Row label="Balls dropped" value={String(last.dropped)} />
            </>
          ) : null}
          {won ? (
            <>
              <Row label="Wall pay" value={naira(wallPay(wall))} />
              <Row label="Clean job bonus" value={naira(score - wallPay(wall))} />
              <Row label="Takings" value={naira(score)} strong />
              <Row label="Rank" value={rank.next ? `${rank.name}, ${rank.next.stars - totalAfter} stars to ${rank.next.name}` : rank.name} />
            </>
          ) : null}
        </dl>
        {rose ? <p className="mt-3 rounded-[16px] bg-[#7c2f16] px-4 py-3 text-center font-extrabold text-[#f6c453]">New rank: {rank.name}!</p> : null}
        {newSite ? <p className="mt-3 rounded-[16px] bg-white px-4 py-3 text-center text-[0.92rem]"><b>{SITES[siteOf(next)]!.name} is open.</b> {SITES[siteOf(next)]!.about}</p> : null}
        <div className="mt-auto flex flex-col gap-2.5 pt-6">
          {hasNext ? (
            <Link prefetch={false} href={`/solo/bash-am?mode=wall-${next}`} className="flex h-14 items-center justify-center rounded-full bg-[#1c1416] text-[1.05rem] font-extrabold text-[#f8f0e4]">
              Next wall
            </Link>
          ) : !won ? (
            <button type="button" onClick={again} className="flex h-14 items-center justify-center rounded-full bg-[#f6c453] text-[1.05rem] font-extrabold text-[#2e1408]">
              Try again
            </button>
          ) : null}
          {won ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={again} className="flex h-14 items-center justify-center rounded-full bg-[rgba(28,20,22,.07)] text-[1rem] font-extrabold">
                {stars === 3 ? "Play again" : "Try for ★★★"}
              </button>
              <button type="button" onClick={share} className="flex h-14 items-center justify-center rounded-full bg-[rgba(28,20,22,.07)] text-[1rem] font-extrabold">
                Share my rank
              </button>
            </div>
          ) : null}
          <Link prefetch={false} href="/solo/bash-am" className="flex h-12 items-center justify-center rounded-full text-[0.95rem] font-bold underline underline-offset-4">
            Back to the sites
          </Link>
        </div>
      </div>
      <style>{`
        .ba-rise { animation: ba-rise 1.2s cubic-bezier(.2,.8,.3,1) both; }
        @keyframes ba-rise { from { transform: translateY(96px); } to { transform: translateY(0); } }
        .ba-star { animation: ba-star .5s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes ba-star { from { opacity: 0; scale: .2; } to { opacity: 1; scale: 1; } }
        @media (prefers-reduced-motion: reduce) { .ba-rise, .ba-star { animation: none; } }
      `}</style>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-current/15 pb-2 last:border-0 last:pb-0">
      <dt className={strong ? "font-extrabold" : ""}>{label}</dt>
      <dd className="text-right font-bold tabular-nums">{value}</dd>
    </div>
  );
}
