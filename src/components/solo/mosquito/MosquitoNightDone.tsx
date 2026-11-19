"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSoloLimits } from "../SoloLimits";
import { NIGHTS, ROOMS, START_BITES, nightPay, rankFor, roomOf, starsOfTakings } from "@/lib/solo/games/mosquito";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const STAR = "M12 2l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 16.8 5.9 20.2l1.5-6.7L2.3 8.9l6.8-.7z";
const LINES = ["", "You made it, but they fed well.", "You slept well, with a few scratches.", "You slept like a baby."];

type Props = { night: number; score: number; totalBefore: number; totalAfter: number; left: number | null; again: () => void; share: () => void };

/** The end of a night: morning if you survived it, a rough wake-up if you didn't. */
export function MosquitoNightDone(props: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(<Done {...props} />, host) : null;
}

function Done({ night, score, totalBefore, totalAfter, left, again, share }: Props) {
  const { plusHref } = useSoloLimits();
  const [last, setLast] = useState<{ night: number; bites: number; kills: number } | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem("amah:mosquito:last") ?? "null") as { night: number; bites: number; kills: number } | null;
      if (v?.night === night) setLast(v);
    } catch {
      // The counts just don't show.
    }
  }, [night]);
  const won = score > 0;
  const stars = starsOfTakings(night, score);
  const rank = rankFor(totalAfter);
  const rose = rank.index > rankFor(totalBefore).index;
  const next = night + 1;
  const hasNext = won && next <= NIGHTS;
  const newRoom = hasNext && roomOf(next) !== roomOf(night);
  const waiting = left === 0;
  const bonus = score - nightPay(night);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="solo-result-h" className={won ? "mq-morning fixed inset-0 z-[90] overflow-y-auto text-[#2e1408]" : "fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(180deg,#15152f_0%,#3a1a2e_100%)] text-[#f6efe6]"}>
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col px-4 pb-6 pt-10">
        {won ? (
          <div aria-hidden className="relative mx-auto h-[150px] w-full">
            <div className="mq-sun absolute bottom-[12px] left-1/2 h-[120px] w-[120px] -translate-x-1/2 rounded-full bg-[#fff3c4]" />
          </div>
        ) : null}
        <div className="text-center">
          <h2 id="solo-result-h" className="display text-[2.5rem] leading-none">{won ? "Morning don come!" : "They finished you!"}</h2>
          <p className="mx-auto mt-2 max-w-[22rem] text-[0.95rem]">{won ? `Night ${night} cleared. ${LINES[stars]}` : `${START_BITES} bites on night ${night}. Get your can and try again.`}</p>
        </div>
        {won ? (
          <div className="mt-4 flex justify-center gap-1" role="img" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((k) => (
              <svg key={k} viewBox="0 0 24 24" width="56" height="56" className="mq-star" style={{ animationDelay: `${0.3 + k * 0.25}s` }}>
                <path d={STAR} fill={k < stars ? "#e3a417" : "rgba(46,20,8,.14)"} />
              </svg>
            ))}
          </div>
        ) : null}
        <dl className={won ? "mt-5 grid gap-2 rounded-[18px] bg-white/75 px-4 py-3 text-[0.95rem]" : "mt-6 grid gap-2 text-[0.95rem]"}>
          {last ? (
            <>
              <Row label="Mosquitoes killed" value={String(last.kills)} />
              <Row label="Bites taken" value={`${last.bites} of ${START_BITES}`} />
            </>
          ) : null}
          {won ? (
            <>
              <Row label="Night pay" value={naira(nightPay(night))} />
              <Row label="Sound sleep bonus" value={naira(bonus)} />
              <Row label="Takings" value={naira(score)} strong />
              <Row label="Rank" value={rank.next ? `${rank.name}, ${rank.next.stars - totalAfter} stars to ${rank.next.name}` : rank.name} />
            </>
          ) : null}
        </dl>
        {rose ? <p className="mt-4 rounded-[16px] bg-[#2c2857] px-4 py-3 text-center font-extrabold text-[#f6d67a]">New rank: {rank.name}!</p> : null}
        {newRoom && !waiting ? <p className="mt-4 rounded-[16px] bg-white/75 px-4 py-3 text-center text-[0.92rem]"><b>{ROOMS[roomOf(next)]!.name} is open.</b> {ROOMS[roomOf(next)]!.about}</p> : null}
        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          {waiting ? (
            <div className={won ? "rounded-[18px] bg-white/75 px-4 py-3 text-center" : "rounded-[18px] border-[1.5px] border-white/30 px-4 py-3 text-center"}>
              <p className="font-bold">Your free nights come back at midnight.</p>
              {plusHref ? <Link prefetch={false} href={plusHref} className="mt-1 inline-block text-[0.92rem] font-bold underline underline-offset-4">Play every night with Amah Plus</Link> : null}
            </div>
          ) : hasNext ? (
            <Link prefetch={false} href={`/solo/mosquito-wahala?mode=night-${next}`} className="flex h-14 items-center justify-center rounded-full bg-[#1c1416] text-[1.05rem] font-extrabold text-[#f6efe6]">
              Next night
            </Link>
          ) : !won ? (
            <button type="button" onClick={again} className="flex h-14 items-center justify-center rounded-full bg-[#f6d67a] text-[1.05rem] font-extrabold text-[#2e1408]">
              Try again
            </button>
          ) : null}
          {won ? (
            <div className="grid grid-cols-2 gap-2.5">
              {!waiting ? (
                <button type="button" onClick={again} className="flex h-14 items-center justify-center rounded-full bg-white/70 text-[1rem] font-extrabold">
                  {stars === 3 ? "Play again" : "Try for ★★★"}
                </button>
              ) : null}
              <button type="button" onClick={share} className={`flex h-14 items-center justify-center rounded-full bg-white/70 text-[1rem] font-extrabold ${waiting ? "col-span-2" : ""}`}>
                Share my rank
              </button>
            </div>
          ) : null}
          <Link prefetch={false} href="/solo/mosquito-wahala" className="flex h-12 items-center justify-center rounded-full text-[0.95rem] font-bold underline underline-offset-4">
            Back to the rooms
          </Link>
        </div>
      </div>
      <style>{`
        .mq-morning { background: linear-gradient(180deg, #f7a35c 0, #fbd28a 170px, #fbf4ea 380px); }
        .mq-sun { box-shadow: 0 0 60px 26px rgba(255,243,196,.75); animation: mq-rise 1.4s cubic-bezier(.2,.8,.3,1) both; }
        @keyframes mq-rise { from { transform: translate(-50%, 110px); } to { transform: translate(-50%, 0); } }
        .mq-star { animation: mq-star .5s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes mq-star { from { opacity: 0; scale: .2; } to { opacity: 1; scale: 1; } }
        @media (prefers-reduced-motion: reduce) { .mq-sun, .mq-star { animation: none; } }
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
