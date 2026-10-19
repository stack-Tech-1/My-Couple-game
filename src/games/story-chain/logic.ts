import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";
import { STORY_OPENERS } from "@/content/personal";

export const MAX_LINES = 14;
export const MIN_LINES_TO_END = 4;

export type StoryLine = { by: PlayerId; text: string };
export type StoryState = { players: Players; opener: string; lines: StoryLine[]; turn: 0 | 1; ended: boolean; title: string | null };
export type StoryMove = { type: "line"; text: string } | { type: "end"; title?: string };
export type StoryView = StoryState & { me: PlayerId; maxLines: number; minLinesToEnd: number };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("line"), text: z.string().trim().min(1).max(220) }),
  z.object({ type: z.literal("end"), title: z.string().trim().max(60).optional() }),
]);

export const storyChain: GameLogic<StoryState, StoryMove, StoryView> = {
  id: "story-chain",
  category: "personal",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 10,
  moveSchema,
  rules: {
    summary: "Build a story one line at a time, taking turns. Where it ends up is anyone's guess.",
    sections: [
      { title: "Taking turns", body: ["We'll give you an opening line. Then you each add one sentence at a time."] },
      { title: "Ending", body: [`After ${MIN_LINES_TO_END} lines, either of you can write "The End" and give it a title. It ends by itself at ${MAX_LINES}.`, "Save the finished story as a card to keep or share."] },
    ],
  },

  initialState(seed, players) {
    const rng = makeRng(seed);
    return { players, opener: STORY_OPENERS[rng.int(STORY_OPENERS.length)]!, lines: [], turn: rng.int(2) as 0 | 1, ended: false, title: null };
  },

  validateMove(s, move, by) {
    if (s.ended) return false;
    if (move.type === "end") return s.lines.length >= MIN_LINES_TO_END;
    return s.players[s.turn] === by;
  },

  applyMove(s, move, by) {
    if (move.type === "end") return { ...s, ended: true, title: move.title?.trim() || null };
    const lines = [...s.lines, { by, text: move.text.trim() }];
    return { ...s, lines, turn: s.turn === 0 ? 1 : 0, ended: lines.length >= MAX_LINES };
  },

  isOver(s): Outcome {
    return s.ended ? { over: true, complete: true } : { over: false };
  },

  viewFor(s, player) {
    return { ...s, me: player, maxLines: MAX_LINES, minLinesToEnd: MIN_LINES_TO_END };
  },
};