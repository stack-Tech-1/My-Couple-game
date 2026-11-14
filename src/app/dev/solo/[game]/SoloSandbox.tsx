"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { playSound } from "@/lib/sound";
import { formatScore, soloGame } from "@/lib/solo/catalog";
import type { SoloApi } from "@/components/solo/SoloShell";
import { UPGRADES } from "@/lib/solo/games/mama";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each game types its own state
type AnyApi = SoloApi<any>;
const games: Record<string, React.ComponentType<{ api: AnyApi }>> = {
  "pump-am": dynamic(() => import("@/components/solo/games/PumpAm").then((m) => m.PumpAm), { ssr: false }),
  "zobo-sort": dynamic(() => import("@/components/solo/games/ZoboSort").then((m) => m.ZoboSort), { ssr: false }),
  "catch-am": dynamic(() => import("@/components/solo/games/CatchAm").then((m) => m.CatchAm), { ssr: false }),
  "mosquito-wahala": dynamic(() => import("@/components/solo/games/MosquitoWahala").then((m) => m.MosquitoWahala), { ssr: false }),
  "mama-put": dynamic(() => import("@/components/solo/games/MamaPut").then((m) => m.MamaPut), { ssr: false }),
  "bash-am": dynamic(() => import("@/components/solo/games/BashAm").then((m) => m.BashAm), { ssr: false }),
};

/** Runs a game with a stand-in frame: nothing is saved, the score just shows. */
export function SoloSandbox({ gameId }: { gameId: string }) {
  const game = soloGame(gameId)!;
  const [round, setRound] = useState(0);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  // ?mode=hard or ?mode=day-12 tries a difficulty or career day.
  const q = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const mode = q.get("mode") ?? "normal";
  // ?shop=fan,tv or ?shop=all tries Mama Put's upgrades.
  const shop = q.get("shop") ?? "";
  const api = useMemo<AnyApi>(
    () => ({ seed: `sandbox-${round}`, mode, extras: { owned: shop === "all" ? UPGRADES.map((u) => u.id) : shop.split(",").filter(Boolean) }, saved: null, paused, save: () => {}, end: (s) => setScore(s), sound: (n) => playSound(n), target: null }),
    [round, paused, mode, shop],
  );
  const Game = games[gameId];
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="display text-[2rem]">{game.name}</h1>
        <div className="flex gap-2">
          <button type="button" className="glass rounded-full px-3 py-1.5 text-[0.85rem] font-semibold" onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</button>
          <button type="button" className="glass rounded-full px-3 py-1.5 text-[0.85rem] font-semibold" onClick={() => { setScore(null); setRound((r) => r + 1); }}>Restart</button>
        </div>
      </div>
      <p className="mb-3 text-muted">{game.tagline}</p>
      {score !== null ? <p className="glass mb-3 rounded-[16px] p-3 text-center font-semibold">Game over: {formatScore(game, score)}</p> : null}
      {Game ? <Game key={round} api={api} /> : <p>No sandbox for this game yet.</p>}
    </div>
  );
}
