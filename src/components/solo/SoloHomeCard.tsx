import Link from "next/link";
import { AdireFill } from "@/design/adire";
import { SOLO_GAMES, SOLO_LOOK, lagosDay } from "@/lib/solo/catalog";
import { SoloCard } from "./SoloCard";

/**
 * Solo on a room's home page. While your person hasn't joined it's the main thing to do (big);
 * otherwise a smaller card. Free for everyone.
 */
export function SoloHomeCard({ big }: { big: boolean }) {
  const friday = new Date(`${lagosDay()}T00:00:00Z`).getUTCDay() === 5;
  const quick = SOLO_GAMES.filter((g) => ["blend-am", "okada-rush", "fix-am"].includes(g.id));
  return (
    <section aria-labelledby="solo-home-h" className="relative overflow-hidden rounded-[26px] text-[#2a1a05] shadow-[0_18px_36px_-24px_rgba(28,20,22,.7)]">
      <AdireFill motif={SOLO_LOOK.motif} bg={SOLO_LOOK.bg} ink={SOLO_LOOK.ink} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(70% 60% at 100% 0%, ${SOLO_LOOK.glow}, transparent 70%)` }} />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="solo-home-h" className="display text-[1.6rem] leading-tight">{big ? "Play on your own" : "On your own"}</h2>
          <span className="text-[0.82rem] font-extrabold">Free</span>
        </div>
        <p className="text-[0.88rem] font-semibold">{big ? "While you wait. Your bests are here when they arrive." : "Quick games for when it's just you."}</p>
        <Link prefetch={false} href="/solo/oro" className="glass mt-3 flex items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-[#1c1416]">
          <span>
            <span className="block font-extrabold">Today&apos;s word</span>
            <span className="block text-[0.82rem] text-muted">{friday ? "Friday: it's a Naija word" : "One word, six guesses"}</span>
          </span>
          <span className="rounded-full bg-[#1c1416] px-3 py-1.5 text-[0.82rem] font-bold text-[#f6efe6]">Play</span>
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
        <Link prefetch={false} href="/solo" className="mt-3 flex h-11 items-center justify-center rounded-full bg-[#1c1416] text-[0.92rem] font-extrabold text-[#f6efe6]">
          See all Solo games
        </Link>
      </div>
    </section>
  );
}
