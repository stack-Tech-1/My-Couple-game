import { describe, expect, it } from "vitest";
import { MAX_ROUNDS, ticTacToe, type TttState } from "./logic";

const players = ["ada", "bo"] as const;
const ctx = { now: 0 };
const who = (s: TttState) => s.players[s.turn];
const mark = (s: TttState, ...cells: number[]) => cells.reduce((st, cell) => ticTacToe.applyMove(st, { kind: "mark", cell }, who(st), ctx), s);
const next = (s: TttState) => ticTacToe.applyMove(s, { kind: "next" }, "bo", ctx);

describe("tic-tac-toe", () => {
  it("three in a row wins the round, and the other player starts the next", () => {
    let s = ticTacToe.initialState("x", players, { firstPlayer: 0 }, ctx);
    s = mark(s, 0, 3, 1, 4, 2); // Ada: top row
    expect(s.roundResult).toEqual({ winner: 0, line: [0, 1, 2] });
    expect(s.score).toEqual([1, 0]);
    expect(ticTacToe.validateMove(s, { kind: "mark", cell: 8 }, "bo", ctx)).toBe(false); // round is over
    s = next(s);
    expect(s.round).toBe(2);
    expect(who(s)).toBe("bo");
    expect(s.board.every((c) => c === 0)).toBe(true);
  });

  it("no marking out of turn or on a taken square", () => {
    const s = mark(ticTacToe.initialState("x", players, { firstPlayer: 0 }, ctx), 4);
    expect(ticTacToe.validateMove(s, { kind: "mark", cell: 0 }, "ada", ctx)).toBe(false);
    expect(ticTacToe.validateMove(s, { kind: "mark", cell: 4 }, "bo", ctx)).toBe(false);
    expect(ticTacToe.validateMove(s, { kind: "mark", cell: 0 }, "bo", ctx)).toBe(true);
  });

  it("first to three takes the match", () => {
    let s = ticTacToe.initialState("x", players, { firstPlayer: 0 }, ctx);
    for (let r = 0; r < 3; r++) {
      // Ada always takes the left column, whoever starts.
      s = who(s) === "ada" ? mark(s, 0, 1, 3, 2, 6) : mark(s, 8, 0, 5, 3, 7, 6);
      if (r < 2) s = next(s);
    }
    expect(s.score).toEqual([3, 0]);
    expect(s.winner).toBe("ada");
  });

  it(`a draw scores nobody, and after ${MAX_ROUNDS} rounds level means a tie`, () => {
    let s = ticTacToe.initialState("x", players, { firstPlayer: 0 }, ctx);
    const drawn = (st: TttState) => mark(st, 0, 1, 2, 4, 3, 5, 7, 6, 8);
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      s = drawn(s);
      expect(s.roundResult?.winner).toBeNull();
      if (r < MAX_ROUNDS) s = next(s);
    }
    expect(s.score).toEqual([0, 0]);
    expect(s.winner).toBe("tie");
  });
});
