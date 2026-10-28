"use client";

import { AdireFill } from "@/design/adire";
import type { GameCategory } from "@/games/catalog";
import { lookFor } from "@/games/look";

/**
 * Behind a game: its own colour and adire motif fill the screen, softened by a veil of the page
 * colour so the board on its glass panel stays the thing you look at.
 */
export function GameBackdrop({ gameId, category }: { gameId: string; category: GameCategory }) {
  const look = lookFor(gameId, category);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <AdireFill motif={look.motif} bg={look.bg} ink={look.ink} scale={1.15} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 30%, transparent), color-mix(in srgb, var(--bg) 55%, transparent))" }} />
    </div>
  );
}
