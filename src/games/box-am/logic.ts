import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

/**
 * Box Am: dots and boxes. Take turns drawing a line between two dots. Close a box and it's yours,
 * and you go again. When every line is drawn, most boxes wins. Two to four players; with three or
 * four the board is bigger.
 *
 * Lines: horizontal h[r * n + c] (r 0..n, c 0..n-1) and vertical v[r * (n + 1) + c] (r 0..n-1, c 0..n),
 * for an n × n grid of boxes.
 */
export type BoxState = {
  players: PlayerList;
  n: number;
  /** Who drew each line (player index), or -1. */
  h: number[];
  v: number[];
  /** Who owns each box (player index), or -1. */
  owner: number[];
  turn: number;
  score: number[];
  last: { dir: "h" | "v"; i: number } | null;
  /** Boxes closed by the last move, for the little celebration. */
  closed: number[];
  winner: PlayerId | "tie" | null;
};

export type BoxMove = { kind: "line"; dir: "h" | "v"; i: number };
export type BoxView = BoxState & { you: number };

const moveSchema = z.object({ kind: z.literal("line"), dir: z.enum(["h", "v"]), i: z.number().int().min(0).max(80) }) as z.ZodType<BoxMove>;

export const sizeFor = (players: number) => (players <= 2 ? 5 : 6);

/** The four lines around box (r, c). */
export function sides(n: number, r: number, c: number) {
  return { top: r * n + c, bottom: (r + 1) * n + c, left: r * (n + 1) + c, right: r * (n + 1) + c + 1 };
}

export function boxDone(s: Pick<BoxState, "n" | "h" | "v">, r: number, c: number): boolean {
  const k = sides(s.n, r, c);
  return s.h[k.top]! >= 0 && s.h[k.bottom]! >= 0 && s.v[k.left]! >= 0 && s.v[k.right]! >= 0;
}

/** Boxes that touch a line. */
export function boxesBy(n: number, dir: "h" | "v", i: number): [number, number][] {
  if (dir === "h") {
    const r = Math.floor(i / n), c = i % n;
    return ([[r - 1, c], [r, c]] as [number, number][]).filter(([rr]) => rr >= 0 && rr < n);
  }
  const r = Math.floor(i / (n + 1)), c = i % (n + 1);
  return ([[r, c - 1], [r, c]] as [number, number][]).filter(([, cc]) => cc >= 0 && cc < n);
}

export const boxAm: GameLogic<BoxState, BoxMove, BoxView, Record<string, never>, PlayerList> = {
  id: "box-am",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: 8,
  moveSchema,
  rules: {
    summary: "Dots and boxes. Close a box, keep it, and go again. Most boxes wins.",
    sections: [
      { title: "Your turn", body: ["Draw one line between two dots next to each other, across or down."] },
      { title: "Boxes", body: ["Draw the fourth side of a box and it's yours, with your initial in it.", "Close a box and you go again. Close two at once and you get both."] },
      { title: "Winning", body: ["When every line is drawn, whoever owns the most boxes wins.", "Careful with the third side of a box: it hands the box to the next player."] },
    ],
  },

  initialState(seed, players) {
    const n = sizeFor(players.length);
    const first = makeRng(seed).int(players.length);
    return {
      players,
      n,
      h: Array<number>((n + 1) * n).fill(-1),
      v: Array<number>(n * (n + 1)).fill(-1),
      owner: Array<number>(n * n).fill(-1),
      turn: first,
      score: players.map(() => 0),
      last: null,
      closed: [],
      winner: null,
    };
  },

  validateMove(state, move, by) {
    if (state.winner || state.players[state.turn] !== by) return false;
    const lines = move.dir === "h" ? state.h : state.v;
    return move.i < lines.length && lines[move.i] === -1;
  },

  applyMove(state, move) {
    const h = [...state.h];
    const v = [...state.v];
    (move.dir === "h" ? h : v)[move.i] = state.turn;
    const owner = [...state.owner];
    const score = [...state.score];
    const closed: number[] = [];
    for (const [r, c] of boxesBy(state.n, move.dir, move.i)) {
      const b = r * state.n + c;
      if (owner[b] === -1 && boxDone({ n: state.n, h, v }, r, c)) {
        owner[b] = state.turn;
        score[state.turn]!++;
        closed.push(b);
      }
    }
    const turn = closed.length ? state.turn : (state.turn + 1) % state.players.length;
    let winner: BoxState["winner"] = null;
    if (owner.every((o) => o >= 0)) {
      const top = Math.max(...score);
      const leaders = score.flatMap((x, i) => (x === top ? [i] : []));
      winner = leaders.length === 1 ? state.players[leaders[0]!]! : "tie";
    }
    return { ...state, h, v, owner, score, turn, last: { dir: move.dir, i: move.i }, closed, winner };
  },

  isOver(state): Outcome {
    return state.winner ? { over: true, winner: state.winner } : { over: false };
  },

  viewFor(state, player) {
    return { ...state, you: Math.max(0, state.players.indexOf(player)) };
  },
};
