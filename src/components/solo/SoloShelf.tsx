"use client";

import { AdireFill } from "@/design/adire";
import { useGameFlags } from "@/lib/games/FlagsProvider";
import { SOLO_GAMES, SOLO_LOOK } from "@/lib/solo/catalog";
import { SoloCard } from "./SoloCard";

/** The Games tab's first shelf: Solo games, free for everyone, no partner needed. */
export function SoloShelf() {
  const { isOff, isNew } = useGameFlags();
  const games = SOLO_GAMES.filter((g) => g.kind !== "bot" && !isOff(g.id));
  const bots = SOLO_GAMES.filter((g) => g.kind === "bot" && !isOff(g.id));
  return (
    <section aria-labelledby="shelf-solo-h" id="shelf-solo" className="scroll-mt-24">
      <div className="relative overflow-hidden rounded-[20px] px-5 py-4 text-[#2a1a05]">
        <AdireFill motif={SOLO_LOOK.motif} bg={SOLO_LOOK.bg} ink={SOLO_LOOK.ink} />
        <div className="relative">
          <div className="flex items-baseline justify-between gap-4">
            <h3 id="shelf-solo-h" className="display text-[clamp(1.6rem,6vw,2rem)] leading-tight">On your own</h3>
            <span className="text-[0.85rem] font-extrabold">Free</span>
          </div>
          <p className="mt-0.5 text-[0.92rem] font-semibold">Quick games, no partner needed. Beat your best.</p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {games.map((g) => (
          <li key={g.id}>
            <SoloCard game={g} tag={g.kind === "daily" || g.id === "fix-am" ? "Daily" : isNew(g.id) ? "New" : undefined} />
          </li>
        ))}
      </ul>
      {bots.length ? (
        <>
          <h4 className="display mt-6 text-[1.3rem]">Play the bot</h4>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {bots.map((g) => (
              <li key={g.id}>
                <SoloCard game={g} size="small" note="vs the bot" />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
