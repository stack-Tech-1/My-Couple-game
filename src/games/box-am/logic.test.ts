import { describe, expect, it } from "vitest";
import { boxAm, sides, sizeFor, type BoxMove, type BoxState } from "./logic";

const P2 = ["a", "b"] as const;
const ctx = { now: 0 };
const play = (s: BoxState, m: BoxMove) => {
  const who = s.players[s.turn]!;
  expect(boxAm.validateMove(s, m, who, ctx)).toBe(true);
  return boxAm.applyMove(s, m, who, ctx);
};

describe("Box Am", () => {
  it("sets up a 5 × 5 board for two and 6 × 6 for three or four", () => {
    expect(boxAm.initialState("x", P2, {}, ctx).n).toBe(5);
    expect(sizeFor(3)).toBe(6);
    const s = boxAm.initialState("x", ["a", "b", "c", "d"], {}, ctx);
    expect(s.h).toHaveLength(7 * 6);
    expect(s.v).toHaveLength(6 * 7);
    expect(s.score).toEqual([0, 0, 0, 0]);
  });

  it("passes the turn after a plain line, and refuses a line twice or out of turn", () => {
    const s = boxAm.initialState("x", P2, {}, ctx);
    const t = play(s, { kind: "line", dir: "h", i: 0 });
    expect(t.turn).toBe((s.turn + 1) % 2);
    expect(boxAm.validateMove(t, { kind: "line", dir: "h", i: 0 }, t.players[t.turn]!, ctx)).toBe(false);
    expect(boxAm.validateMove(t, { kind: "line", dir: "h", i: 1 }, s.players[s.turn]!, ctx)).toBe(false);
  });

  it("gives the box to whoever closes it, and they go again", () => {
    let s = boxAm.initialState("x", P2, {}, ctx);
    const k = sides(5, 0, 0);
    s = play(s, { kind: "line", dir: "h", i: k.top });
    s = play(s, { kind: "line", dir: "h", i: k.bottom });
    s = play(s, { kind: "line", dir: "v", i: k.left });
    const closer = s.turn;
    s = play(s, { kind: "line", dir: "v", i: k.right });
    expect(s.owner[0]).toBe(closer);
    expect(s.score[closer]).toBe(1);
    expect(s.turn).toBe(closer);
    expect(s.closed).toEqual([0]);
  });

  it("ends when every line is drawn, most boxes winning", () => {
    let s = boxAm.initialState("y", P2, {}, ctx);
    const all: BoxMove[] = [...s.h.map((_, i) => ({ kind: "line" as const, dir: "h" as const, i })), ...s.v.map((_, i) => ({ kind: "line" as const, dir: "v" as const, i }))];
    for (const m of all) s = play(s, m);
    expect(boxAm.isOver(s).over).toBe(true);
    expect(s.score[0]! + s.score[1]!).toBe(25);
    expect(s.winner).toBe(s.players[s.score[0]! > s.score[1]! ? 0 : 1]);
  });
});
