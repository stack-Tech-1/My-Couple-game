import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { MoveRejected } from "@/games/_engine/runner";
import { analyse, BONUS, CENTER, LETTER_VALUES, NAIJA_BONUS, RACK, SIZE, spellAm as g, TILE_COUNTS, type Placement, type SpellState, type Tile } from "./logic";
import { NAIJA_WORDS } from "@/content/words/naija";

const DICT = new Set([...fs.readFileSync("assets/words/spell-am.txt", "utf8").split("\n"), ...NAIJA_WORDS]);
const isWord = (w: string) => DICT.has(w.toLowerCase());
const ctx = { now: 1_000, isWord };
const two = ["ada", "bo"] as const;
const empty = () => Array<Tile | null>(SIZE * SIZE).fill(null);
const across = (row: number, col: number, word: string): Placement[] => [...word].map((l, i) => ({ cell: row * SIZE + col + i, letter: l }));
const down = (row: number, col: number, word: string): Placement[] => [...word].map((l, i) => ({ cell: (row + i) * SIZE + col, letter: l }));
const withRack = (s: SpellState, p: string, letters: string) => ({ ...s, racks: { ...s.racks, [p]: [...letters] } });
const start = () => g.initialState("spell-seed", two, { firstPlayer: 0 }, ctx);

describe("spell am: the set", () => {
  it("has 73 tiles, values 1 to 6, and our own 11 by 11 bonus layout", () => {
    expect(Object.values(TILE_COUNTS).reduce((a, n) => a + n, 0)).toBe(73);
    expect(Math.max(...Object.values(LETTER_VALUES))).toBe(6);
    expect(BONUS.filter((b) => b === "tw")).toHaveLength(4);
    expect(BONUS[CENTER]).toBe("star");
    const s = start();
    expect(s.racks.ada).toHaveLength(RACK);
    expect(s.bag).toHaveLength(73 - 14);
  });

  it("knows British spellings and Naija words", () => {
    for (const w of ["colour", "programme", "qi", "wahala", "jollof"]) expect(isWord(w)).toBe(true);
    expect(isWord("wahalax")).toBe(false);
  });
});

describe("spell am: placing tiles", () => {
  it("the first word must cover the star", () => {
    expect(analyse(empty(), across(0, 0, "cat"))).toMatchObject({ ok: false, error: /star/ });
    const a = analyse(empty(), across(5, 4, "cat"));
    expect(a.ok && a.words.map((w) => w.word)).toEqual(["cat"]);
  });

  it("no gaps, one line, and later words must join on", () => {
    const tiles = across(5, 4, "cat");
    const board = empty();
    for (const t of tiles) board[t.cell] = { l: t.letter, by: "ada" };
    expect(analyse(board, [{ cell: 0, letter: "a" }, { cell: 2, letter: "t" }])).toMatchObject({ ok: false });
    expect(analyse(board, [{ cell: 0, letter: "a" }, { cell: SIZE + 1, letter: "t" }])).toMatchObject({ ok: false, error: /one line/ });
    expect(analyse(board, across(0, 0, "dog"))).toMatchObject({ ok: false, error: /join/ });
    // "cats": one tile on the end.
    const a = analyse(board, [{ cell: 5 * SIZE + 7, letter: "s" }]);
    expect(a.ok && a.words.map((w) => w.word)).toEqual(["cats"]);
  });

  it("scores letters, bonus squares, cross words and Naija words", () => {
    // "wahala" across row 5 from column 2: w on (5,2) is a triple letter.
    const a = analyse(empty(), across(5, 2, "wahala"));
    if (!a.ok) throw new Error(a.error);
    const base = 4 * 3 + 1 + 3 + 1 + 2 + 1;
    expect(a.words[0]).toMatchObject({ word: "wahala", naija: true, score: base + NAIJA_BONUS });
    // Crossing an existing word scores both.
    const board = empty();
    for (const t of across(5, 4, "cat")) board[t.cell] = { l: t.letter, by: "ada" };
    const b = analyse(board, down(3, 5, "ba"));
    if (!b.ok) throw new Error(b.error);
    expect(b.words.map((w) => w.word)).toEqual(["baa"]);
  });

  it("a blank scores nothing", () => {
    const a = analyse(empty(), [{ cell: CENTER, letter: "z", blank: true }, { cell: CENTER + 1, letter: "a" }]);
    if (!a.ok) throw new Error(a.error);
    expect(a.words[0]!.word).toBe("za");
    expect(a.score).toBe(1);
  });
});

describe("spell am: turns", () => {
  it("rejects a word that isn't in the dictionary, naming it", () => {
    const s = withRack(start(), "ada", "qxzvbnk");
    expect(() => g.validateMove(s, { kind: "play", tiles: across(5, 4, "qxz") }, "ada", ctx)).toThrow(MoveRejected);
    expect(() => g.validateMove(s, { kind: "play", tiles: across(5, 4, "qxz") }, "ada", ctx)).toThrow(/QXZ isn't in our dictionary/);
  });

  it("you can only play letters you hold", () => {
    const s = withRack(start(), "ada", "catxxxx");
    expect(g.validateMove(s, { kind: "play", tiles: across(5, 4, "dog") }, "ada", ctx)).toBe(false);
    expect(g.validateMove(s, { kind: "play", tiles: across(5, 4, "cat") }, "ada", ctx)).toBe(true);
    expect(g.validateMove(s, { kind: "play", tiles: across(5, 4, "cat") }, "bo", ctx)).toBe(false);
  });

  it("a play scores, refills your rack, and passes the turn", () => {
    let s = withRack(start(), "ada", "catxxxx");
    s = g.applyMove(s, { kind: "play", tiles: across(5, 4, "cat") }, "ada", ctx);
    expect(s.scores.ada).toBe(3 + 1 + 1);
    expect(s.racks.ada).toHaveLength(RACK);
    expect(s.players[s.turn]).toBe("bo");
    expect(s.last?.cells).toHaveLength(3);
  });

  it("swaps keep the tile count, and everyone passing twice ends it", () => {
    let s = start();
    const before = s.bag.length;
    s = g.applyMove(s, { kind: "swap", letters: s.racks.ada!.slice(0, 3) }, "ada", ctx);
    expect(s.bag.length).toBe(before);
    expect(s.racks.ada).toHaveLength(RACK);
    s = g.applyMove(s, { kind: "pass" }, "bo", ctx);
    s = g.applyMove(s, { kind: "pass" }, "ada", ctx);
    expect(s.winner).toBeNull();
    s = g.applyMove(s, { kind: "pass" }, "bo", ctx);
    expect(s.winner).not.toBeNull();
    expect(s.finish).not.toBeNull();
  });

  it("going out with an empty bag takes everyone's leftovers", () => {
    let s: SpellState = { ...start(), bag: [], racks: { ada: [..."cat"], bo: [..."zq"] } };
    s = g.applyMove(s, { kind: "play", tiles: across(5, 4, "cat") }, "ada", ctx);
    expect(s.finish).toEqual({ ada: 12, bo: -12 });
    expect(s.scores.ada).toBe(5 + 12);
    expect(s.winner).toBe("ada");
  });

  it("quick games stop after 10 rounds", () => {
    let s = g.initialState("q", two, { firstPlayer: 0, mode: "quick" }, ctx);
    for (let i = 0; i < 3; i++) s = g.applyMove(s, { kind: "swap", letters: [s.racks[s.players[s.turn]!]![0]!] }, s.players[s.turn]!, ctx);
    expect(s.winner).toBeNull();
    s = { ...s, round: 10, passes: 0, turn: 1 };
    s = g.applyMove(s, { kind: "swap", letters: [s.racks.bo![0]!] }, "bo", ctx);
    expect(s.winner).not.toBeNull();
  });

  it("the view hides the bag and other racks", () => {
    const v = g.viewFor(start(), "ada") as unknown as Record<string, unknown>;
    expect(v.bag).toBeUndefined();
    expect(v.racks).toBeUndefined();
    expect(v.rack).toHaveLength(RACK);
    expect(v.bagCount).toBe(59);
  });
});
