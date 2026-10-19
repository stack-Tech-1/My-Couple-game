import { describe, expect, it } from "vitest";
import { connectFour as g, COLS, ROWS, dropRow, type C4State } from "./logic";
import { runMove, MoveRejected } from "@/games/_engine/runner";

const P = ["alice", "bob"] as const;
const ctx = { now: 0 };
const start = (first: 0 | 1 = 0) => g.initialState("seed", P, { firstPlayer: first }, ctx);

function play(cols: number[], first: 0 | 1 = 0): C4State {
  let s = start(first);
  for (const col of cols) s = runMove(g, s, { col }, s.players[s.turn], ctx).next as C4State;
  return s;
}

describe("connect four", () => {
  it("starts empty with the chosen first player", () => {
    const s = start(1);
    expect(s.board.every((c) => c === 0)).toBe(true);
    expect(s.players[s.turn]).toBe("bob");
  });

  it("picks the first player deterministically from the seed", () => {
    const a = g.initialState("abc", P, {}, ctx);
    const b = g.initialState("abc", P, {}, ctx);
    expect(a.turn).toBe(b.turn);
  });

  it("drops discs to the lowest empty row and alternates turns", () => {
    const s = play([3, 3]);
    expect(s.board[(ROWS - 1) * COLS + 3]).toBe(1);
    expect(s.board[(ROWS - 2) * COLS + 3]).toBe(2);
    expect(s.turn).toBe(0);
  });

  it("rejects moves out of turn", () => {
    const s = start(0);
    expect(() => runMove(g, s, { col: 0 }, "bob", ctx)).toThrow(MoveRejected);
  });

  it("rejects malformed and out-of-range moves", () => {
    const s = start(0);
    expect(() => runMove(g, s, { col: 7 }, "alice", ctx)).toThrow(MoveRejected);
    expect(() => runMove(g, s, { col: "2" }, "alice", ctx)).toThrow(MoveRejected);
    expect(() => runMove(g, s, {}, "alice", ctx)).toThrow(MoveRejected);
  });

  it("rejects a full column", () => {
    const s = play([0, 0, 0, 0, 0, 0]);
    expect(dropRow(s.board, 0)).toBe(-1);
    expect(() => runMove(g, s, { col: 0 }, s.players[s.turn], ctx)).toThrow(MoveRejected);
  });

  it("detects a horizontal win", () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(g.isOver(s)).toEqual({ over: true, winner: "alice" });
    expect(s.winLine).toHaveLength(4);
  });

  it("detects a vertical win for the second player", () => {
    const s = play([0, 1, 0, 1, 0, 1, 6, 1]);
    expect(g.isOver(s)).toEqual({ over: true, winner: "bob" });
  });

  it("detects both diagonal directions", () => {
    // rising diagonal for alice: (5,0) (4,1) (3,2) (2,3)
    const rising = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(g.isOver(rising)).toEqual({ over: true, winner: "alice" });
    // falling diagonal for alice: (2,3) (3,4) (4,5) (5,6)
    const falling = play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
    expect(g.isOver(falling)).toEqual({ over: true, winner: "alice" });
  });

  it("refuses any move after the game is won", () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(() => runMove(g, s, { col: 5 }, "bob", ctx)).toThrow(/already over/);
  });

  it("declares a tie on a full board with no line", () => {
    // Column-filling order that never makes four in a row.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const s = play(order);
    expect(s.moves).toBe(42);
    expect(g.isOver(s)).toEqual({ over: true, winner: "tie" });
  });

  it("tells each player their colour in their view", () => {
    const s = start();
    expect(g.viewFor(s, "alice").you).toBe(1);
    expect(g.viewFor(s, "bob").you).toBe(2);
  });
});