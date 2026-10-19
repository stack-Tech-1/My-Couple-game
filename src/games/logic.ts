import type { AnyGameLogic } from "./_engine/types";
import { connectFour } from "./connect-four/logic";

/**
 * Server-safe registry of game logic (no React). The move API and tests use this.
 * Adding a game = one line here + one line in registry.tsx.
 */
const all: AnyGameLogic[] = [connectFour];

export const GAME_LOGIC: Record<string, AnyGameLogic> = Object.fromEntries(all.map((g) => [g.id, g]));

export const isPlayable = (id: string): boolean => id in GAME_LOGIC;