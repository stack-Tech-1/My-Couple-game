"use client";

import Link from "next/link";
import { useMemo } from "react";
import { GAMES, isFriendGame } from "@/games/catalog";
import { useGameFlags } from "@/lib/games/FlagsProvider";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { GameCard } from "./GameCard";
import { isPlusGame } from "@/lib/plus/plans";
import { AfterDarkPanel } from "./Library";

/** Phones: a swipeable row of games on the home page; the whole shelf is one tap away. */
export function GamesPeek() {
  const { bundle } = useRoom();
  const { isOff, isNew } = useGameFlags();
  const friendsRoom = bundle.room.kind === "friends";
  const games = useMemo(() => {
    const list = GAMES.filter((g) => g.category !== "spicy" && !isOff(g.id) && (friendsRoom ? isFriendGame(g.id) : !g.friendsOnly));
    // New games first, then the shelf order.
    return [...list.filter((g) => isNew(g.id)), ...list.filter((g) => !isNew(g.id))];
  }, [isOff, isNew, friendsRoom]);

  return (
    <section aria-labelledby="peek-h" className="sm:hidden">
      <div className="flex items-baseline justify-between">
        <h2 id="peek-h" data-tour="library" className="display text-[1.6rem]">Games</h2>
        <Link prefetch={false} href={`/room/${bundle.room.id}/games`} className="text-[0.88rem] font-bold text-accent-ink">
          See all {games.length}
        </Link>
      </div>
      <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {games.slice(0, 10).map((g) => (
          <GameCard key={g.id} game={g} roomId={bundle.room.id} size="peek" fresh={isNew(g.id)} plus={bundle.plus.live && isPlusGame(g.id)} />
        ))}
      </div>
      {/* The full shelf is in the Games tab; After Dark's door stays on the home screen. */}
      <div className="mt-8">
        <AfterDarkPanel />
      </div>
    </section>
  );
}
