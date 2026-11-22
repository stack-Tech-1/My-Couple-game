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
import { SECTION_CLOTH, Selvedge, WaxPrint } from "@/design/wax";

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

/** The ledger strip: four numbers, each on its own cut of colour. */
const LEDGER: [string, string, string, string][] = [
  [String(GAMES.length), "games, from Whot to love notes", "var(--fab-indigo)", "#f6efe6"],
  ["2", "in a couple room. Only ever.", "var(--fab-hibiscus)", "#fff8f0"],
  ["8", "friends in a friend room", "var(--fab-palm)", "#fff8f0"],
  ["0", "ads, feeds or audiences", "var(--fab-marigold)", "#1b1519"],
];

/**
 * The landing page wears Amah's cloth: one record print, opening the page around the live room
 * preview and closing it under the last call to play. Everything between is plain colour.
 */
export default function Landing() {
  return (
    <div className="relative z-[1] overflow-x-clip">
      <Suspense fallback={null}>
        <DeletedNotice />
      </Suspense>
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Link prefetch={false} href="/" aria-label={`${APP_NAME} home`} className="rounded-md">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link prefetch={false} href="/sign-in" className="rounded-full px-4 py-2 text-[0.92rem] font-semibold hover:bg-sunk">
            Sign in
          </Link>
          <Link prefetch={false} href="/sign-in?intent=create" className="cut-sm bg-fg px-4 py-2 text-[0.92rem] font-semibold text-bg hover:opacity-90">
            Start a room
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero: the words on plain calico, the room sewn onto a panel of cloth beside them. */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pb-20 lg:pt-14">
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
                className="cut inline-flex h-14 items-center gap-2 bg-hibiscus px-7 text-[1.05rem] font-semibold text-[#fff8f0] shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] hover:brightness-105"
              >
                Make your room <Icon name="arrowRight" size={20} />
              </Link>
              <span className="text-[0.9rem] text-muted">Free. Takes about forty seconds.</span>
            </div>
          </div>
          <div className="relative -mx-4 overflow-hidden px-6 py-12 sm:mx-0 sm:cut sm:px-10 sm:py-14">
            <WaxPrint print="record" />
            <div className="relative rotate-[-1.5deg]">
              <RoomPreview />
            </div>
          </div>
        </section>

        <Selvedge words={["GAMES FOR THE PEOPLE CLOSEST TO YOU", `${GAMES.length} GAMES`]} />

        {/* Ledger strip */}
        <section aria-label="At a glance" className="mx-auto max-w-6xl px-4 pt-14 sm:px-8">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LEDGER.map(([n, label, bg, fg]) => (
              <div key={label} className="cut px-5 py-5" style={{ background: bg, color: fg }}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="display tabular block text-[3rem] leading-none">{n}</span>
                  <span className="mt-2 block text-[0.9rem] opacity-90">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* The library: each mood is its own cut of colour. */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 max-md:py-16" aria-labelledby="moods">
          <div className="max-w-2xl">
            <p className="eyebrow text-muted">The library</p>
            <h2 id="moods" className="display mt-3 text-[clamp(2.4rem,6vw,4rem)]">
              Pick a mood. We&apos;ll find the game.
            </h2>
          </div>

          <ul className="mt-10 grid gap-3 md:grid-cols-2">
            {CATEGORY_ORDER.map((c, i) => {
              const cat = CATEGORIES[c];
              const cloth = SECTION_CLOTH[c];
              const games = gamesIn(c);
              const names = games.map((g) => g.name);
              const art = featured[c] ?? games[0]?.id ?? "";
              return (
                <li
                  key={c}
                  className={`cut relative flex min-w-0 gap-4 overflow-hidden p-5 sm:p-6 ${i === 0 ? "md:col-span-2" : ""}`}
                  style={{ background: cloth.fill, color: cloth.ink }}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="display text-[clamp(1.7rem,4vw,2.2rem)] leading-tight">{cat.label}</h3>
                    <p className="mt-1 opacity-90">{cat.blurb}</p>
                    <p className={`mt-3 text-[0.9rem] font-semibold opacity-85 ${c === "spicy" ? "hidden" : ""}`}>
                      {`${names.slice(0, i === 0 ? 10 : 5).join(", ")}${names.length > (i === 0 ? 10 : 5) ? ` and ${names.length - (i === 0 ? 10 : 5)} more` : ""}`}
                    </p>
                  </div>
                  <div aria-hidden className="relative hidden h-28 w-28 shrink-0 items-center justify-center self-center rounded-full bg-[#fbf7f1] text-[#1c1416] sm:flex">
                    <GameArt id={art} accent={cat.color} className="h-16 w-auto" />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* How it works: indigo, three calico cards. */}
        <section className="bg-indigo text-[#f6efe6]" aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8 max-md:py-16">
            <h2 id="how" className="display text-[clamp(2.4rem,6vw,4rem)]">
              Three steps. One of them is texting.
            </h2>
            <ol className="mt-12 grid gap-3 md:grid-cols-3 max-md:mt-8">
              {(
                [
                  ["door", "Make a room", "Sign in with an email link or Google, pick a little mark for your avatar, name your room."],
                  ["link", "Send your person the link", "They tap it, they're in, and the room locks to the two of you. Nobody else gets a door."],
                  ["dice", "Play, anywhere", "Pick a game and their phone lights up with an invite. Scores, streaks and moments stack up as you go."],
                ] as [IconName, string, string][]
              ).map(([icon, title, body], i) => (
                <li key={title} className="cut bg-[#faf5ec] p-6 text-[#1b1519]">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-marigold">
                      <Icon name={icon} size={24} />
                    </span>
                    <span className="display tabular text-[1.2rem] text-[#6a5a57]">0{i + 1}</span>
                  </div>
                  <h3 className="display mt-5 text-[1.8rem]">{title}</h3>
                  <p className="mt-3 leading-relaxed text-[#57474a]">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Friend rooms */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 max-md:py-16" aria-labelledby="friends">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start max-md:gap-8">
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
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Up to eight", "Everyone gets a seat. Be in up to five friend rooms, plus your couple room."],
                ["The good games", "Whot, Ludo, Ayo, Word Duel, Connect Four, Draw & Guess, riddles and Don't Laugh."],
                ["A group chat", "Voice notes, stickers and trash talk, following you into every game."],
                ["One owner", "Whoever starts the room invites people and can remove them. Nobody else gets a key."],
              ].map(([t, b]) => (
                <div key={t} className="cloth p-5">
                  <h3 className="font-bold">{t}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* After dark keeps its own dark, ember look. */}
        <section className="relative isolate overflow-hidden bg-[#120c0e] text-[#f4e4da]" aria-labelledby="afterdark">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 90% 10%, rgba(232,86,58,.28), transparent 70%), radial-gradient(40% 50% at 0% 100%, rgba(91,26,43,.55), transparent 70%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-8 lg:grid-cols-2 max-md:gap-8 max-md:py-16">
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
            <ul className="cut grid gap-px overflow-hidden border border-[#3d2127] bg-[#3d2127] sm:grid-cols-2">
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
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 max-md:py-16" aria-labelledby="privacy">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] max-md:gap-8">
            <div>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-palm text-[#fff8f0]">
                <Icon name="shield" size={28} />
              </span>
              <h2 id="privacy" className="display mt-5 text-[clamp(2.2rem,5vw,3.4rem)]">
                What happens in the room stays in the room.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Locked to two", "Once your partner joins a couple room, the invite code is retired. No third account can get in, and After Dark never exists in friend rooms."],
                ["Hidden means hidden", "Your hand of cards and sealed answers never even reach your partner's phone until they should."],
                ["Photos stay private", "Memory Lane photos sit in private storage and load through short-lived links."],
                ["Leave cleanly", "Delete your account and everything you wrote goes with it. One button, no email to support."],
              ].map(([t, b]) => (
                <div key={t} className="cloth p-5">
                  <h3 className="font-bold">{t}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call: the same cloth again, with the last word sewn on as a patch. */}
        <section className="relative overflow-hidden">
          <Selvedge words={["TONIGHT'S PLANS", "BEAT THEM AT WHOT"]} />
          <WaxPrint print="record" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
            <div className="cut flex flex-col items-start gap-6 bg-bg p-6 shadow-[0_24px_40px_-22px_rgba(0,0,0,.65)] sm:p-10 md:flex-row md:items-end md:justify-between">
              <h2 className="display max-w-3xl text-[clamp(2.4rem,6.5vw,4.6rem)]">
                Tonight&apos;s plans: <span className="text-accent-ink">beat them at Whot.</span>
              </h2>
              <Link prefetch={false}
                href="/sign-in?intent=create"
                className="cut inline-flex h-14 shrink-0 items-center gap-2 bg-hibiscus px-7 text-[1.05rem] font-semibold text-[#fff8f0] hover:brightness-105"
              >
                Make your room <Icon name="arrowRight" size={20} />
              </Link>
            </div>
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
