"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { CATEGORIES, GAMES } from "@/games/catalog";
import { GameArt } from "@/games/GameArt";
import { useGameFlags } from "@/lib/games/FlagsProvider";

/** A featured pick that rotates daily, so the dashboard always suggests something. */
export function PlayNext() {
  const { bundle } = useRoom();
  const { isOff } = useGameFlags();
  const game = useMemo(() => {
    const all = GAMES.filter((g) => g.category !== "spicy" && g.scored);
    const on = all.filter((g) => !isOff(g.id));
    const pool = on.length ? on : all;
    const day = Math.floor(Date.now() / 86_400_000);
    return pool[day % pool.length]!;
  }, [isOff]);
  const cat = CATEGORIES[game.category];

  return (
    <section aria-labelledby="playnext" className="relative overflow-hidden rounded-[22px] border-[1.5px] border-line-strong bg-raised">
      <div className="flex items-start justify-between p-6 pb-0">
        <p id="playnext" className="eyebrow" style={{ color: cat.ink }}>Tonight&apos;s pick · {cat.label}</p>
        <span className="flex items-center gap-1 text-[0.8rem] text-muted">
          <Icon name="clock" size={14} /> ~{game.estimatedMinutes} min
        </span>
      </div>
      <div className="px-6 text-fg">
        <GameArt id={game.id} accent={cat.color} className="mx-auto h-36 w-auto" />
      </div>
      <div className="flex items-end justify-between gap-4 p-6 pt-2">
        <div>
          <h3 className="display text-[2.2rem]">{game.name}</h3>
          <p className="mt-1 text-muted">{game.tagline}</p>
        </div>
        <Link prefetch={false}
          href={`/room/${bundle.room.id}/games/${game.id}`}
          aria-label={`Play ${game.name}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-transform hover:scale-105"
        >
          <Icon name="arrowRight" size={24} />
        </Link>
      </div>
    </section>
  );
}