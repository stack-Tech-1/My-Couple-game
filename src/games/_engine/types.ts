import type { ComponentType } from "react";
import type { z } from "zod";
import type { GameCategory } from "@/games/catalog";

export type PlayerId = string;
export type Players = readonly [PlayerId, PlayerId];

export type Outcome =
  | { over: false }
  | { over: true; winner: PlayerId | "tie" }
  | { over: true; coop: "win" | "loss" };

/** Facts the server supplies to keep logic pure: the clock is an input, never read inside. */
export type MoveContext = { now: number };

export type Rules = {
  summary: string;
  sections: { title: string; body: string[] }[];
};

/**
 * The pure, server-safe half of a game. No React, no I/O. The server imports
 * this to validate and apply moves; tests import it directly.
 */
export interface GameLogic<State, Move, View = unknown, Config = Record<string, never>> {
  id: string;
  category: GameCategory;
  minPlayers: 2;
  maxPlayers: 2;
  estimatedMinutes: number;
  rules: Rules;
  /** Zod schema every incoming move is parsed with before anything else happens. */
  moveSchema: z.ZodType<Move>;
  configSchema?: z.ZodType<Config>;
  initialState(seed: string, players: Players, config: Config, ctx: MoveContext): State;
  validateMove(state: State, move: Move, by: PlayerId, ctx: MoveContext): boolean;
  applyMove(state: State, move: Move, by: PlayerId, ctx: MoveContext): State;
  isOver(state: State): Outcome;
  /** Projection for one player. Must strip anything that player shouldn't know. */
  viewFor(state: State, player: PlayerId): View;
}

// Erased form used by registries, where each game's types differ.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry; each module is fully typed at its definition
export type AnyGameLogic = GameLogic<any, any, any, any>;

export type GameProps<View, Move> = {
  view: View;
  me: PlayerId;
  partner: PlayerId;
  names: Record<PlayerId, string>;
  /** Sends a move to the server. Resolves once it is committed (or rejects with a friendly message). */
  sendMove: (move: Move) => Promise<void>;
  /** True while a move is in flight. */
  pending: boolean;
  /** Low-latency side channel scoped to this session (strokes, typing, etc). */
  broadcast: {
    send: (event: string, payload: unknown) => void;
    on: (event: string, handler: (payload: unknown) => void) => () => void;
  };
  sound: (name: SoundName) => void;
};

export type SoundName = "tap" | "drop" | "flip" | "roll" | "win" | "lose" | "tick" | "invite";

/** The full module: logic plus its client component. */
export interface GameModule<State, Move, View = unknown, Config = Record<string, never>>
  extends GameLogic<State, Move, View, Config> {
  Component: ComponentType<GameProps<View, Move>>;
}