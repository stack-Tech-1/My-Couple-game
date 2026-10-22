"use client";

import { useCallback, useEffect, useState } from "react";
import { Spotlight } from "@/design/Spotlight";
import { gameMeta } from "@/games/catalog";
import { tourFor } from "@/games/tours";
import { markGameToured } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";

/** Tours finished on this visit, so one doesn't come back before the room data refreshes. */
const seenThisVisit = new Set<string>();

/** True when this game has a tour this person (`toured`: their finished tours) hasn't been through. */
export const isTourDue = (gameId: string, toured: string[] | undefined) => !!tourFor(gameId) && !seenThisVisit.has(gameId) && !(toured ?? []).includes(gameId);

export function useTourDue(gameId: string): boolean {
  const { bundle } = useRoom();
  return isTourDue(gameId, bundle.me.profile.toured_games);
}

/**
 * A game's how-to-play tour. While it's open, everyone in the game (`sessionId`) hears that you're
 * reading, so nobody wonders why you haven't moved. Finishing or skipping both count as seen.
 */
export function GameTour({ gameId, sessionId, onDone }: { gameId: string; sessionId?: string; onDone: () => void }) {
  const { send } = useRoom();
  const steps = tourFor(gameId);

  useEffect(() => {
    if (!sessionId) return;
    const ping = (on: boolean) => send("game:reading", { sessionId, on });
    ping(true);
    // Repeated so someone who opens the game a moment later still hears it.
    const t = setInterval(() => ping(true), 4000);
    return () => {
      clearInterval(t);
      ping(false);
    };
  }, [sessionId, send]);

  const finish = useCallback(() => {
    if (!seenThisVisit.has(gameId)) {
      seenThisVisit.add(gameId);
      void markGameToured(gameId);
    }
    onDone();
  }, [gameId, onDone]);

  if (!steps) return null;
  return <Spotlight steps={steps} onFinish={finish} eyebrow={`How to play ${gameMeta(gameId)?.name ?? ""}`.trim()} />;
}

/** Who else in this game is reading how to play right now (their pings go quiet when they stop). */
export function useReaders(sessionId: string): string[] {
  const { on } = useRoom();
  const [readers, setReaders] = useState<Record<string, number>>({});

  useEffect(
    () =>
      on("game:reading", (raw, from) => {
        const p = raw as { sessionId?: unknown; on?: unknown } | null;
        if (!p || p.sessionId !== sessionId) return;
        setReaders((r) => {
          const next = { ...r };
          if (p.on === true) next[from] = Date.now() + 10_000;
          else delete next[from];
          return next;
        });
      }),
    [on, sessionId],
  );

  // A dropped "done" ping (closed tab, lost signal) expires on its own.
  const any = Object.keys(readers).length > 0;
  useEffect(() => {
    if (!any) return;
    const t = setInterval(() => {
      setReaders((r) => {
        const now = Date.now();
        const live = Object.entries(r).filter(([, until]) => until > now);
        return live.length === Object.keys(r).length ? r : Object.fromEntries(live);
      });
    }, 2000);
    return () => clearInterval(t);
  }, [any]);

  return Object.keys(readers);
}
