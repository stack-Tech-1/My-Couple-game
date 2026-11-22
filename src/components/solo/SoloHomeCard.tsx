import Link from "next/link";
import { SOLO_GAMES, lagosDay } from "@/lib/solo/catalog";
import { SoloCard } from "./SoloCard";

/**
 * Solo on a room's home page. While your person hasn't joined it's the main thing to do (big);
 * otherwise a smaller card. Free for everyone.
 */
export function SoloHomeCard({ big }: { big: boolean }) {
  const friday = new Date(`${lagosDay()}T00:00:00Z`).getUTCDay() === 5;
  const quick = SOLO_GAMES.filter((g) => ["blend-am", "okada-rush", "fix-am"].includes(g.id));
  return (
    <section aria-labelledby="solo-home-h" className="cut relative bg-lagoon text-[#fff8f0]">
      <div className="relative p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="solo-home-h" className="display text-[1.6rem] leading-tight">{big ? "Play on your own" : "On your own"}</h2>
          <span className="text-[0.82rem] font-extrabold">Free</span>
        </div>
        <p className="text-[0.88rem] font-semibold">{big ? "While you wait. Your bests are here when they arrive." : "Quick games for when it's just you."}</p>
        <Link prefetch={false} href="/solo/oro" className="cut-sm mt-3 flex items-center justify-between gap-3 bg-[#fff8f0] px-4 py-3 text-[#1b1519]">
          <span>
            <span className="block font-extrabold">Today&apos;s word</span>
            <span className="block text-[0.82rem] text-[#6a5a57]">{friday ? "Friday: it's a Naija word" : "One word, six guesses"}</span>
          </span>
          <span className="cut-sm bg-[#136474] px-3 py-1.5 text-[0.82rem] font-bold text-[#fff8f0]">Play</span>
        </Link>
        {big ? (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {quick.map((g) => (
              <li key={g.id}>
                <SoloCard game={g} size="small" note={g.id === "fix-am" ? "Today's picture" : "Beat your best"} />
              </li>
            ))}
          </ul>
        ) : null}
        <Link prefetch={false} href="/solo" className="cut-sm mt-3 flex h-11 items-center justify-center bg-[#136474] text-[0.92rem] font-extrabold text-[#fff8f0]">
          See all Solo games
        </Link>
      </div>
    </section>
  );
}
