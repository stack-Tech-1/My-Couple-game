import Link from "next/link";
import { AdireFill } from "@/design/adire";
import { Icon } from "@/design/icons";
import { PageBackdrop } from "@/components/room/HomeBackdrop";
import { SoloCard } from "@/components/solo/SoloCard";
import { SOLO_GAMES, SOLO_LOOK, formatScore, soloGame } from "@/lib/solo/catalog";
import { soloContext } from "@/lib/solo/context";
import { incomingChallenges, myBests } from "@/lib/solo/server";
import { getGameFlags } from "@/lib/games/flags.server";
import { soloFreePlaysAll } from "@/lib/plus/limits";
import { freePlaysFor } from "@/lib/plus/plans";

export default async function SoloHome() {
  const ctx = await soloContext();
  const [bests, challenges, flags, plays] = await Promise.all([myBests(ctx.user.id), incomingChallenges(ctx.user.id), getGameFlags(), soloFreePlaysAll(ctx.user.id)]);
  // Without Plus: each game twice a day. A used-up game says so on its card.
  const usedUp = (id: string) => plays.limited && id !== "oro" && (plays.used[id] ?? 0) >= freePlaysFor(id);
  const tagFor = (id: string, otherwise?: string) => (usedUp(id) ? "Back at midnight" : otherwise);
  const live = SOLO_GAMES.filter((g) => !flags.off.includes(g.id));
  const bestOf = (id: string, mode = "normal") => bests.find((b) => b.gameId === id && b.mode === mode);
  const note = (id: string) => {
    const g = soloGame(id)!;
    const b = g.kind === "bot" ? undefined : bestOf(id);
    return b ? `Best ${formatScore(g, b.best)}` : undefined;
  };
  // Arcade games, plus puzzles that aren't daily (Zobo Sort).
  const arcade = live.filter((g) => g.kind === "arcade" || (g.kind === "puzzle" && g.id !== "fix-am"));
  const bots = live.filter((g) => g.kind === "bot");
  const oro = live.find((g) => g.id === "oro");
  const fix = live.find((g) => g.id === "fix-am");

  return (
    <div className="relative isolate pt-8">
      <PageBackdrop motif={SOLO_LOOK.motif} bg={SOLO_LOOK.bg} ink={SOLO_LOOK.ink} glow={SOLO_LOOK.glow} height={420} />
      <div className="relative overflow-hidden rounded-[24px] px-5 py-5 text-[#2a1a05] sm:mt-2">
        <AdireFill motif={SOLO_LOOK.motif} bg={SOLO_LOOK.bg} ink={SOLO_LOOK.ink} />
        <div className="relative">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="display text-[clamp(2.2rem,8vw,3rem)] leading-none">On your own</h1>
            <span className="text-[0.85rem] font-extrabold">Free</span>
          </div>
          <p className="mt-1.5 font-semibold">Quick games, no partner needed. Beat your best, then beat your friends.</p>
          {plays.limited ? <p className="mt-1 text-[0.85rem] font-semibold opacity-80">Every game is free twice a day, and Zobo Sort gives one free level a day. Challenges and today&apos;s word are always open.</p> : null}
        </div>
      </div>

      {challenges.length ? (
        <section aria-labelledby="ch-h" className="mt-6">
          <h2 id="ch-h" className="display text-[1.5rem]">Challenges for you</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {challenges.map((c) => {
              const g = soloGame(c.gameId)!;
              return (
                <li key={c.token}>
                  <Link prefetch={false} href={`/solo/${g.id}?challenge=${c.token}`} className="glass flex items-center gap-3 rounded-[18px] px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{c.fromName} challenged you</span>
                      <span className="block text-[0.85rem] text-muted">Beat {formatScore(g, c.target)} in {g.name}</span>
                    </span>
                    <span className="rounded-full bg-[#1c1416] px-3.5 py-1.5 text-[0.85rem] font-bold text-[#f6efe6]">Play</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {oro || fix ? (
        <section aria-labelledby="today-h" className="mt-8">
          <h2 id="today-h" className="display text-[1.5rem]">Today</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {oro ? <SoloCard game={oro} note={new Date(Date.now() + 3600_000).getUTCDay() === 5 ? "Friday: a Naija word" : "One word, six guesses"} tag="Daily" /> : null}
            {fix ? <SoloCard game={fix} note="Today's picture" tag={tagFor(fix.id, "Daily")} /> : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="arcade-h" className="mt-8">
        <h2 id="arcade-h" className="display text-[1.5rem]">Arcade</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {arcade.map((g) => (
            <li key={g.id}>
              <SoloCard game={g} note={note(g.id)} tag={tagFor(g.id)} />
            </li>
          ))}
        </ul>
      </section>

      {bots.length ? (
        <section aria-labelledby="bots-h" className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 id="bots-h" className="display text-[1.5rem]">Play the bot</h2>
            <span className="text-[0.85rem] text-muted">Never counts towards your scores with people</span>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {bots.map((g) => (
              <li key={g.id}>
                <SoloCard game={g} size="small" note={usedUp(g.id) ? "Back at midnight" : "vs the bot"} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!ctx.rooms.length ? (
        <section aria-labelledby="rooms-h" className="mt-10">
          <h2 id="rooms-h" className="display text-[1.5rem]">Play with people too</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Link prefetch={false} href="/onboarding?step=room" className="glass flex items-center gap-3 rounded-[20px] p-4">
              <Icon name="heart" size={22} className="text-accent" />
              <span className="flex-1">
                <span className="block font-bold">Invite your person</span>
                <span className="block text-[0.85rem] text-muted">A couple room, just for the two of you</span>
              </span>
            </Link>
            <Link prefetch={false} href="/room/new" className="glass flex items-center gap-3 rounded-[20px] p-4">
              <Icon name="user" size={22} />
              <span className="flex-1">
                <span className="block font-bold">Start a friend room</span>
                <span className="block text-[0.85rem] text-muted">Up to 8 friends, Whot, Ludo and more</span>
              </span>
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
