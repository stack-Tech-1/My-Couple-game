"use client";

import { RING_COLORS, RINGS, clockText, pumpResult } from "@/lib/solo/games/pump";

/** What the finish says, by how many rings went on. */
export function pumpLine(score: number): { title: string; line: string } {
  const { rings, seconds } = pumpResult(score);
  if (rings === RINGS) return { title: "All ten on!", line: `In ${clockText(seconds ?? 0)}. Pump master.` };
  if (rings >= 7) return { title: `${rings} of ${RINGS} rings on`, line: "So close. One more push." };
  if (rings >= 4) return { title: `${rings} of ${RINGS} rings on`, line: "Halfway there. The water is learning who's boss." };
  if (rings >= 1) return { title: `${rings} of ${RINGS} rings on`, line: "The water had its own plans today." };
  return { title: "No rings this time", line: "The water won this round. Short, quick pumps help." };
}

/** The poster's line: "All 10 rings in 1:24", or "7 of 10 rings". */
export function pumpPoster(score: number): string {
  const { rings, seconds } = pumpResult(score);
  return rings === RINGS ? `All ${RINGS} rings in ${clockText(seconds ?? 0)}` : `${rings} of ${RINGS} rings`;
}

/** The top of Pump Am's finish: the two pegs with the rings you hung, and a line about it. */
export function PumpDoneTop({ score }: { score: number }) {
  const { rings } = pumpResult(score);
  const { title, line } = pumpLine(score);
  // Rings share out between the pegs, left first, stacked from the bottom.
  const pegs = [Math.ceil(rings / 2), Math.floor(rings / 2)];
  return (
    <div className="-mx-1 mb-3">
      <svg viewBox="0 0 240 150" className="mx-auto block h-auto w-full max-w-[260px]" aria-hidden>
        <defs>
          <linearGradient id="pa-water" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#c8f0fb" />
            <stop offset=".4" stopColor="#6cc6ea" />
            <stop offset="1" stopColor="#1f74b0" />
          </linearGradient>
          <linearGradient id="pa-peg" x1="0" x2="1">
            <stop offset="0" stopColor="#d69a1f" />
            <stop offset=".5" stopColor="#fbe08a" />
            <stop offset="1" stopColor="#b37d10" />
          </linearGradient>
        </defs>
        <rect x="6" y="4" width="228" height="142" rx="26" fill="#e8563a" stroke="#7a2010" strokeWidth="2" />
        <rect x="18" y="16" width="204" height="120" rx="18" fill="url(#pa-water)" />
        {[0, 1].map((p) => {
          const x = p ? 160 : 80;
          return (
            <g key={p}>
              <path d={`M${x - 6} 128 L${x - 2} 44 Q${x} 38 ${x + 2} 44 L${x + 6} 128 Z`} fill="url(#pa-peg)" stroke="#8a5a0a" strokeWidth="1" />
              <ellipse cx={x} cy="128" rx="16" ry="5" fill="#b37d10" />
              {Array.from({ length: pegs[p]! }, (_, k) => {
                const color = p * Math.ceil(rings / 2) + k;
                const [light, dark] = RING_COLORS[color % RING_COLORS.length]!;
                const y = 122 - k * 9;
                return (
                  <g key={k} className="pa-done-ring" style={{ animationDelay: `${0.15 + (k * 2 + p) * 0.08}s` }}>
                    <ellipse cx={x} cy={y} rx="17" ry="5" fill="none" stroke={dark} strokeWidth="6" />
                    <ellipse cx={x} cy={y - 0.6} rx="17" ry="5" fill="none" stroke={light} strokeWidth="3.4" />
                  </g>
                );
              })}
            </g>
          );
        })}
        <path d="M24 30 Q22 70 24 110" stroke="rgba(255,255,255,.45)" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <p className="display mt-3 text-[1.5rem] leading-tight">{title}</p>
      <p className="mt-0.5 text-[0.92rem] text-muted">{line}</p>
      <style>{`
        .pa-done-ring { animation: pa-done-ring .45s cubic-bezier(.3,1.5,.5,1) both; }
        @keyframes pa-done-ring { from { transform: translateY(-60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .pa-done-ring { animation: none; } }
      `}</style>
    </div>
  );
}
