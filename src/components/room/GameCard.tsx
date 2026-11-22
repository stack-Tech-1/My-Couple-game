"use client";

import Link from "next/link";
import { AdireFill } from "@/design/adire";
import { Icon } from "@/design/icons";
import type { GameMeta } from "@/games/catalog";
import { GameArt } from "@/games/GameArt";
import { lookFor } from "@/games/look";
import { cn } from "@/lib/cn";
import { PlusTag } from "@/components/plus/PlusTag";

/**
 * A game on the shelf: a plain cut of its section's colour (two shades, so a shelf doesn't read
 * as one block), the drawing on a light patch so its lines stay clear, and the name on a calico
 * strip. No pattern: the page's one print lives at the top.
 */
export function GameCard({ game, roomId, fresh, plus, usedUp, size = "normal" }: { game: GameMeta; roomId: string; fresh?: boolean; plus?: boolean; usedUp?: boolean; size?: "normal" | "large" | "peek" }) {
  const look = lookFor(game.id, game.category);
  const large = size === "large";
  return (
    <Link
      prefetch={false}
      href={`/room/${roomId}/games/${game.id}`}
      className={cn(
        "cut group relative flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5",
        size === "peek" ? "h-40 w-36 shrink-0" : large ? "min-h-64 h-full" : "h-full min-h-48",
      )}
      style={{ color: "#1c1416", ["--bg-raised" as string]: "#fbf7f1" }}
    >
      <AdireFill motif={look.motif} bg={look.bg} ink={look.ink} />
      <div className={cn("relative flex flex-1 items-center justify-center", large ? "pb-24 pt-6" : size === "peek" ? "pb-14 pt-3" : "pb-16 pt-4")}>
        <GameArt id={game.id} accent={look.accent} className={cn("relative w-auto transition-transform duration-300 group-hover:scale-[1.05]", large ? "h-32" : size === "peek" ? "h-16" : "h-20")} />
      </div>
      {plus ? <PlusTag className="absolute left-2.5 top-2.5" /> : null}
      {usedUp ? (
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#1c1416] px-2 py-0.5 text-[0.68rem] font-bold text-[#fbf7f1]">
          <Icon name="moon" size={10} /> Back at midnight
        </span>
      ) : fresh ? (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-[#1c1416] px-2 py-0.5 text-[0.68rem] font-bold text-[#fbf7f1]">New</span>
      ) : null}
      {/* The name on a calico strip, the same light colour by day and night. */}
      <div className="cut-sm absolute inset-x-2 bottom-2 bg-[#fbf7f1] px-3 py-2">
        <p className={cn("font-bold leading-tight", large ? "display text-[1.5rem] font-normal" : "text-[0.92rem]")}>{game.name}</p>
        {large ? <p className="mt-0.5 line-clamp-2 text-[0.82rem] text-[#57474a]">{game.tagline}</p> : null}
        <p className="mt-0.5 flex items-center gap-1 text-[0.74rem] text-[#57474a]">
          <Icon name="clock" size={11} /> {game.estimatedMinutes} min{game.maxPlayers && game.maxPlayers > 2 ? ` · up to ${game.maxPlayers}` : ""}
        </p>
      </div>
    </Link>
  );
}
