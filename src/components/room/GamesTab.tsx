"use client";

import { CATEGORIES, CATEGORY_ORDER, gamesIn, isFriendGame } from "@/games/catalog";
import { useGameFlags } from "@/lib/games/FlagsProvider";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { Library } from "./Library";

/** The Games tab: a chip per mood that jumps to its shelf, then every shelf. */
export function GamesTab() {
  const { bundle } = useRoom();
  const { isOff } = useGameFlags();
  const friendsRoom = bundle.room.kind === "friends";
  const moods = CATEGORY_ORDER.filter(
    (c) => c !== "spicy" && gamesIn(c).some((g) => !isOff(g.id) && (friendsRoom ? isFriendGame(g.id) : !g.friendsOnly)),
  );

  return (
    <div className="pt-6 sm:pt-10">
      <h1 className="display text-[clamp(2.4rem,9vw,3.6rem)]">Games</h1>
      <nav aria-label="Jump to a mood" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {moods.map((c) => (
          <a key={c} href={`#shelf-${c}`} className="glass shrink-0 rounded-full px-4 py-2 text-[0.88rem] font-bold">
            {CATEGORIES[c].label}
          </a>
        ))}
      </nav>
      <div className="mt-6">
        <Library heading={false} />
      </div>
    </div>
  );
}
