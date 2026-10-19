import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";

export const MAX_ROUNDS = 10;

export type InSyncState = {
  players: Players;
  round: number;
  words: Record<PlayerId, string | null>;
  /** Revealed pairs, in players order. */
  history: [string, string][];
  result: "win" | "loss" | null;
};
export type InSyncMove = { word: string };
export type InSyncView = {
  players: Players;
  me: PlayerId;
  round: number;
  mine: string | null;
  partnerLockedIn: boolean;
  history: { mine: string; theirs: string }[];
  result: "win" | "loss" | null;
};

const moveSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[\p{L}\p{N}' -]+$/u),
});

export const same = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const x = n(a);
  const y = n(b);
  // Forgive a trailing plural: "cat" and "cats" are in sync.
  return x === y || x === `${y}s` || y === `${x}s`;
};

export const inSync: GameLogic<InSyncState, InSyncMove, InSyncView> = {
  id: "in-sync",
  category: "coop",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 5,
  moveSchema,
  rules: {
    summary: "Say the same word at the same time. Sounds easy. It isn't.",
    sections: [
      { title: "Round one", body: ["You each type any word at all, secretly. Then both are revealed."] },
      { title: "Every round after", body: ["Look at the two words you just said. Each think of one word that connects them, and lock it in.", "Keep going until you say the same thing."] },
      { title: "Winning", body: ["Match within ten rounds and you're officially on the same wavelength."] },
    ],
  },

  initialState(_seed, players) {
    return { players, round: 1, words: { [players[0]]: null, [players[1]]: null }, history: [], result: null };
  },

  validateMove(s, _move, by) {
    return !s.result && s.words[by] === null;
  },

  applyMove(s, move, by) {
    const words = { ...s.words, [by]: move.word.trim() };
    const [a, b] = s.players;
    if (words[a] === null || words[b] === null) return { ...s, words };
    const pair: [string, string] = [words[a]!, words[b]!];
    const history = [...s.history, pair];
    if (same(pair[0], pair[1])) return { ...s, words, history, result: "win" };
    if (s.round >= MAX_ROUNDS) return { ...s, words, history, result: "loss" };
    return { ...s, history, round: s.round + 1, words: { [a]: null, [b]: null } };
  },

  isOver(s): Outcome {
    return s.result ? { over: true, coop: s.result } : { over: false };
  },

  viewFor(s, player) {
    const mi = s.players[0] === player ? 0 : 1;
    const partner = s.players[1 - mi]!;
    return {
      players: s.players,
      me: player,
      round: s.round,
      mine: s.words[player] ?? null,
      partnerLockedIn: s.words[partner] !== null && !s.result,
      history: s.history.map((p) => ({ mine: p[mi]!, theirs: p[1 - mi]! })),
      result: s.result,
    };
  },
};
