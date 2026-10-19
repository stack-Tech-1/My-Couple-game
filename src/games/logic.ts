import type { AnyGameLogic } from "./_engine/types";
import { connectFour } from "./connect-four/logic";
import { whot } from "./whot/logic";
import { ludo } from "./ludo/logic";
import { ayo } from "./ayo/logic";
import { wordDuel } from "./word-duel/logic";
import { reflexDuel } from "./reflex-duel/logic";
import { drawGuess } from "./draw-guess/logic";
import { knowMeTrivia } from "./know-me-trivia/logic";

/**
 * Server-safe registry of game logic (no React). The move API and tests use this.
 * Adding a game = one line here + one line in registry.tsx.
 */
const all: AnyGameLogic[] = [connectFour, whot, ludo, ayo, wordDuel, reflexDuel, drawGuess, knowMeTrivia];

export const GAME_LOGIC: Record<string, AnyGameLogic> = Object.fromEntries(all.map((g) => [g.id, g]));

export const isPlayable = (id: string): boolean => id in GAME_LOGIC;