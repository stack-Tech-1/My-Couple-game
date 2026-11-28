import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/design/Logo";
import { BackButton } from "@/design/BackButton";
import { Icon } from "@/design/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GAMES } from "@/games/catalog";
import { SOLO_GAMES } from "@/lib/solo/catalog";
import { FREE_GAMES, FREE_LIMITS, FREE_PLAYS_PER_DAY, PLANS, TRIAL_DAYS, naira, type PlanId } from "@/lib/plus/plans";
import { MAX_FRIEND_ROOMS } from "@/lib/room/types";

export const metadata: Metadata = {
  title: "Prices",
  description: "What Amah costs: free to play, with Amah Plus from ₦1,500 a month. Every plan, its price, and what it includes.",
};

/** The plans people pay for, in order (the gift seat is the same price as "Just me"). */
const ORDER: PlanId[] = ["single", "couple", "group3", "group5", "group8"];
const WHO: Record<string, string> = {
  single: "One person: Plus for you in every room you're in, and in Solo.",
  couple: "You and your partner, both with Plus in every room you're in.",
  group3: "Three seats to give to people in your friend room.",
  group5: "Five seats to give to people in your friend room.",
  group8: "Eight seats: the whole friend room.",
};

/**
 * Public prices: every plan with its monthly and yearly price, and exactly what's free and what
 * Plus adds, so people know what they're paying for before checkout. Built from the same numbers
 * the app charges (lib/plus/plans), so it can't drift.
 */
export default function Pricing() {
  const freeGames = GAMES.filter((g) => FREE_GAMES.has(g.id)).map((g) => g.name);
  const plusGames = GAMES.filter((g) => !FREE_GAMES.has(g.id) && g.category !== "spicy").length;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
        <Link prefetch={false} href="/" aria-label="Amah home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-8">
        <BackButton href="/" label="Home" />
        <h1 className="display mt-6 text-[clamp(2.6rem,7vw,4rem)] leading-none">Prices</h1>
        <p className="mt-3 max-w-2xl text-[1.05rem] text-muted">
          Amah is free to play. Amah Plus opens every game with no daily limits, from {naira(PLANS.single.month)} a month. All prices are in naira.
        </p>

        {/* The plans */}
        <section aria-labelledby="plans-h" className="mt-10">
          <h2 id="plans-h" className="display text-[1.8rem]">Amah Plus plans</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="text-[0.82rem] text-muted">
                  <th className="pb-2 pr-4 font-semibold">Plan</th>
                  <th className="pb-2 pr-4 font-semibold">Who it covers</th>
                  <th className="pb-2 pr-4 text-right font-semibold">Monthly</th>
                  <th className="pb-2 text-right font-semibold">Yearly</th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map((id) => (
                  <tr key={id} className="border-t border-line">
                    <td className="py-3 pr-4 font-bold">{PLANS[id].label}</td>
                    <td className="py-3 pr-4 text-[0.92rem] text-muted">{WHO[id]}</td>
                    <td className="py-3 pr-4 text-right font-extrabold tabular">{naira(PLANS[id].month)}</td>
                    <td className="py-3 text-right font-extrabold tabular">{naira(PLANS[id].year)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line">
                  <td className="py-3 pr-4 font-bold">{PLANS.gift.label}</td>
                  <td className="py-3 pr-4 text-[0.92rem] text-muted">Buy Plus for one friend in your room. Paid once, never renews.</td>
                  <td className="py-3 pr-4 text-right font-extrabold tabular">{naira(PLANS.gift.month)}</td>
                  <td className="py-3 text-right font-extrabold tabular">{naira(PLANS.gift.year)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.88rem] text-muted">Every plan includes everything in Amah Plus below. The only difference is how many people it covers.</p>
        </section>

        {/* Free and Plus side by side */}
        <section aria-labelledby="what-h" className="mt-12 grid gap-4 md:grid-cols-2">
          <h2 id="what-h" className="sr-only">What each plan includes</h2>
          <div className="cloth p-5 sm:p-6">
            <p className="eyebrow text-muted">Free</p>
            <p className="display mt-1 text-[2rem] leading-none">₦0</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-[0.95rem]">
              <Li>These games, {FREE_PLAYS_PER_DAY} plays of each a day: {freeGames.join(", ")}.</Li>
              <Li>One more game free for everyone each week (the free game of the week).</Li>
              <Li>
                All {SOLO_GAMES.length} Solo games, {FREE_PLAYS_PER_DAY} plays of each a day (Zobo Sort: one new level a day). Bash Am&apos;s first wall, Okada Rush&apos;s first route and Mama Put&apos;s first two days.
              </Li>
              <Li>Your couple room and {FREE_LIMITS.friendRooms} friend room, with chat. Voice notes and stickers: you can receive them.</Li>
              <Li>
                Up to {FREE_LIMITS.photos} photos in Memory Lane and {FREE_LIMITS.sealedNotes} sealed love notes.
              </Li>
            </ul>
          </div>
          <div className="cut relative overflow-hidden bg-[#2a1f4e] p-5 text-[#f6efe6] sm:p-6">
            <p className="eyebrow text-[#f6d26a]">Amah Plus</p>
            <p className="display mt-1 text-[2rem] leading-none">From {naira(PLANS.single.month)}/month</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-[0.95rem]">
              <Li plus>Everything in Free, and all {plusGames} other games: Chess, Naija Landlord, trivia, word games, team games and more.</Li>
              <Li plus>No daily limits on any game.</Li>
              <Li plus>Every level of every Solo game: all of Bash Am, Mama Put, Okada Rush and Zobo Sort.</Li>
              <Li plus>Up to {MAX_FRIEND_ROOMS} friend rooms, and send voice notes and stickers.</Li>
              <Li plus>Unlimited photos in Memory Lane and unlimited sealed love notes.</Li>
            </ul>
          </div>
        </section>

        {/* How paying works */}
        <section aria-labelledby="pay-h" className="mt-12 max-w-3xl">
          <h2 id="pay-h" className="display text-[1.8rem]">How paying works</h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-[0.95rem] text-muted">
            <Li>A free {TRIAL_DAYS}-day trial, once per person. No card needed.</Li>
            <Li>Pay by card and it renews each month or year until you stop it. Stop any time in Settings; Plus runs to the end of what you&apos;ve paid for.</Li>
            <Li>Or pay once by bank transfer, USSD or card: no renewal, and we remind you before it ends.</Li>
            <Li>
              Payments are handled by Paystack. Refunds are covered in our{" "}
              <Link prefetch={false} href="/terms#payments" className="underline underline-offset-2">
                terms
              </Link>
              .
            </Li>
          </ul>
          <Link prefetch={false} href="/sign-in?intent=create" className="cut mt-8 inline-flex h-14 items-center gap-2 bg-hibiscus px-7 text-[1.05rem] font-semibold text-[#fff8f0]">
            Start free <Icon name="arrowRight" size={20} />
          </Link>
        </section>
      </main>
    </div>
  );
}

function Li({ children, plus }: { children: React.ReactNode; plus?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <Icon name="check" size={18} className={plus ? "mt-0.5 shrink-0 text-[#f6d26a]" : "mt-0.5 shrink-0 text-accent"} />
      <span>{children}</span>
    </li>
  );
}
