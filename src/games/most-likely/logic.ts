import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { MOST_LIKELY } from "@/content/most-likely";

/**
 * Most Likely To (friend rooms, 3 to 8 people). Everyone votes for who's most likely to do the thing.
 * Votes are anonymous: only the counts are ever shown, and only once everyone has voted. Nobody
 * gets more than one prompt ahead. Not scored; the end shows who "won" the most prompts.
 */
export const MOST_LIKELY_COUNT = 8;
export type MostLikelyState = { players: PlayerList; prompts: string[]; votes: Record<PlayerId, PlayerId[]> };
export type MostLikelyMove = { index: number; vote: PlayerId };
export type MostLikelyRound = { prompt: string; counts: Record<PlayerId, number> };
export type MostLikelyView = {
  players: PlayerList;
  me: PlayerId;
  total: number;
  current: { index: number; prompt: string } | null;
  /** Who has voted on my current prompt (or the one I'm waiting on). Never who they voted for. */
  answered: PlayerId[];
  done: MostLikelyRound[];
  finished: boolean;
};

const moveSchema = z.object({ index: z.number().int().min(0).max(MOST_LIKELY_COUNT - 1), vote: z.uuid() });
const allDone = (s: MostLikelyState) => Math.min(...s.players.map((p) => s.votes[p]?.length ?? 0));

/** The people with the most votes in a round (several if level). */
export const topVoted = (counts: Record<PlayerId, number>): PlayerId[] => {
  const best = Math.max(0, ...Object.values(counts));
  return best ? Object.keys(counts).filter((p) => counts[p] === best) : [];
};

export const mostLikely: GameLogic<MostLikelyState, MostLikelyMove, MostLikelyView, Record<string, never>, PlayerList> = {
  id: "most-likely",
  category: "personal",
  minPlayers: 3,
  maxPlayers: 8,
  estimatedMinutes: 6,
  moveSchema,
  rules: {
    summary: "Who in this room is most likely to…? Everyone votes. Nobody sees who voted for whom.",
    sections: [
      { title: "Voting", body: [`${MOST_LIKELY_COUNT} prompts. Tap the person you think fits best. Yourself counts, if you're honest.`, "The count shows once everyone has voted. Votes are anonymous, always."] },
      { title: "The end", body: ["See who topped the most prompts. No points, just evidence."] },
    ],
  },

  initialState(seed, players) {
    const prompts = shuffle(MOST_LIKELY, makeRng(seed)).slice(0, MOST_LIKELY_COUNT);
    return { players: [...players], prompts, votes: Object.fromEntries(players.map((p) => [p, []])) };
  },

  validateMove(s, move, by) {
    const mine = s.votes[by]?.length;
    if (mine === undefined) return false;
    return move.index === mine && mine < s.prompts.length && mine <= allDone(s) && s.players.includes(move.vote);
  },

  applyMove(s, move, by) {
    return { ...s, votes: { ...s.votes, [by]: [...s.votes[by]!, move.vote] } };
  },

  isOver(s): Outcome {
    return allDone(s) >= s.prompts.length ? { over: true, complete: true } : { over: false };
  },

  viewFor(s, player) {
    const mine = s.votes[player]?.length ?? 0;
    const both = allDone(s);
    const canVote = mine < s.prompts.length && mine <= both;
    const focus = canVote ? mine : mine - 1;
    return {
      players: s.players,
      me: player,
      total: s.prompts.length,
      current: canVote ? { index: mine, prompt: s.prompts[mine]! } : null,
      answered: focus >= 0 ? s.players.filter((p) => (s.votes[p]?.length ?? 0) > focus) : [],
      done: s.prompts.slice(0, both).map((prompt, i) => {
        const counts: Record<PlayerId, number> = Object.fromEntries(s.players.map((p) => [p, 0]));
        for (const p of s.players) counts[s.votes[p]![i]!]!++;
        return { prompt, counts };
      }),
      finished: both >= s.prompts.length,
    };
  },
};
