import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { PUZZLES, type Puzzle } from "@/content/split-clues";

export const CHAPTER = 3;
export const LIVES = 6;

export type ChatLine = { by: PlayerId; text: string };
export type SplitState = {
  players: Players;
  /** Which seat holds clue set A for each puzzle (the other holds B). */
  holdsA: PlayerId[];
  puzzles: string[];
  index: number;
  lives: number;
  hints: boolean[];
  wrong: number[];
  attempts: { by: PlayerId; text: string }[];
  chat: ChatLine[];
  solved: boolean[];
  result: "win" | "loss" | null;
};

export type SplitMove = { type: "answer"; text: string } | { type: "hint" } | { type: "say"; text: string };

export type SplitView = {
  players: Players;
  me: PlayerId;
  index: number;
  total: number;
  title: string;
  setup: string;
  ask: string;
  /** Only my half of the clues. */
  clues: string[];
  hint: string | null;
  lives: number;
  attempts: { by: PlayerId; text: string }[];
  chat: ChatLine[];
  solved: boolean[];
  stars: number[];
  result: "win" | "loss" | null;
  /** Revealed at the end. */
  answers: string[] | null;
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), text: z.string().trim().min(1).max(60) }),
  z.object({ type: z.literal("hint") }),
  z.object({ type: z.literal("say"), text: z.string().trim().min(1).max(200) }),
]);

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const byId = (id: string): Puzzle => PUZZLES.find((p) => p.id === id)!;
export const matches = (p: Puzzle, text: string) => [p.answer, ...(p.accept ?? [])].some((a) => norm(a) === norm(text));
const starsFor = (s: SplitState, i: number) => (s.solved[i] ? Math.max(1, 3 - (s.wrong[i] ?? 0) - (s.hints[i] ? 1 : 0)) : 0);

export const splitClues: GameLogic<SplitState, SplitMove, SplitView> = {
  id: "split-clues",
  category: "coop",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  moveSchema,
  rules: {
    summary: "Three puzzles. You each see different clues. Neither of you can solve them alone.",
    sections: [
      { title: "Talking it out", body: ["Read your clues to each other: out loud, or in the chat on screen.", "Either of you can type an answer."] },
      { title: "Lives and hints", body: ["You share six lives for the whole chapter. Every wrong answer costs one.", "Stuck? Take a hint. It's free, but it costs a star."] },
      { title: "Stars", body: ["Three stars per puzzle, minus one for each wrong answer and for a hint. Solve all three to clear the chapter."] },
    ],
  },

  initialState(seed, players) {
    const rng = makeRng(seed);
    const chosen = shuffle(PUZZLES.map((p) => p.id), rng).slice(0, CHAPTER);
    return {
      players,
      holdsA: chosen.map(() => players[rng.int(2)]!),
      puzzles: chosen,
      index: 0,
      lives: LIVES,
      hints: chosen.map(() => false),
      wrong: chosen.map(() => 0),
      attempts: [],
      chat: [],
      solved: chosen.map(() => false),
      result: null,
    };
  },

  validateMove(s, move) {
    if (s.result) return move.type === "say";
    if (move.type === "hint") return !s.hints[s.index];
    return true;
  },

  applyMove(s, move, by) {
    if (move.type === "say") return { ...s, chat: [...s.chat, { by, text: move.text }].slice(-80) };
    if (move.type === "hint") return { ...s, hints: s.hints.map((h, i) => (i === s.index ? true : h)) };

    const p = byId(s.puzzles[s.index]!);
    if (matches(p, move.text)) {
      const solved = s.solved.map((v, i) => (i === s.index ? true : v));
      const last = s.index === s.puzzles.length - 1;
      return { ...s, solved, attempts: [], index: last ? s.index : s.index + 1, result: last ? "win" : null };
    }
    const lives = s.lives - 1;
    return {
      ...s,
      lives,
      wrong: s.wrong.map((w, i) => (i === s.index ? w + 1 : w)),
      attempts: [...s.attempts, { by, text: move.text }].slice(-10),
      result: lives <= 0 ? "loss" : null,
    };
  },

  isOver(s): Outcome {
    return s.result ? { over: true, coop: s.result } : { over: false };
  },

  viewFor(s, player) {
    const p = byId(s.puzzles[s.index]!);
    const mine = s.holdsA[s.index] === player ? p.a : p.b;
    return {
      players: s.players,
      me: player,
      index: s.index,
      total: s.puzzles.length,
      title: p.title,
      setup: p.setup,
      ask: p.ask,
      clues: mine,
      hint: s.hints[s.index] ? p.hint : null,
      lives: s.lives,
      attempts: s.attempts,
      chat: s.chat,
      solved: s.solved,
      stars: s.puzzles.map((_, i) => starsFor(s, i)),
      result: s.result,
      answers: s.result ? s.puzzles.map((id) => byId(id).answer) : null,
    };
  },
};
