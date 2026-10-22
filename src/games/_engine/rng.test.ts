import { describe, expect, it } from "vitest";
import { makeRng } from "./rng";
import { ludo, type LudoState } from "@/games/ludo/logic";
import { runMove } from "./runner";

describe("rng", () => {
  it("continuing from a saved cursor gives the same numbers as one long stream", () => {
    const long = makeRng("seed");
    const all = Array.from({ length: 50 }, () => long.next());
    let cursor = 0;
    const pieced: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = makeRng("seed", cursor);
      for (let k = 0; k < 5; k++) pieced.push(r.next());
      cursor = r.cursor();
    }
    expect(pieced).toEqual(all);
    // The cursor counts draws, nothing more (it used to double on every continuation).
    expect(cursor).toBe(50);
  });

  it("jumps to any cursor instantly", () => {
    const t = performance.now();
    const r = makeRng("seed", 2 ** 40);
    r.next();
    expect(performance.now() - t).toBeLessThan(50);
    expect(r.cursor()).toBe(2 ** 40 + 1);
  });

  it("a long Ludo game stays fast: 600 moves, every roll cheap", () => {
    const P = ["ada", "bo"] as const;
    let s: LudoState = ludo.initialState("long", P, { firstPlayer: 0, twoDice: true }, { now: 0 });
    const t = performance.now();
    for (let i = 0; i < 600 && !s.winner; i++) {
      const by = s.players[s.turn]!;
      const view = ludo.viewFor(s, by);
      const move = s.phase === "roll" ? { type: "roll" } : { type: "move", token: view.options![0]!.token, use: view.options![0]!.use };
      s = runMove(ludo, s, move, by, { now: 0 }).next as LudoState;
    }
    expect(performance.now() - t).toBeLessThan(2000);
    expect(s.rngCursor).toBeLessThan(2000);
  });
});
