import { describe, expect, it } from "vitest";
import { draughts, legalMoves, rc, sqAt, startBoard, type Cell, type DraughtsState } from "./logic";

const players = ["ada", "bo"] as const;
const ctx = { now: 0 };
const empty = (): Cell[] => Array<Cell>(50).fill(null);
const place = (pieces: Record<number, Cell>) => {
  const b = empty();
  for (const [n, p] of Object.entries(pieces)) b[Number(n) - 1] = p;
  return b;
};
const paths = (b: Cell[], c: "w" | "b") => legalMoves(b, c).map((m) => m.path.join("-")).sort();
const withBoard = (board: Cell[], turn: "w" | "b" = "w"): DraughtsState => ({ ...draughts.initialState("x", players, { firstPlayer: 0 }, ctx), board, turn, seen: [] });

describe("draughts", () => {
  it("numbers squares the standard way, dark squares only", () => {
    expect(rc(1)).toEqual([0, 1]);
    expect(rc(46)).toEqual([9, 0]);
    expect(rc(50)).toEqual([9, 8]);
    expect(sqAt(9, 0)).toBe(46);
    expect(sqAt(0, 0)).toBeNull();
  });

  it("starts with 20 men each, white has 9 opening moves", () => {
    const b = startBoard();
    expect(b.filter((p) => p === "w")).toHaveLength(20);
    expect(b.filter((p) => p === "b")).toHaveLength(20);
    expect(legalMoves(b, "w")).toHaveLength(9);
  });

  it("men capture backwards, and capturing is compulsory", () => {
    // White man on 28, black man behind it on 32, black man in front on 23 but blocked landing.
    const b = place({ 28: "w", 32: "b", 40: "w" });
    expect(paths(b, "w")).toEqual(["28-37"]);
  });

  it("you must take the most pieces", () => {
    // Single jumps exist (32 over 27), but three routes take two pieces, so only those are allowed.
    const b = place({ 32: "w", 27: "b", 33: "w", 28: "b", 18: "b", 49: "w" });
    const moves = legalMoves(b, "w");
    expect(moves.every((m) => m.captured.length === 2)).toBe(true);
    expect(paths(b, "w")).toEqual(["32-23-12", "33-22-13", "33-22-31"]);
  });

  it("kings fly, and capture from a distance with a choice of landing", () => {
    const b = place({ 46: "W", 28: "b" });
    // 46's long diagonal: 41, 37, 32, 28, 23, 19, 14, 10, 5.
    const caps = legalMoves(b, "w");
    expect(caps.every((m) => m.captured[0] === 28)).toBe(true);
    expect(caps.map((m) => m.path[1]).sort((a, b) => a! - b!)).toEqual([5, 10, 14, 19, 23]);
    const quiet = legalMoves(place({ 46: "W" }), "w");
    expect(quiet).toHaveLength(9);
  });

  it("a piece can't be jumped twice in one move", () => {
    // King on 46, black on 37 and 39: after taking 37 it can't come back over it.
    const b = place({ 46: "W", 37: "b" });
    expect(legalMoves(b, "w").every((m) => m.captured.length === 1)).toBe(true);
  });

  it("a man is crowned only if it ends on the far row", () => {
    let s = withBoard(place({ 7: "w", 40: "b" }));
    s = draughts.applyMove(s, { kind: "move", path: [7, 1] }, "ada", ctx);
    expect(s.board[0]).toBe("W");
    expect(s.notation).toEqual(["7-1"]);
  });

  it("taking the last piece wins", () => {
    const s = draughts.applyMove(withBoard(place({ 33: "w", 28: "b" })), { kind: "move", path: [33, 22] }, "ada", ctx);
    expect(s.winner).toBe("ada");
    expect(s.reason).toBe("no-moves");
    expect(s.notation).toEqual(["33x22"]);
  });

  it("rejects moves out of turn and moves that skip a compulsory capture", () => {
    const s = withBoard(place({ 33: "w", 28: "b", 45: "w" }));
    expect(draughts.validateMove(s, { kind: "move", path: [45, 40] }, "ada", ctx)).toBe(false);
    expect(draughts.validateMove(s, { kind: "move", path: [33, 22] }, "bo", ctx)).toBe(false);
    expect(draughts.validateMove(s, { kind: "move", path: [33, 22] }, "ada", ctx)).toBe(true);
  });

  it("three repeats of a position is a draw", () => {
    let s = withBoard(place({ 50: "W", 1: "B" }));
    s = { ...s, seen: [s.board.map((p) => p ?? ".").join("") + "w"] };
    const shuffle = [
      [50, 44, "ada"],
      [1, 7, "bo"],
      [44, 50, "ada"],
      [7, 1, "bo"],
    ] as const;
    for (let i = 0; i < 2; i++) for (const [a, b, who] of shuffle) s = draughts.applyMove(s, { kind: "move", path: [a, b] }, who, ctx);
    expect(s.reason).toBe("threefold");
    expect(s.winner).toBe("tie");
  });

  it("the view only lists moves on your turn", () => {
    const s = draughts.initialState("x", players, { firstPlayer: 0 }, ctx);
    expect(draughts.viewFor(s, "ada").legal).toHaveLength(9);
    expect(draughts.viewFor(s, "bo").legal).toHaveLength(0);
    expect(draughts.viewFor(s, "bo").myColor).toBe("b");
  });
});
