"use client";

import Link from "next/link";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { CATEGORIES, CATEGORY_ORDER, gamesIn, isFriendGame } from "@/games/catalog";
import { cn } from "@/lib/cn";
import { afterDarkOpen } from "@/lib/room/afterDark";
import { useGameFlags } from "@/lib/games/FlagsProvider";
import { CATEGORY_LOOKS } from "@/games/look";
import { SECTION_CLOTH } from "@/design/wax";
import { GameCard } from "./GameCard";
import { FREE_PLAYS_PER_DAY, isPlusGame } from "@/lib/plus/plans";

export function Library({ heading = true }: { heading?: boolean }) {
  const { bundle } = useRoom();
  const spicyOpen = afterDarkOpen(bundle);
  const { isOff, isNew } = useGameFlags();
  const friendsRoom = bundle.room.kind === "friends";

  return (
    <section aria-labelledby="library-h">
      <h2 id="library-h" data-tour="library" className={heading ? "eyebrow border-t-[1.5px] border-line-strong pt-5 text-muted" : "sr-only"}>The library</h2>
      <div className="mt-6 space-y-14">
        {CATEGORY_ORDER.map((c) => {
          const cat = CATEGORIES[c];
          const games = gamesIn(c).filter((g) => !isOff(g.id) && (friendsRoom ? isFriendGame(g.id) : !g.friendsOnly));
          // Friend rooms never mention After Dark.
          if (friendsRoom && c === "spicy") return null;
          // Discretion: After Dark is one panel on the shared home screen, never a list of its games.
          if (!games.length && c !== "spicy") return null;
          if (c === "spicy") return <AfterDarkEntry key={c} roomId={bundle.room.id} open={spicyOpen} />;
          return (
            <div key={c} id={`shelf-${c}`} className="scroll-mt-24">
              <CategoryBanner category={c} label={cat.label} count={games.length} blurb={friendsRoom && c === "competitive" ? "Loser buys the next round of suya." : cat.blurb} />
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {games.map((g, i) => (
                  <li key={g.id} className={cn(i === 0 && "col-span-2 sm:col-span-1 sm:row-span-2")}>
                    <GameCard game={g} roomId={bundle.room.id} size={i === 0 ? "large" : "normal"} fresh={isNew(g.id)} plus={bundle.plus.live && isPlusGame(g.id)} usedUp={(bundle.freePlays?.used[g.id] ?? 0) >= FREE_PLAYS_PER_DAY} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A shelf banner: a plain cut of the section's colour. */
function CategoryBanner({ category, label, count, blurb }: { category: keyof typeof CATEGORY_LOOKS; label: string; count: number; blurb: string }) {
  const cloth = SECTION_CLOTH[category];
  return (
    <div className="cut relative overflow-hidden px-5 py-4" style={{ background: cloth.fill, color: cloth.ink }}>
      <div className="relative">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="display text-[clamp(1.6rem,6vw,2rem)] leading-tight">{label}</h3>
          <span className="tabular shrink-0 text-[0.85rem] font-semibold opacity-80">{count} games</span>
        </div>
        <p className="mt-0.5 text-[0.92rem] font-medium opacity-85">{blurb}</p>
      </div>
    </div>
  );
}

/** The After Dark door: one panel, never a list of its games. Couple rooms only. */
export function AfterDarkPanel() {
  const { bundle } = useRoom();
  if (bundle.room.kind === "friends") return null;
  return <AfterDarkEntry roomId={bundle.room.id} open={afterDarkOpen(bundle)} />;
}

function AfterDarkEntry({ roomId, open }: { roomId: string; open: boolean }) {
  return (
    <div className="cut relative overflow-hidden bg-[#120c0e] p-7 text-[#f4e4da]">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 80% at 100% 0%, rgba(232,86,58,.3), transparent 70%)" }} />
      <div className="relative">
        <Icon name={open ? "flame" : "lock"} size={26} className="text-[#ff8a6e]" />
        <h3 className="display mt-4 text-[2rem]">{open ? "After dark." : "After dark is locked."}</h3>
        <p className="mt-2 max-w-md text-[#c9b0a7]">
          {open
            ? "Behind your PIN. Lights down, phones close."
            : "Five 18+ games for the two of you. It opens only when you’ve both confirmed your age and both said yes. Either of you can close it again anytime."}
        </p>
        <Link prefetch={false} href={`/room/${roomId}/after-dark`} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-[#f4e4da] px-5 text-[0.95rem] font-semibold hover:bg-[#f4e4da] hover:text-[#120c0e]">
          {open ? "Go in" : "See how it works"} <Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </div>
  );
}