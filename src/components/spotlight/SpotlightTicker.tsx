"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { winnerLine, winnerName, type SpotlightWinner } from "@/lib/engage/spotlight-shared";

/**
 * This week's winners as a thin headline strip that flows right to left across the top. Hidden
 * while a game is being played. Holds still for people who've asked for less motion.
 */
export function SpotlightTicker({ winners, theme = null }: { winners: SpotlightWinner[]; theme?: { name: string; blurb: string } | null }) {
  const path = usePathname();
  if ((!winners.length && !theme) || /\/(play|watch)\//.test(path)) return null;
  const items = [
    ...(theme ? [`${theme.name}: ${theme.blurb}`] : []),
    ...winners.map((w) => `${w.kind === "couple" ? "Couple of the Week" : "Gang of the Week"}: ${winnerName(w)}, ${winnerLine(w)}`),
  ];
  const line = (
    <>
      {items.map((t, i) => (
        <span key={i} className="inline-flex items-center">
          {t}
          <span aria-hidden className="mx-5 text-[#d6ad55]">✦</span>
        </span>
      ))}
      {winners.length ? (
        <>
          <span className="font-extrabold text-[#fff6dc]">Send them love</span>
          <span aria-hidden className="mx-5 text-[#d6ad55]">✦</span>
        </>
      ) : null}
    </>
  );
  return (
    <Link prefetch={false} href="/spotlight" aria-label={`This week on Amah. ${items.join(". ")}. See the winners.`} className="relative z-30 flex h-9 items-stretch overflow-hidden bg-[#0d3b2e] text-[0.82rem] font-bold text-[#f4e2b0]">
      <span className="z-10 flex shrink-0 items-center bg-[linear-gradient(100deg,#9a6b1f,#f9e08a_30%,#c9952e_55%,#fff1b8_72%,#a8761f)] px-3 text-[0.68rem] font-extrabold tracking-[0.08em] text-[#0d3b2e]">THIS WEEK</span>
      <span className="relative flex min-w-0 flex-1 items-center overflow-hidden" aria-hidden>
        <span className="amah-ticker flex shrink-0 whitespace-nowrap pl-4 motion-reduce:animate-none">
          {line}
          {line}
        </span>
      </span>
      <style>{`
        .amah-ticker { animation: amah-ticker 32s linear infinite; }
        @keyframes amah-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .amah-ticker { animation: none; } }
      `}</style>
    </Link>
  );
}
