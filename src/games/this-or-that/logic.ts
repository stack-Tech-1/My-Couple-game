import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { THIS_OR_THAT } from "@/content/personal";

export const COUNT = 12;
export type ToTPick = 0 | 1 | null;
export type ToTState = { players: Players; pairs: number[]; picks: Record<PlayerId, ToTPick[]>; done: boolean };
export type ToTMove = { index: number; pick: ToTPick };
export type ToTView = {
  players: Players;
  me: PlayerId;
  pairs: [string, string][];
  mine: ToTPick[];
  partnerProgress: number;
  theirs: ToTPick[] | null;
  matches: number | null;
  done: boolean;
};

const moveSchema = z.object({ index: z.number().int().min(0).max(COUNT - 1), pick: z.union([z.literal(0), z.literal(1), z.null()]) });

export const thisOrThat: GameLogic<ToTState, ToTMove, ToTView> = {
  id: "this-or-that",
  category: "personal",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 4,
  moveSchema,
  rules: {
    summary: "Twelve quick choices. Don't overthink it. Then see where you matched.",
    sections: [
      { title: "Rapid fire", body: ["Five seconds a card. Pick one side. Out of time? It's skipped, no harm done."] },
      { title: "The reveal", body: ["When you've both finished, you'll see every pick side by side, and how in tune you are."] },
    ],
  },

  initialState(seed, players) {
    const pairs = shuffle(THIS_OR_THAT.map((_, i) => i), makeRng(seed)).slice(0, COUNT);
    return { players, pairs, picks: { [players[0]]: [], [players[1]]: [] }, done: false };
  },

  validateMove(s, move, by) {
    return !s.done && move.index === s.picks[by]!.length;
  },

  applyMove(s, move, by) {
    const picks = { ...s.picks, [by]: [...s.picks[by]!, move.pick] };
    return { ...s, picks, done: s.players.every((p) => picks[p]!.length === COUNT) };
  },

  isOver(s): Outcome {
    return s.done ? { over: true, complete: true } : { over: false };
  },

  viewFor(s, player) {
    const partner = s.players[0] === player ? s.players[1] : s.players[0];
    const mine = s.picks[player] ?? [];
    const theirs = s.picks[partner] ?? [];
    return {
      players: s.players,
      me: player,
      pairs: s.pairs.map((i) => THIS_OR_THAT[i]!),
      mine,
      partnerProgress: theirs.length,
      theirs: s.done ? theirs : null,
      matches: s.done ? mine.filter((p, i) => p !== null && p === theirs[i]).length : null,
      done: s.done,
    };
  },
};