"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ROUTES, ROUTE_ABOUT, routeConfig, routeStars } from "@/lib/solo/games/okada";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const STAR = "M12 2l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 16.8 5.9 20.2l1.5-6.7L2.3 8.9l6.8-.7z";

/** The end of a route: stars, what you took in, and the next route. Drawn on the page (a portal), like Mama Put's. */
export function OkadaRouteDone(props: { route: number; score: number; newBest: boolean; again: () => void; share: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(<Done {...props} />, host) : null;
}

function Done({ route, score, newBest, again, share }: { route: number; score: number; newBest: boolean; again: () => void; share: () => void }) {
  const cfg = routeConfig(route);
  const stars = routeStars(route, score);
  const toNext = stars < 3 ? cfg.stars[stars]! - score : 0;
  const next = route + 1;
  const opened = stars >= 1 && next <= ROUTES.length;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="solo-result-h" className="fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(180deg,#1f1b1d_0%,#3a3034_100%)] text-white">
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col px-4 pb-6 pt-10">
        <div className="relative mx-auto h-[180px] w-full">
          <div aria-hidden className="ok-burst absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="relative flex h-full items-end justify-center gap-1.5 pb-4" role="img" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((k) => (
              <svg key={k} viewBox="0 0 24 24" width={k === 1 ? 104 : 78} height={k === 1 ? 104 : 78} className="ok-star drop-shadow-[0_6px_10px_rgba(0,0,0,.4)]" style={{ transform: k === 0 ? "rotate(-14deg) translateY(10px)" : k === 2 ? "rotate(14deg) translateY(10px)" : undefined, animationDelay: `${0.25 + k * 0.3}s` }}>
                <path d={STAR} fill={k < stars ? "#f2b705" : "rgba(255,255,255,.12)"} stroke={k < stars ? "#a77a00" : "rgba(255,255,255,.35)"} strokeWidth=".8" />
              </svg>
            ))}
          </div>
        </div>
        <div className="text-center">
          <p className="text-[0.75rem] font-extrabold text-[#f2b705]">
            {ROUTES[route - 1]} · {stars ? "Cleared" : "Not yet"}
          </p>
          <h2 id="solo-result-h" className="display mt-1.5 text-[2.4rem] leading-none">
            {naira(score)}
          </h2>
          <p className="mx-auto mt-2 max-w-[22rem] text-[0.93rem] text-[#e6dcd4]">
            {toNext > 0 ? `${naira(toNext)} more for ${stars ? "the next star" : "a star"}.` : ""} {newBest ? "Your best on this route." : ""}
          </p>
        </div>
        {opened ? (
          <div className="mt-6 flex items-center gap-3 rounded-[16px] border-[1.5px] border-[rgba(46,155,87,.6)] bg-[rgba(46,155,87,.18)] px-3.5 py-3 text-[0.88rem]">
            <svg width="30" height="30" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="11" fill="#2e9b57" />
              <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              <b className="block">{ROUTES[next - 1]} is open!</b>
              {ROUTE_ABOUT[next - 1]}
            </span>
          </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          {opened ? (
            <Link prefetch={false} href={`/solo/okada-rush?mode=route-${next}`} className="flex h-14 items-center justify-center rounded-full bg-[#f2b705] text-[1.05rem] font-extrabold text-[#1f1b1d]">
              Ride {ROUTES[next - 1]}
            </Link>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={again} className={`flex h-14 items-center justify-center rounded-full text-[1rem] font-extrabold ${opened ? "bg-white/10" : "col-span-2 bg-[#f2b705] text-[#1f1b1d]"}`}>
              {stars === 3 ? "Ride again" : stars ? "Try for ★★★" : "Try again"}
            </button>
            <button type="button" onClick={share} className={`flex h-14 items-center justify-center rounded-full bg-white/10 text-[1rem] font-extrabold ${opened ? "" : "col-span-2"}`}>
              Share
            </button>
          </div>
          <Link prefetch={false} href="/solo/okada-rush" className="flex h-12 items-center justify-center rounded-full text-[0.95rem] font-bold text-[#e6dcd4] underline underline-offset-4">
            Back to the routes
          </Link>
        </div>
      </div>
      <style>{`
        .ok-burst { background: repeating-conic-gradient(rgba(242,183,5,.16) 0 10deg, transparent 10deg 20deg); mask: radial-gradient(circle, #000 30%, transparent 70%); animation: ok-spin 40s linear infinite; }
        @keyframes ok-spin { to { rotate: 360deg; } }
        .ok-star { animation: ok-star .55s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes ok-star { from { opacity: 0; scale: .2; } to { opacity: 1; scale: 1; } }
        @media (prefers-reduced-motion: reduce) { .ok-burst, .ok-star { animation: none; } }
      `}</style>
    </div>
  );
}
