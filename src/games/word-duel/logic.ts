import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";
import { ANSWERS } from "@/content/words/answers5";
import { PACKED } from "@/content/words/valid5";

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;

/** g = right letter, right spot. y = in the word elsewhere. x = not in the word. */
export type Mark = "g" | "y" | "x";
export type Guess = { word: string; marks: Mark[] };

let dict: Set<string> | null = null;
export function isWord(w: string): boolean {
  if (!dict) {
    dict = new Set<string>();
    for (let i = 0; i < PACKED.length; i += WORD_LEN) dict.add(PACKED.slice(i, i + WORD_LEN));
  }
  return dict.has(w);
}

/** Standard marking, including repeated letters: greens first, then yellows from what's left. */
export function mark(guess: string, target: string): Mark[] {
  const marks: Mark[] = Array<Mark>(WORD_LEN).fill("x");
  const left: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) marks[i] = "g";
    else left[target[i]!] = (left[target[i]!] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] === "g") continue;
    const c = guess[i]!;
    if ((left[c] ?? 0) > 0) {
      marks[i] = "y";
      left[c]!--;
    }
  }
  return marks;
}

export type WordDuelState = {
  players: Players;
  target: string;
  guesses: Record<PlayerId, Guess[]>;
  winner: PlayerId | "tie" | null;
};

export type WordDuelMove = { guess: string };

export type WordDuelView = {
  players: Players;
  me: PlayerId;
  mine: Guess[];
  /** Your partner's board: colours only, never letters. */
  theirs: Mark[][];
  theirsSolved: boolean;
  winner: PlayerId | "tie" | null;
  /** Revealed only once the game is over. */
  target: string | null;
};

const moveSchema = z.object({
  guess: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{5}$/),
});

const solved = (gs: Guess[]) => gs.some((g) => g.marks.every((m) => m === "g"));
const done = (gs: Guess[]) => solved(gs) || gs.length >= MAX_GUESSES;

export const wordDuel: GameLogic<WordDuelState, WordDuelMove, WordDuelView> = {
  id: "word-duel",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 5,
  moveSchema,
  rules: {
    summary: "Same secret five-letter word, two boards, six guesses each. First to crack it wins.",
    sections: [
      { title: "Guessing", body: ["Type any real five-letter word.", "Green: right letter, right spot. Gold: in the word, wrong spot. Grey: not in it."] },
      { title: "The race", body: ["You can see your partner's colours as they go, but never their letters.", "The first to solve it wins. If you both run out of guesses, it's a tie."] },
    ],
  },

  initialState(seed, players) {
    const rng = makeRng(seed);
    return { players, target: ANSWERS[rng.int(ANSWERS.length)]!, guesses: { [players[0]]: [], [players[1]]: [] }, winner: null };
  },

  validateMove(s, move, by) {
    if (s.winner) return false;
    const gs = s.guesses[by];
    if (!gs || done(gs)) return false;
    return isWord(move.guess);
  },

  applyMove(s, move, by) {
    const g: Guess = { word: move.guess, marks: mark(move.guess, s.target) };
    const guesses = { ...s.guesses, [by]: [...s.guesses[by]!, g] };
    let winner: WordDuelState["winner"] = null;
    if (g.marks.every((m) => m === "g")) winner = by;
    else if (s.players.every((p) => done(guesses[p]!))) winner = "tie";
    return { ...s, guesses, winner };
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const opp = s.players[0] === player ? s.players[1] : s.players[0];
    return {
      players: s.players,
      me: player,
      mine: s.guesses[player] ?? [],
      theirs: (s.guesses[opp] ?? []).map((g) => g.marks),
      theirsSolved: solved(s.guesses[opp] ?? []),
      winner: s.winner,
      target: s.winner ? s.target : null,
    };
  },
};
