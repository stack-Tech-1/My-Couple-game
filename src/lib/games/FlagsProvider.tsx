"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { NO_FLAGS, type GameFlags } from "./flags";

const Ctx = createContext<GameFlags>(NO_FLAGS);

export function GameFlagsProvider({ flags, children }: { flags: GameFlags; children: ReactNode }) {
  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>;
}

export function useGameFlags() {
  const flags = useContext(Ctx);
  return useMemo(() => ({ isOff: (id: string) => flags.off.includes(id), isNew: (id: string) => flags.new.includes(id) }), [flags]);
}
