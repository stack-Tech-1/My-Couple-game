import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

/** 0 empty, 1 = X (players[0]), 2 = O (players[1]). Cells 0–8, row by row. */
export type Mark = 0 | 1 | 2;

export const TO_WIN = 3;
export const MAX_ROUNDS = 9;

export type TttState = {
  players: Players;
  board: Mark[];
  /** Whose turn it is (index into players). */
  turn: 0 | 1;
  /** Who started this round; it alternates every round. */
  starter: 0 | 1;
  round: number;
  score: [number, number];
  /** Set when a round has finished and is waiting for "next round". */
  roundResult: { winner: 0 | 1 | null; line: number[] | null } | null;
  last: number | null;
  winner: PlayerId | "tie" | null;
};

export type TttMove = { kind: "mark"; cell: number } | { kind: "next" };
export type TttConfig = { firstPlayer?: 0 | 1 };
export type TttView = TttState & { you: 0 | 1 };

const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mark"), cell: z.number().int().min(0).max(8) }),
  z.object({ kind: z.literal("next") }),
]) as z.ZodType<TttMove>;
const configSchema = z.object({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional() });

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function lineOf(board: readonly Mark[]): number[] | null {
  for (const l of LINES) if (board[l[0]!] && l.every((i) => board[i] === board[l[0]!])) return l;
  return null;
}

const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);
const empty = (): Mark[] => Array<Mark>(9).fill(0);

export const ticTacToe: GameLogic<TttState, TttMove, TttView, TttConfig> = {
  id: "tic-tac-toe",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 4,
  moveSchema,
  configSchema,
  rules: {
    summary: `X and O, first to ${TO_WIN} round wins takes the match.`,
    sections: [
      { title: "A round", body: ["Take turns marking a square. Three in a row wins the round: across, down or diagonal.", "A full board with no line is a draw, and nobody scores."] },
      { title: "The match", body: [`First to ${TO_WIN} round wins takes it.`, "Whoever didn't start the last round starts the next one."] },
      { title: "Long matches", body: [`If it's still going after ${MAX_ROUNDS} rounds, whoever's ahead wins. Level means a tie.`] },
    ],
  },

  initialState(seed, players, config) {
    const first = config.firstPlayer ?? (makeRng(seed).int(2) as 0 | 1);
    return { players, board: empty(), turn: first, starter: first, round: 1, score: [0, 0], roundResult: null, last: null, winner: null };
  },

  validateMove(state, move, by) {
    if (state.winner || !state.players.includes(by)) return false;
    if (move.kind === "next") return state.roundResult !== null;
    return state.roundResult === null && state.players[state.turn] === by && state.board[move.cell] === 0;
  },

  applyMove(state, move) {
    if (move.kind === "next") {
      const starter = other(state.starter);
      return { ...state, board: empty(), turn: starter, starter, round: state.round + 1, roundResult: null, last: null };
    }
    const board = [...state.board];
    board[move.cell] = state.turn === 0 ? 1 : 2;
    const line = lineOf(board);
    const full = board.every((c) => c !== 0);
    if (!line && !full) return { ...state, board, last: move.cell, turn: other(state.turn) };

    const score: [number, number] = [...state.score];
    if (line) score[state.turn]++;
    const roundResult = { winner: line ? state.turn : null, line };
    let winner: TttState["winner"] = null;
    if (score[0] >= TO_WIN) winner = state.players[0];
    else if (score[1] >= TO_WIN) winner = state.players[1];
    else if (state.round >= MAX_ROUNDS) winner = score[0] === score[1] ? "tie" : state.players[score[0] > score[1] ? 0 : 1];
    return { ...state, board, last: move.cell, score, roundResult, winner };
  },

  isOver(state): Outcome {
    return state.winner ? { over: true, winner: state.winner } : { over: false };
  },

  viewFor(state, player) {
    return { ...state, you: state.players[0] === player ? 0 : 1 };
  },
};
