"use client";

import type { ComponentType } from "react";
import type { GameProps } from "./_engine/types";
import { GAME_LOGIC } from "./logic";
import { ConnectFourBoard } from "./connect-four/Board";

/**
 * Client registry: game id -> component. Logic comes from the server-safe
 * GAME_LOGIC registry so the two halves can never drift apart.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry, each component is typed at its definition
const components: Record<string, ComponentType<GameProps<any, any>>> = {
  "connect-four": ConnectFourBoard,
};

export function gameComponent(id: string) {
  return GAME_LOGIC[id] ? components[id] : undefined;
}