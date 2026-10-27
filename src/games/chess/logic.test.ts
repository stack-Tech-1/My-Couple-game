import { describe, expect, it } from "vitest";
import { chess, type ChessMove, type ChessState } from "./logic";

const players = ["ada", "bo"] as const;
const ctx = { now: 0 };
// Ada plays white.
const start = () => chess.initialState("seed", players, { firstPlayer: 0 }, ctx);

function play(s: ChessState, ...lans: string[]): ChessState {
  for (const lan of lans) {
    const g = s.moves.length % 2 === 0 ? "ada" : "bo";
    const move: ChessMove = { kind: "move", from: lan.slice(0, 2), to: lan.slice(2, 4), promotion: (lan[4] as "q") || undefined };
    expect(chess.validateMove(s, move, g, ctx), `${g} ${lan}`).toBe(true);
    s = chess.applyMove(s, move, g, ctx);
  }
  return s;
}

describe("chess", () => {
  it("white moves first, and only legal moves on your own turn", () => {
    const s = start();
    expect(chess.validateMove(s, { kind: "move", from: "e7", to: "e5" }, "bo", ctx)).toBe(false); // not Bo's turn
    expect(chess.validateMove(s, { kind: "move", from: "e2", to: "e5" }, "ada", ctx)).toBe(false); // pawns don't do that
    expect(chess.viewFor(s, "ada").legal).toHaveLength(20);
    expect(chess.viewFor(s, "bo").legal).toHaveLength(0);
    expect(chess.viewFor(s, "bo").myColor).toBe("b");
  });

  it("checkmate wins (scholar's mate)", () => {
    const s = play(start(), "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7");
    expect(s.winner).toBe("ada");
    expect(s.reason).toBe("checkmate");
    expect(s.san.at(-1)).toBe("Qxf7#");
    expect(chess.isOver(s)).toEqual({ over: true, winner: "ada" });
    expect(chess.viewFor(s, "bo").captured.b).toEqual(["bp"]);
  });

  it("promotion needs a chosen piece", () => {
    // Fast route to a promotion: white's h-pawn walks up after trades clear the way.
    let s = play(start(), "h2h4", "g7g5", "h4g5", "h7h6", "g5h6", "g8f6", "h6h7", "f6g8");
    const bare: ChessMove = { kind: "move", from: "h7", to: "g8" };
    expect(chess.validateMove(s, bare, "ada", ctx)).toBe(false);
    expect(chess.viewFor(s, "ada").legal.filter((m) => m.from === "h7").every((m) => m.promotion)).toBe(true);
    s = play(s, "h7g8n");
    expect(chess.viewFor(s, "ada").board.includes("wn")).toBe(true);
  });

  it("draw offers: the other player accepts or a move declines", () => {
    let s = start();
    s = chess.applyMove(s, { kind: "draw", action: "offer" }, "ada", ctx);
    expect(chess.validateMove(s, { kind: "draw", action: "accept" }, "ada", ctx)).toBe(false); // can't accept your own
    expect(chess.validateMove(s, { kind: "draw", action: "offer" }, "bo", ctx)).toBe(false); // one offer at a time
    const declined = play(s, "e2e4");
    expect(declined.drawOffer).toBeNull();
    const agreed = chess.applyMove(s, { kind: "draw", action: "accept" }, "bo", ctx);
    expect(agreed).toMatchObject({ winner: "tie", reason: "agreed" });
  });

  it("stalemate is a draw", () => {
    // A known 10-move stalemate (Sam Loyd).
    const s = play(start(), "e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6", "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6");
    expect(s).toMatchObject({ winner: "tie", reason: "stalemate" });
  });

  it("strangers can't move", () => {
    expect(chess.validateMove(start(), { kind: "move", from: "e2", to: "e4" }, "eve", ctx)).toBe(false);
  });
});
