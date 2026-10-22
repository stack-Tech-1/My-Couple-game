"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { gameComponent } from "@/games/registry";
import { GAME_LOGIC } from "@/games/logic";
import { runMove } from "@/games/_engine/runner";
import type { Players } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { GAME_MODES } from "@/games/modes";

const PLAYERS: Players = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b"];
const NAMES = { [PLAYERS[0]]: "Ada", [PLAYERS[1]]: "Bo" };

export function Sandbox({ gameId }: { gameId: string }) {
  const logic = GAME_LOGIC[gameId]!;
  const Component = gameComponent(gameId)!;
  const [seed, setSeed] = useState("sandbox");
  // Same default as the start screen: the first mode, if the game has modes.
  const mode = GAME_MODES[gameId];
  const config = mode ? { [mode.key]: mode.options[0]!.value } : {};
  const [state, setStateRaw] = useState<unknown>(() => logic.initialState("sandbox", PLAYERS, config, { now: Date.now() }));
  // Mirror of the latest state so moves are judged outside React's render cycle.
  const live = useRef(state);
  const setState = useCallback((s: unknown) => {
    live.current = s;
    setStateRaw(s);
  }, []);
  const listeners = useRef(new Map<string, Set<(p: unknown) => void>>());

  const reset = () => {
    const s = Math.random().toString(36).slice(2);
    setSeed(s);
    setState(logic.initialState(s, PLAYERS, config, { now: Date.now() }));
  };

  const sendFor = useCallback(
    (by: string) => async (move: unknown, opts?: { silent?: boolean }) => {
      try {
        setState(runMove(logic, live.current, move, by, { now: Date.now() }).next);
      } catch (e) {
        console.warn(`[sandbox] ${by} move rejected:`, JSON.stringify(move), e instanceof Error ? e.message : e);
        if (!opts?.silent) toast.error(e instanceof Error ? e.message : "rejected");
        throw e;
      }
    },
    [logic, setState],
  );

  const broadcast = useMemo(
    () => ({
      send: (event: string, payload: unknown) => listeners.current.get(event)?.forEach((h) => h(payload)),
      on: (event: string, h: (p: unknown) => void) => {
        const set = listeners.current.get(event) ?? new Set();
        set.add(h);
        listeners.current.set(event, set);
        return () => void set.delete(h);
      },
    }),
    [],
  );

  const outcome = logic.isOver(state);

  return (
    <div className="relative z-[1] px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <p className="eyebrow text-muted">Sandbox · {gameId} · seed {seed} · {outcome.over ? "over" : "live"}</p>
        <Button size="sm" variant="outline" onClick={reset}>New game</Button>
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        {PLAYERS.map((p) => (
          <section key={p} data-seat={NAMES[p]} className="@container rounded-[18px] border border-line p-4">
            <p className="eyebrow mb-4 text-muted">Seat: {NAMES[p]}</p>
            <Component
              view={logic.viewFor(state, p)}
              me={p}
              partner={PLAYERS.find((x) => x !== p)!}
              names={NAMES}
              sendMove={sendFor(p)}
              pending={false}
              broadcast={broadcast}
              sound={() => {}}
              clock={Date.now}
            />
          </section>
        ))}
      </div>
    </div>
  );
}