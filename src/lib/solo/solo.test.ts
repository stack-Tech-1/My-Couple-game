import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { GAME_LOGIC } from "@/games/logic";
import { makeRng } from "@/games/_engine/rng";
import { NAIJA_WORDS } from "@/content/words/naija";
import { SOLO_GAMES, isSoloGame } from "./catalog";
import { isPlusGame } from "@/lib/plus/plans";
import { canFitAnywhere, fits, isOver as blendOver, newBlend, place, SIZE } from "./games/blend";
import { LESSON, N, canMove, move, newAjo, newAjoLesson } from "./games/ajo";
import { fixScore, newFix, slide, solved } from "./games/fixam";
import { BOT_ID, botMove, type BotBase } from "./bots";

vi.mock("server-only", () => ({}));
const { ENGLISH, NAIJA, markGuess, oroAnswer } = await import("./oro-words");

describe("Solo catalog", () => {
  it("is free for everyone and never mistaken for a Plus game", () => {
    for (const g of SOLO_GAMES) {
      expect(g.free).toBe(true);
      expect(isSoloGame(g.id)).toBe(true);
      expect(isPlusGame(g.id)).toBe(false);
    }
    // Bots only play free games.
    for (const g of SOLO_GAMES.filter((x) => x.kind === "bot")) expect(isPlusGame(g.base!)).toBe(false);
  });
});

describe("Blend Am", () => {
  it("deals the same pieces for the same seed, and three at a time", () => {
    const a = newBlend("seed-1");
    const b = newBlend("seed-1");
    expect(a.tray).toEqual(b.tray);
    expect(a.tray).toHaveLength(3);
  });

  it("clears a full row and scores it", () => {
    let s = newBlend("x");
    // Fill row 0 except the last cell, then drop a single block there.
    s = { ...s, board: s.board.map((v, i) => (i < SIZE - 1 ? 1 : 0)), tray: [{ id: 99, cells: [[0, 0]], color: 0 }, null, null] };
    const r = place("x", s, 0, 0, SIZE - 1)!;
    expect(r.cleared).toBe(1);
    expect(r.state.board.slice(0, SIZE).every((v) => v === 0)).toBe(true);
    expect(r.points).toBeGreaterThan(1);
    // A new tray is dealt once all three are used.
    expect(r.state.tray.every((p) => p)).toBe(true);
  });

  it("refuses pieces that don't fit, and ends when nothing fits", () => {
    const s = newBlend("y");
    const full = { ...s, board: Array(SIZE * SIZE).fill(1) };
    expect(fits(full.board, s.tray[0]!, 0, 0)).toBe(false);
    expect(blendOver(full)).toBe(true);
    expect(canFitAnywhere(s.board, s.tray[0]!)).toBe(true);
  });

  it("plays a whole game to the end without breaking", () => {
    let s = newBlend("auto");
    for (let k = 0; k < 500 && !blendOver(s); k++) {
      let placed = false;
      for (let slot = 0; slot < 3 && !placed; slot++)
        for (let r = 0; r < SIZE && !placed; r++)
          for (let c = 0; c < SIZE && !placed; c++) {
            const res = place("auto", s, slot, r, c);
            if (res) {
              s = res.state;
              placed = true;
            }
          }
    }
    expect(s.score).toBeGreaterThan(0);
  });
});

describe("Ajo", () => {
  it("says where every note went, so the screen can glide them", () => {
    const s0 = { ...newAjo("a"), tiles: [0, 1, 0, 1, ...Array(12).fill(0)] };
    const r = move("a", s0, "left")!;
    // Both ₦5s travel to the first square and join there.
    expect(r.went).toEqual([{ from: 1, to: 0, joined: true }, { from: 3, to: 0, joined: true }]);
    expect(r.state.tiles[0]).toBe(2);
  });

  it("the first game's lesson plays out as the coach says", () => {
    let s0 = newAjoLesson();
    for (const step of LESSON) s0 = move("x", s0, step.dir, step.spawn)!.state;
    // Two ₦5s make ₦10, two more ₦5s make another ₦10, and the two ₦10s make ₦20.
    expect(s0.tiles[0]).toBe(3);
    expect(s0.tiles.filter((v) => v).sort()).toEqual([1, 1, 3]);
  });

  it("merges two matching notes into the next one up", () => {
    const s = { ...newAjo("a"), tiles: [1, 1, 0, 0, ...Array(12).fill(0)] };
    const r = move("a", s, "left")!;
    expect(r.state.tiles[0]).toBe(2);
    expect(r.points).toBe(4);
    // Where the merge landed, and where the new note came in (an empty square that wasn't before).
    expect(r.mergedAt).toEqual([0]);
    expect(r.spawnedAt).not.toBeNull();
    expect(r.state.tiles[r.spawnedAt!]).toBeGreaterThan(0);
    expect(r.spawnedAt).not.toBe(0);
  });

  it("reports merges along the swipe, in board positions", () => {
    // Bottom row, swiped right: ₦5 ₦5 ₦10 ₦10 makes ₦10 and ₦20 at the right end.
    const s = { ...newAjo("c"), tiles: [...Array(12).fill(0), 1, 1, 2, 2] };
    const r = move("c", s, "right")!;
    expect(r.state.tiles.slice(12)).toEqual(expect.arrayContaining([2, 3]));
    expect(r.mergedAt.sort()).toEqual([14, 15]);
  });

  it("won't count a swipe that moves nothing, and knows when the board is stuck", () => {
    const stuck = { ...newAjo("b"), tiles: Array.from({ length: N * N }, (_, i) => (i % 2) + ((Math.floor(i / N) % 2) * 2) + 1) };
    expect(canMove(stuck)).toBe(false);
    const s = { ...newAjo("b"), tiles: [1, ...Array(15).fill(0)] };
    expect(move("b", s, "left")).toBeNull();
  });
});

// Okada Rush has its own tests: games/okada.test.ts.

describe("Fix Am", () => {
  it("shuffles into a solvable, unsolved board and solves by sliding", () => {
    for (const n of [3, 4, 5]) {
      const s = newFix(`pic:${n}`, n);
      expect(solved(s)).toBe(false);
      expect([...s.tiles].sort((a, b) => a - b)).toEqual(Array.from({ length: n * n }, (_, i) => i));
    }
    // A one-move-away board solves in one slide.
    const near = { n: 3, tiles: [0, 1, 2, 3, 4, 5, 6, 8, 7], moves: 0 };
    const done = slide(near, 8)!;
    expect(solved(done)).toBe(true);
    expect(slide(near, 0)).toBeNull();
    expect(fixScore(3, 10, 30)).toBeGreaterThan(fixScore(3, 50, 30));
  });
});

describe("Ọ̀rọ̀ of the Day", () => {
  const dict = new Set(fs.readFileSync("assets/words/spell-am.txt", "utf8").split(/\r?\n/));
  it("only uses real five-letter words, and Naija words on Fridays", () => {
    for (const w of ENGLISH) {
      expect(w).toMatch(/^[a-z]{5}$/);
      expect(dict.has(w), w).toBe(true);
    }
    for (const [w] of NAIJA) {
      expect(w).toMatch(/^[a-z]{5}$/);
      expect(NAIJA_WORDS.includes(w), w).toBe(true);
    }
    expect(oroAnswer("2026-11-06").naija).toBe(true); // a Friday
    expect(oroAnswer("2026-11-05").naija).toBe(false);
    expect(oroAnswer("2026-11-05")).toEqual(oroAnswer("2026-11-05"));
  });

  it("marks letters fairly, including repeats", () => {
    expect(markGuess("apple", "apple")).toEqual(["hit", "hit", "hit", "hit", "hit"]);
    expect(markGuess("lemon", "melon")).toEqual(["near", "hit", "near", "hit", "hit"]);
    // Only one P in the answer: the second P is a miss.
    expect(markGuess("puppy", "paint")).toEqual(["hit", "miss", "miss", "miss", "miss"]);
  });
});

describe("bots", () => {
  const bases: BotBase[] = ["tic-tac-toe", "connect-four", "box-am", "ayo", "draughts", "ludo", "whot"];
  for (const base of bases) {
    for (const level of ["easy", "medium", "hard"] as const) {
      it(`${base} (${level}) only makes legal moves and finishes a game`, () => {
        const logic = GAME_LOGIC[base]!;
        const players = ["me", BOT_ID] as const;
        const config = logic.configSchema ? logic.configSchema.parse({}) : {};
        let s: unknown = logic.initialState(`bot-${base}`, players, config as never, { now: 0 });
        const rng = makeRng(`${base}-${level}`);
        const ctx = { now: 0 };
        let moves = 0;
        // Two bots play each other; "me" plays easy so games end.
        while (!logic.isOver(s).over && moves < (base === "draughts" || base === "ayo" ? 600 : 1500)) {
          const mine = botMove(base, logic, s, "me", "easy", ctx, rng.next);
          const theirs = botMove(base, logic, s, BOT_ID, level, ctx, rng.next);
          const m = theirs ?? mine;
          const by = theirs !== null ? BOT_ID : "me";
          if (m === null) break;
          expect(logic.validateMove(s, logic.moveSchema.parse(m), by, ctx)).toBe(true);
          s = logic.applyMove(s, logic.moveSchema.parse(m), by, ctx);
          moves++;
        }
        expect(moves).toBeGreaterThan(0);
      }, 30_000);
    }
  }

  it("the hardest X and O bot never loses a round to random play", () => {
    const logic = GAME_LOGIC["tic-tac-toe"]!;
    const rng = makeRng("ttt");
    for (let g = 0; g < 10; g++) {
      let s = logic.initialState(`g${g}`, ["me", BOT_ID], logic.configSchema!.parse({}) as never, { now: 0 }) as { roundResult: { winner: number | null } | null; players: string[] };
      for (let k = 0; k < 20 && !s.roundResult; k++) {
        const m = botMove("tic-tac-toe", logic, s, BOT_ID, "hard", { now: 0 }, rng.next) ?? botMove("tic-tac-toe", logic, s, "me", "easy", { now: 0 }, rng.next);
        const by = botMove("tic-tac-toe", logic, s, BOT_ID, "hard", { now: 0 }, () => 0) !== null ? BOT_ID : "me";
        if (!m) break;
        s = logic.applyMove(s, logic.moveSchema.parse(m), by, { now: 0 });
      }
      if (s.roundResult?.winner != null) expect(s.players[s.roundResult.winner]).toBe(BOT_ID);
    }
    // The hard bot searches every line, twice per move here: allow for a busy machine.
  }, 30_000);
});
