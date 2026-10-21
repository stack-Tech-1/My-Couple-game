"use client";

import Link from "next/link";
import { Icon } from "@/design/icons";
import { CATEGORIES, gameMeta } from "@/games/catalog";
import type { SessionRow } from "@/lib/games/types";

/** Games left mid-way. Shown right under the greeting so nothing gets forgotten. */
export function ActiveGames({ sessions, me }: { sessions: SessionRow[]; me?: string }) {
  // After Dark never shows on the shared dashboard. In a friend room, only games you're in.
  sessions = sessions.filter((s) => gameMeta(s.game_id)?.category !== "spicy" && (!me || s.players.includes(me)));
  if (sessions.length === 0) return null;
  return (
    <section aria-label="Games in progress" className="mt-8 flex gap-3 overflow-x-auto pb-1">
      {sessions.map((s) => {
        const meta = gameMeta(s.game_id);
        if (!meta) return null;
        return (
          <Link prefetch={false}
            key={s.id}
            href={`/room/${s.room_id}/play/${s.id}`}
            className="flex shrink-0 items-center gap-3 rounded-full border-[1.5px] border-line-strong bg-raised py-2 pl-4 pr-2 hover:bg-sunk"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: CATEGORIES[meta.category].color }} aria-hidden />
            <span className="font-semibold">{meta.name}</span>
            <span className="text-[0.85rem] text-muted">in progress</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fg text-bg"><Icon name="arrowRight" size={16} /></span>
          </Link>
        );
      })}
    </section>
  );
}