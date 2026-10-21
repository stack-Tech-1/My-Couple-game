import Link from "next/link";
import type { Metadata } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { Logo, LogoMark } from "@/design/Logo";
import { Icon, type IconName } from "@/design/icons";
import { RoomPreview } from "@/components/landing/RoomPreview";
import { DeletedNotice } from "@/components/landing/DeletedNotice";
import { Suspense } from "react";
import { CATEGORIES, CATEGORY_ORDER, GAMES, gamesIn } from "@/games/catalog";
import { GameArt } from "@/games/GameArt";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: games for the people closest to you` },
  description: APP_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${APP_NAME}: games for the people closest to you`,
    description: APP_DESCRIPTION,
    type: "website",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

const featured: Record<string, string> = {
  competitive: "whot",
  coop: "split-clues",
  personal: "how-well",
  romantic: "love-notes",
  spicy: "fantasy-match",
};

export default function Landing() {
  return (
    <div className="relative z-[1] overflow-x-clip">
      <Suspense fallback={null}>
        <DeletedNotice />
      </Suspense>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Link prefetch={false} href="/" aria-label={`${APP_NAME} home`} className="rounded-md">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link prefetch={false} href="/sign-in" className="rounded-full px-4 py-2 text-[0.92rem] font-semibold hover:bg-sunk">
            Sign in
          </Link>
          <Link prefetch={false}
            href="/sign-in?intent=create"
            className="rounded-full bg-fg px-4 py-2 text-[0.92rem] font-semibold text-bg hover:opacity-90"
          >
            Start a room
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pt-16">
          <div>
            <p className="eyebrow text-accent-ink">Made for couples. Bring your best friends too.</p>
            <h1 className="display mt-5 text-[clamp(3.1rem,9vw,6.4rem)]">
              Games for the people <span className="display-wonk mr-[0.12em] italic">closest</span>{" "}
              <span className="scribble">to you</span>.
            </h1>
            <p className="mt-7 max-w-[34rem] text-[1.12rem] leading-relaxed text-muted">
              A private room for the two of you: cards, board games, trivia about each other, love notes that unlock
              on a date you choose, and an after-dark corner you both have to open. And when the group chat wants a
              rematch, a friend room fits up to eight. Everyone plays from their own phone, live.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link prefetch={false}
                href="/sign-in?intent=create"
                className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-7 text-[1.05rem] font-semibold text-on-accent shadow-[inset_0_-2px_0_rgba(0,0,0,.18)] hover:brightness-105"
              >
                Make your room <Icon name="arrowRight" size={20} />
              </Link>
              <span className="text-[0.9rem] text-muted">Free. Takes about forty seconds.</span>
            </div>
          </div>
          <RoomPreview />
        </section>

        {/* Ledger strip */}
        <section aria-label="At a glance" className="border-y border-line-strong">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            {[
              [String(GAMES.length), "games, from Whot to love notes"],
              ["2", "in a couple room. Only ever."],
              ["8", "friends in a friend room"],
              ["0", "ads, feeds or audiences"],
            ].map(([n, label]) => (
              <div key={label} className="px-4 py-6 sm:px-8">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="display tabular block text-[3rem]">{n}</span>
                  <span className="text-[0.9rem] text-muted">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Categories, editorial index */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8" aria-labelledby="moods">
          <div className="max-w-2xl">
            <p className="eyebrow text-muted">The library</p>
            <h2 id="moods" className="display mt-3 text-[clamp(2.4rem,6vw,4rem)]">
              Pick a mood. We&apos;ll find the game.
            </h2>
          </div>

          <ol className="mt-14 border-t border-line-strong">
            {CATEGORY_ORDER.map((c, i) => {
              const cat = CATEGORIES[c];
              const games = gamesIn(c);
              const art = featured[c] ?? games[0]?.id ?? "";
              return (
                <li key={c} className="grid gap-6 border-b border-line py-10 md:grid-cols-[4rem_1.1fr_1.4fr_10rem] md:items-start">
                  <span className="display tabular text-[1.6rem] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="display text-[2.2rem]" style={{ color: cat.ink }}>
                      {cat.label}
                    </h3>
                    <p className="mt-2 text-muted">{cat.blurb}</p>
                  </div>
                  <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[0.98rem] md:pt-2">
                    {games.map((g) => (
                      <li key={g.id} className="font-medium">
                        {g.name}
                      </li>
                    ))}
                  </ul>
                  <div style={{ color: "var(--fg)" }} className="hidden md:block">
                    <GameArt id={art} accent={cat.color} className="h-auto w-full" />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* How it works */}
        <section className="bg-fg text-bg" aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
            <h2 id="how" className="display text-[clamp(2.4rem,6vw,4rem)]">
              Three steps. One of them is texting.
            </h2>
            <ol className="mt-14 grid gap-12 md:grid-cols-3">
              {(
                [
                  ["door", "Make a room", "Sign in with an email link or Google, pick a little mark for your avatar, name your room."],
                  ["link", "Send your person the link", "They tap it, they're in, and the room locks to the two of you. Nobody else gets a door."],
                  ["dice", "Play, anywhere", "Pick a game and their phone lights up with an invite. Scores, streaks and moments stack up as you go."],
                ] as [IconName, string, string][]
              ).map(([icon, title, body], i) => (
                <li key={title} className="border-t border-[color-mix(in_srgb,var(--bg)_30%,transparent)] pt-6">
                  <div className="flex items-center justify-between">
                    <Icon name={icon} size={28} />
                    <span className="display tabular text-[1.2rem] opacity-60">0{i + 1}</span>
                  </div>
                  <h3 className="display mt-6 text-[1.8rem]">{title}</h3>
                  <p className="mt-3 leading-relaxed opacity-75">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Friend rooms */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8" aria-labelledby="friends">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <p className="eyebrow text-accent-ink">New · Friend rooms</p>
              <h2 id="friends" className="display mt-4 text-[clamp(2.4rem,6vw,4rem)]">
                Bring your people.
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-muted">
                Your best friend, your siblings, the group chat that never stops arguing about Whot rules. Start a friend
                room, send the code, and pick who you&apos;re playing. Your couple room stays just for the two of you.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              {[
                ["Up to eight", "Everyone gets a seat. Be in up to five friend rooms, plus your couple room."],
                ["The good games", "Whot, Ludo, Ayo, Word Duel, Connect Four, Draw & Guess, riddles and Don't Laugh."],
                ["A group chat", "Voice notes, stickers and trash talk, following you into every game."],
                ["One owner", "Whoever starts the room invites people and can remove them. Nobody else gets a key."],
              ].map(([t, b]) => (
                <div key={t} className="border-t border-line-strong pt-4">
                  <h3 className="font-bold">{t}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* After dark */}
        <section className="relative overflow-hidden bg-[#120c0e] text-[#f4e4da]" aria-labelledby="afterdark">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 90% 10%, rgba(232,86,58,.28), transparent 70%), radial-gradient(40% 50% at 0% 100%, rgba(91,26,43,.55), transparent 70%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-8 lg:grid-cols-2">
            <div>
              <p className="eyebrow text-[#ff8a6e]">After dark · 18+</p>
              <h2 id="afterdark" className="display mt-4 text-[clamp(2.4rem,6vw,4rem)]">
                The lights dim only when you <em className="display-wonk">both</em> say so.
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-[#c9b0a7]">
                Flirty, teasing, and as bold as you both choose. A separate corner of the app with its own rules, built
                so that nobody is ever surprised, pressured or put on the spot.
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-[18px] border border-[#3d2127] bg-[#3d2127] sm:grid-cols-2">
              {[
                ["Two keys", "Each of you confirms you're 18+ and opts in separately. One no keeps it locked."],
                ["Lowest ceiling wins", "You each set a max heat. The game never goes past the lower one."],
                ["Skip, no questions", "Pass on any card instantly. No penalty, and nobody is told why."],
                ["Private by design", "Fantasy Match only reveals mutual yeses. A no is never shown."],
                ["Discreet mode", "Its own PIN, blurs when you switch apps, one-tap exit to a neutral screen."],
                ["Your own deck", "Write custom cards. They exist only inside your room."],
              ].map(([t, b]) => (
                <li key={t} className="bg-[#160e11] p-6">
                  <p className="font-semibold text-[#f4e4da]">{t}</p>
                  <p className="mt-2 text-[0.92rem] leading-relaxed text-[#b99a92]">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8" aria-labelledby="privacy">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Icon name="shield" size={36} className="text-sage-ink" />
              <h2 id="privacy" className="display mt-5 text-[clamp(2.2rem,5vw,3.4rem)]">
                What happens in the room stays in the room.
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              {[
                ["Locked to two", "Once your partner joins a couple room, the invite code is retired. No third account can get in, and After Dark never exists in friend rooms."],
                ["Hidden means hidden", "Your hand of cards and sealed answers never even reach your partner's phone until they should."],
                ["Photos stay private", "Memory Lane photos sit in private storage and load through short-lived links."],
                ["Leave cleanly", "Delete your account and everything you wrote goes with it. One button, no email to support."],
              ].map(([t, b]) => (
                <div key={t} className="border-t border-line-strong pt-4">
                  <h3 className="font-bold">{t}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-line-strong">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-24 sm:px-8 md:flex-row md:items-end md:justify-between">
            <h2 className="display max-w-3xl text-[clamp(2.6rem,7vw,5rem)]">
              Tonight&apos;s plans: <span className="text-accent-ink">beat them at Whot.</span>
            </h2>
            <Link prefetch={false}
              href="/sign-in?intent=create"
              className="inline-flex h-14 shrink-0 items-center gap-2 rounded-full bg-fg px-7 text-[1.05rem] font-semibold text-bg hover:opacity-90"
            >
              Make your room <Icon name="arrowRight" size={20} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-[0.88rem] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2">
            <LogoMark size={22} /> Made for two. © {new Date().getFullYear()} {APP_NAME}
          </span>
          <nav className="flex flex-wrap gap-5">
            <Link prefetch={false} href="/terms" className="hover:text-fg">Terms</Link>
            <Link prefetch={false} href="/privacy" className="hover:text-fg">Privacy</Link>
            <Link prefetch={false} href="/adults" className="hover:text-fg">18+ notice</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
