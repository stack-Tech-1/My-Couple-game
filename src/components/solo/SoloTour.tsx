"use client";

import { useCallback } from "react";
import { Spotlight } from "@/design/Spotlight";
import { soloGame } from "@/lib/solo/catalog";
import { markSoloToured } from "@/lib/solo/actions";
import { soloTourFor } from "@/lib/solo/tours";

/** Tours finished on this visit, so one doesn't come back before the page data refreshes. */
const seenThisVisit = new Set<string>();

export const soloTourDue = (gameId: string, toured: boolean) => !!soloTourFor(gameId) && !toured && !seenThisVisit.has(gameId);

/** A Solo game's how-to-play tour. Finishing or skipping both count as seen. */
export function SoloTour({ gameId, onDone }: { gameId: string; onDone: () => void }) {
  const steps = soloTourFor(gameId);
  const finish = useCallback(() => {
    if (!seenThisVisit.has(gameId)) {
      seenThisVisit.add(gameId);
      void markSoloToured(gameId);
    }
    onDone();
  }, [gameId, onDone]);
  if (!steps) return null;
  return <Spotlight steps={steps} onFinish={finish} eyebrow={`How to play ${soloGame(gameId)?.name ?? ""}`.trim()} />;
}
