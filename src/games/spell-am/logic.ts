import { z } from "zod";
import type { GameLogic, MoveContext, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { MoveRejected } from "@/games/_engine/runner";
import { NAIJA_WORDS } from "@/content/words/naija";

/**
 * Spell Am: our own crossword-building word game. 11 by 11 board, 73 tiles valued 1 to 6,
 * our own bonus layout, English words plus a Naija list that scores a bonus. Words are checked on
 * the server (the dictionary comes in through the move context), so nobody can sneak one past.
 */

export const SIZE = 11;
export const CENTER = 5 * SIZE + 5;
export const RACK = 7;
export const SWEEP_BONUS = 40;
export const NAIJA_BONUS = 5;
export const QUICK_ROUNDS = 10;
export const LIVE_MS = 120_000;

export const LETTER_VALUES: Record<string, number> = {
  a: 1, e: 1, i: 1, o: 1, n: 1, r: 1, t: 1, s: 1,
  l: 2, u: 2, d: 2,
  g: 3, h: 3, m: 3, c: 3, p: 3, b: 3, y: 3,
  k: 4, f: 4, w: 4, v: 4,
  j: 5, x: 5,
  q: 6, z: 6,
};
export const TILE_COUNTS: Record<string, number> = {
  e: 8, a: 6, i: 5, o: 5, n: 4, r: 4, t: 4, s: 3,
  l: 3, u: 3, d: 3,
  g: 2, h: 2, m: 2, c: 2, p: 2, b: 2, y: 2,
  k: 2, f: 1, w: 1, v: 1,
  j: 1, x: 1, q: 1, z: 1,
  "?": 2,
};

export type Bonus = "dl" | "tl" | "dw" | "tw" | "star" | null;
const at = (r: number, c: number) => r * SIZE + c;
/** Our own diamond pattern round the centre star: 4 triple words at the edge midpoints. */
export const BONUS: Bonus[] = (() => {
  const b: Bonus[] = Array<Bonus>(SIZE * SIZE).fill(null);
  const set = (kind: Bonus, cells: [number, number][]) => cells.forEach(([r, c]) => (b[at(r, c)] = kind));
  set("tw", [[0, 5], [5, 0], [10, 5], [5, 10]]);
  set("dw", [[1, 1], [1, 9], [9, 1], [9, 9], [3, 3], [3, 7], [7, 3], [7, 7]]);
  set("tl", [[2, 5], [5, 2], [8, 5], [5, 8]]);
  set("dl", [[0, 2], [0, 8], [2, 0], [8, 0], [10, 2], [10, 8], [2, 10], [8, 10], [4, 4], [4, 6], [6, 4], [6, 6]]);
  b[CENTER] = "star";
  return b;
})();

const NAIJA = new Set(NAIJA_WORDS);
export const isNaija = (w: string) => NAIJA.has(w.toLowerCase());

export type Tile = { l: string; blank?: true; by: PlayerId };
export type Placement = { cell: number; letter: string; blank?: boolean };
export type Formed = { word: string; cells: number[]; score: number; naija: boolean };
export type Mode = "full" | "quick" | "live";
export type LogEntry = { id: number; by: PlayerId; kind: "play" | "swap" | "pass" | "timeout"; words?: Formed[]; score?: number; sweep?: boolean; count?: number };

export type SpellState = {
  players: PlayerList;
  seed: string;
  rngCursor: number;
  mode: Mode;
  bag: string[];
  racks: Record<PlayerId, string[]>;
  board: (Tile | null)[];
  scores: Record<PlayerId, number>;
  turn: number;
  firstTurn: number;
  round: number;
  /** Scoreless turns in a row (passes and swaps). Twice round the table ends the game. */
  passes: number;
  /** Live mode only: when the current turn runs out. 0 otherwise. */
  deadline: number;
  /** Players who have taken a turn themselves; the clock only passes for people who have shown up. */
  awake: PlayerId[];
  last: { by: PlayerId; cells: number[] } | null;
  log: LogEntry[];
  seq: number;
  /** At the end: what each player's leftover tiles cost them (negative) or earned them. */
  finish: Record<PlayerId, number> | null;
  winner: PlayerId | "tie" | null;
};

export type SpellMove =
  | { kind: "play"; tiles: Placement[] }
  | { kind: "swap"; letters: string[] }
  | { kind: "pass" }
  | { kind: "tick" };
export type SpellConfig = { firstPlayer?: 0 | 1; mode?: Mode };
export type SpellView = Omit<SpellState, "seed" | "rngCursor" | "bag" | "racks"> & {
  me: PlayerId;
  rack: string[];
  rackCounts: Record<PlayerId, number>;
  bagCount: number;
};

const letter = z.string().regex(/^[a-z]$/);
const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("play"),
    tiles: z.array(z.object({ cell: z.number().int().min(0).max(SIZE * SIZE - 1), letter, blank: z.boolean().optional() })).min(1).max(RACK),
  }),
  z.object({ kind: z.literal("swap"), letters: z.array(z.string().regex(/^[a-z?]$/)).min(1).max(RACK) }),
  z.object({ kind: z.literal("pass") }),
  z.object({ kind: z.literal("tick") }),
]) as z.ZodType<SpellMove>;
const configSchema = z.object({
  firstPlayer: z.union([z.literal(0), z.literal(1)]).optional(),
  mode: z.enum(["full", "quick", "live"]).optional(),
});

export const rackValue = (rack: readonly string[]) => rack.reduce((a, l) => a + (l === "?" ? 0 : LETTER_VALUES[l]!), 0);

/** Takes `letters` out of `rack`, or null if the rack doesn't hold them. */
function takeFrom(rack: readonly string[], letters: readonly string[]): string[] | null {
  const left = [...rack];
  for (const l of letters) {
    const i = left.indexOf(l);
    if (i < 0) return null;
    left.splice(i, 1);
  }
  return left;
}
const rackLetter = (p: Placement) => (p.blank ? "?" : p.letter);

export type Analysis = { ok: true; words: Formed[]; score: number; sweep: boolean } | { ok: false; error: string };

/**
 * Works out what a set of placed tiles makes: the words, and what they score. Used by the server
 * to judge a play, and by the board to preview the score while you place tiles.
 */
export function analyse(board: readonly (Tile | null)[], tiles: readonly Placement[]): Analysis {
  if (!tiles.length) return { ok: false, error: "Place some tiles first." };
  const placed = new Map<number, Placement>();
  for (const t of tiles) {
    if (placed.has(t.cell) || board[t.cell]) return { ok: false, error: "That square is taken." };
    placed.set(t.cell, t);
  }
  const letterAt = (cell: number) => placed.get(cell)?.letter ?? board[cell]?.l ?? null;
  const rows = new Set(tiles.map((t) => Math.floor(t.cell / SIZE)));
  const cols = new Set(tiles.map((t) => t.cell % SIZE));
  if (rows.size > 1 && cols.size > 1) return { ok: false, error: "Tiles must go in one line, across or down." };

  const firstMove = board.every((c) => c === null);
  const hasNeighbour = (cell: number) => {
    const r = Math.floor(cell / SIZE);
    const c = cell % SIZE;
    return [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ].some(([rr, cc]) => rr! >= 0 && rr! < SIZE && cc! >= 0 && cc! < SIZE && board[at(rr!, cc!)] !== null);
  };

  // Across if the tiles share a row (or one tile with letters beside it), otherwise down.
  const one = tiles.length === 1 ? tiles[0]!.cell : null;
  const sideways = one !== null && ((one % SIZE > 0 && letterAt(one - 1) !== null) || (one % SIZE < SIZE - 1 && letterAt(one + 1) !== null));
  const across = tiles.length > 1 ? rows.size === 1 : sideways;
  const step = across ? 1 : SIZE;

  const cells = tiles.map((t) => t.cell).sort((a, b) => a - b);
  for (let c = cells[0]!; c <= cells[cells.length - 1]!; c += step) {
    if (letterAt(c) === null) return { ok: false, error: "Leave no gaps: the tiles must join up into one word." };
  }

  /** The full word through `cell` in direction `dStep`, or null if it's a single letter. */
  const wordThrough = (cell: number, dStep: number): number[] | null => {
    const same = (a: number, b: number) => (dStep === 1 ? Math.floor(a / SIZE) === Math.floor(b / SIZE) : b >= 0 && b < SIZE * SIZE);
    let s = cell;
    while (same(s, s - dStep) && s - dStep >= 0 && letterAt(s - dStep) !== null) s -= dStep;
    const out: number[] = [];
    for (let c = s; c < SIZE * SIZE && same(s, c) && letterAt(c) !== null; c += dStep) out.push(c);
    return out.length >= 2 ? out : null;
  };

  const lines: number[][] = [];
  const main = wordThrough(cells[0]!, step);
  if (main) lines.push(main);
  for (const c of cells) {
    const cross = wordThrough(c, across ? SIZE : 1);
    if (cross) lines.push(cross);
  }

  if (firstMove) {
    if (!placed.has(CENTER)) return { ok: false, error: "The first word must cover the star in the middle." };
    if (!main) return { ok: false, error: "The first word needs at least two letters." };
  } else {
    const joins = cells.some(hasNeighbour) || (main?.some((c) => !placed.has(c)) ?? false);
    if (!joins) return { ok: false, error: "Your word must join onto the tiles already on the board." };
  }
  if (!lines.length) return { ok: false, error: "That doesn't make a word of two letters or more." };

  const words = lines.map((line) => {
    let sum = 0;
    let mul = 1;
    for (const c of line) {
      const p = placed.get(c);
      const blank = p ? !!p.blank : !!board[c]?.blank;
      let v = blank ? 0 : LETTER_VALUES[letterAt(c)!]!;
      if (p) {
        const b = BONUS[c];
        if (b === "dl") v *= 2;
        if (b === "tl") v *= 3;
        if (b === "dw") mul *= 2;
        if (b === "tw") mul *= 3;
      }
      sum += v;
    }
    const word = line.map((c) => letterAt(c)!).join("");
    const naija = isNaija(word);
    return { word, cells: line, score: sum * mul + (naija ? NAIJA_BONUS : 0), naija };
  });
  const sweep = tiles.length === RACK;
  return { ok: true, words, score: words.reduce((a, w) => a + w.score, 0) + (sweep ? SWEEP_BONUS : 0), sweep };
}

const current = (s: SpellState) => s.players[s.turn]!;

function draw(bag: string[], rack: string[]) {
  while (rack.length < RACK && bag.length) rack.push(bag.pop()!);
}

function pushLog(s: SpellState, entry: Omit<LogEntry, "id">): Pick<SpellState, "log" | "seq"> {
  const seq = s.seq + 1;
  return { seq, log: [...s.log, { id: seq, ...entry }].slice(-40) };
}

/** Ends the game: leftover tiles count against you; whoever went out takes everyone's leftovers. */
function finish(s: SpellState, wentOut: PlayerId | null): SpellState {
  const scores = { ...s.scores };
  const result: Record<PlayerId, number> = {};
  let pot = 0;
  for (const p of s.players) {
    const v = rackValue(s.racks[p]!);
    result[p] = -v;
    scores[p]! -= v;
    pot += v;
  }
  if (wentOut) {
    result[wentOut] = pot;
    scores[wentOut]! += pot;
  }
  const ranked = [...s.players].sort((a, b) => scores[b]! - scores[a]!);
  const tie = scores[ranked[0]!] === scores[ranked[1]!];
  return { ...s, scores, finish: result, winner: tie ? "tie" : ranked[0]!, deadline: 0 };
}

/** Pass the turn on, counting rounds; quick games stop after QUICK_ROUNDS. */
function advance(s: SpellState, now: number): SpellState {
  if (s.passes >= s.players.length * 2) return finish(s, null);
  const turn = (s.turn + 1) % s.players.length;
  const round = turn === s.firstTurn ? s.round + 1 : s.round;
  if (s.mode === "quick" && round > QUICK_ROUNDS) return finish({ ...s, turn }, null);
  return { ...s, turn, round, deadline: s.mode === "live" ? now + LIVE_MS : 0 };
}

export const spellAm: GameLogic<SpellState, SpellMove, SpellView, SpellConfig, PlayerList> = {
  id: "spell-am",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: 20,
  moveSchema,
  configSchema: configSchema as unknown as z.ZodType<SpellConfig>,
  rematchKeeps: ["mode"],
  rules: {
    summary: "Build words on a shared board from your 7 letters. Highest score wins.",
    sections: [
      { title: "A turn", body: ["Place tiles in one line, across or down, joined to what's already on the board. Every new word you make has to be real.", "The first word must cover the star in the middle.", "Or swap any of your tiles (while the bag has 7 or more), or pass."] },
      { title: "Scoring", body: ["Add up the letters. 2L and 3L multiply one tile; 2W and 3W multiply the whole word. Bonus squares only count the turn you cover them.", `Use all 7 tiles in one go for a +${SWEEP_BONUS} clean sweep.`] },
      { title: "Naija words", body: [`English words are the main game. Naija words like wahala, jollof and danfo count too, and score +${NAIJA_BONUS}.`] },
      { title: "Blanks", body: ["The two blank tiles can be any letter you like. They score nothing."] },
      { title: "The end", body: ["When the bag is empty and someone uses their last tile, the game ends. They take the value of everyone else's leftover tiles.", "If everyone passes twice in a row, it ends too. Quick games end after 10 rounds."] },
    ],
  },

  initialState(seed, players, config, ctx) {
    const rng = makeRng(seed);
    const first = players.length === 2 ? (config.firstPlayer ?? rng.int(2)) : rng.int(players.length);
    const bag = shuffle(
      Object.entries(TILE_COUNTS).flatMap(([l, n]) => Array<string>(n).fill(l)),
      rng,
    );
    const racks: Record<PlayerId, string[]> = {};
    for (const p of players) {
      racks[p] = [];
      draw(bag, racks[p]);
    }
    const mode = config.mode ?? "full";
    return {
      players: [...players],
      seed,
      rngCursor: rng.cursor(),
      mode,
      bag,
      racks,
      board: Array<Tile | null>(SIZE * SIZE).fill(null),
      scores: Object.fromEntries(players.map((p) => [p, 0])),
      turn: first,
      firstTurn: first,
      round: 1,
      passes: 0,
      deadline: mode === "live" ? ctx.now + LIVE_MS : 0,
      awake: [],
      last: null,
      log: [],
      seq: 0,
      finish: null,
      winner: null,
    };
  },

  validateMove(s, move, by, ctx: MoveContext) {
    if (s.winner || !s.players.includes(by)) return false;
    if (move.kind === "tick") return s.mode === "live" && ctx.now >= s.deadline && s.awake.includes(current(s));
    if (current(s) !== by) return false;
    if (move.kind === "pass") return true;
    if (move.kind === "swap") return s.bag.length >= RACK && takeFrom(s.racks[by]!, move.letters) !== null;
    if (takeFrom(s.racks[by]!, move.tiles.map(rackLetter)) === null) return false;
    const a = analyse(s.board, move.tiles);
    if (!a.ok) throw new MoveRejected(a.error);
    if (!ctx.isWord) throw new MoveRejected("We can't check words right now. Try again in a moment.");
    const bad = a.words.filter((w) => !ctx.isWord!(w.word));
    if (bad.length) {
      const list = bad.map((w) => w.word.toUpperCase()).join(", ");
      throw new MoveRejected(bad.length === 1 ? `${list} isn't in our dictionary.` : `${list} aren't in our dictionary.`);
    }
    return true;
  },

  applyMove(prev, move, by, ctx) {
    const s = move.kind === "tick" || prev.awake.includes(by) ? prev : { ...prev, awake: [...prev.awake, by] };
    const me = current(s);
    switch (move.kind) {
      case "tick":
        return advance({ ...s, passes: s.passes + 1, ...pushLog(s, { by: me, kind: "timeout" }) }, ctx.now);
      case "pass":
        return advance({ ...s, passes: s.passes + 1, ...pushLog(s, { by: me, kind: "pass" }) }, ctx.now);
      case "swap": {
        const rng = makeRng(s.seed, s.rngCursor);
        const rack = takeFrom(s.racks[me]!, move.letters)!;
        const bag = [...s.bag];
        draw(bag, rack);
        const mixed = shuffle([...bag, ...move.letters], rng);
        return advance(
          { ...s, bag: mixed, racks: { ...s.racks, [me]: rack }, rngCursor: rng.cursor(), passes: s.passes + 1, ...pushLog(s, { by: me, kind: "swap", count: move.letters.length }) },
          ctx.now,
        );
      }
      case "play": {
        const a = analyse(s.board, move.tiles);
        if (!a.ok) return s;
        const board = [...s.board];
        for (const t of move.tiles) board[t.cell] = { l: t.letter, by: me, ...(t.blank ? { blank: true as const } : {}) };
        const rack = takeFrom(s.racks[me]!, move.tiles.map(rackLetter))!;
        const bag = [...s.bag];
        draw(bag, rack);
        const next: SpellState = {
          ...s,
          board,
          bag,
          racks: { ...s.racks, [me]: rack },
          scores: { ...s.scores, [me]: s.scores[me]! + a.score },
          passes: 0,
          last: { by: me, cells: move.tiles.map((t) => t.cell) },
          ...pushLog(s, { by: me, kind: "play", words: a.words, score: a.score, ...(a.sweep ? { sweep: true } : {}) }),
        };
        if (!rack.length && !bag.length) return finish(next, me);
        return advance(next, ctx.now);
      }
    }
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  // Nobody sees the bag order or anyone else's letters.
  viewFor(s, player) {
    const { seed: _seed, rngCursor: _c, bag, racks, ...rest } = s;
    return {
      ...rest,
      me: player,
      rack: racks[player] ?? [],
      rackCounts: Object.fromEntries(s.players.map((p) => [p, racks[p]?.length ?? 0])),
      bagCount: bag.length,
    };
  },
};
