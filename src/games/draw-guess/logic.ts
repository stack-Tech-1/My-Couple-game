import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { topOf } from "@/games/quiz/logic";
import { makeRng } from "@/games/_engine/rng";
import { DRAW_WORDS } from "@/content/draw-words";

export const CHOOSE_MS = 20_000;
export const DRAWER_POINTS = 100;

export const drawConfigSchema = z.object({
  rounds: z.number().int().min(2).max(10).default(6),
  drawSeconds: z.number().int().min(30).max(180).default(80),
  firstPlayer: z.union([z.literal(0), z.literal(1)]).optional(),
});
export type DrawConfig = z.input<typeof drawConfigSchema>;

/** `by` is who guessed (groups). A right guess is shown as `correct` with its text hidden from the others. */
export type GuessEntry = { text: string; close: boolean; by?: PlayerId; correct?: boolean };
export type RoundRecord = { round: number; drawer: PlayerId; word: string; guessed: boolean; points: number; passed?: boolean; solvers?: PlayerId[] };

export type DrawState = {
  players: PlayerList;
  seed: string;
  rngCursor: number;
  rounds: number;
  drawMs: number;
  round: number;
  firstDrawer: number;
  phase: "choosing" | "drawing";
  options: string[];
  word: string | null;
  deadline: number;
  startedAt: number | null;
  guesses: GuessEntry[];
  /** Groups: who has guessed it this round, and what they scored. */
  solved?: { by: PlayerId; points: number }[];
  scores: Record<PlayerId, number>;
  history: RoundRecord[];
  winner: PlayerId | "tie" | null;
};

export type DrawMove =
  | { type: "choose"; index: number }
  | { type: "guess"; text: string }
  | { type: "pass" }
  | { type: "tick" };

export type DrawView = {
  players: PlayerList;
  me: PlayerId;
  drawer: PlayerId;
  round: number;
  rounds: number;
  phase: "choosing" | "drawing";
  /** Only the drawer gets these. */
  options: string[] | null;
  word: string | null;
  /** The guesser's hint: letter count and spaces, e.g. "_ _ _ _   _ _ _". */
  pattern: string | null;
  deadline: number;
  drawMs: number;
  guesses: GuessEntry[];
  /** Who has already guessed it this round. */
  solvers: PlayerId[];
  scores: Record<PlayerId, number>;
  history: RoundRecord[];
  winner: PlayerId | "tie" | null;
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choose"), index: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal("guess"), text: z.string().trim().min(1).max(40) }),
  z.object({ type: z.literal("pass") }),
  z.object({ type: z.literal("tick") }),
]);

export const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

/** Edit distance, capped: we only care whether a guess is within one letter. */
export function nearlyEqual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export const drawerOf = (s: Pick<DrawState, "players" | "firstDrawer" | "round">): PlayerId =>
  s.players[(s.firstDrawer + s.round - 1) % s.players.length]!;

/** Rounds for a group: everyone draws twice (up to 5 players), or once (6 or more). */
export const groupRounds = (n: number) => (n <= 5 ? n * 2 : n);

function dealOptions(s: DrawState): { options: string[]; rngCursor: number } {
  const rng = makeRng(s.seed, s.rngCursor);
  const used = new Set(s.history.map((h) => h.word));
  const pick = (list: readonly string[]) => {
    for (let tries = 0; tries < 20; tries++) {
      const w = list[rng.int(list.length)]!;
      if (!used.has(w)) return w;
    }
    return list[rng.int(list.length)]!;
  };
  return { options: [pick(DRAW_WORDS.easy), pick(DRAW_WORDS.medium), pick(DRAW_WORDS.hard)], rngCursor: rng.cursor() };
}

/** Ends the round: every right guesser keeps their points, and the drawer scores if anyone got it. */
function endRound(s: DrawState, now: number, result: { passed?: boolean } = {}): DrawState {
  const drawer = drawerOf(s);
  const solved = s.solved ?? [];
  const scores = { ...s.scores };
  for (const g of solved) scores[g.by] = scores[g.by]! + g.points;
  if (solved.length) scores[drawer] = scores[drawer]! + DRAWER_POINTS;
  const history = [
    ...s.history,
    {
      round: s.round,
      drawer,
      word: s.word!,
      guessed: solved.length > 0,
      points: solved.reduce((n, g) => n + g.points, 0),
      solvers: solved.map((g) => g.by),
      ...(result.passed ? { passed: true } : {}),
    },
  ];
  if (s.round >= s.rounds) return { ...s, scores, history, solved: [], winner: topOf(scores) };
  const next: DrawState = { ...s, scores, history, solved: [], round: s.round + 1, phase: "choosing", word: null, guesses: [], startedAt: null, deadline: now + CHOOSE_MS };
  return { ...next, ...dealOptions(next) };
}

export const drawGuess: GameLogic<DrawState, DrawMove, DrawView, DrawConfig, PlayerList> = {
  id: "draw-guess",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 10,
  moveSchema,
  configSchema: drawConfigSchema as unknown as z.ZodType<DrawConfig>,
  rules: {
    summary: "Take turns drawing a secret word while everyone else races the clock to guess it.",
    sections: [
      { title: "Drawing", body: ["Pick one of three words: easy, medium or hard. Then draw it. No letters, no numbers, no cheating."] },
      { title: "Guessing", body: ["Type as many guesses as you like. We'll tell you when you're one letter off."] },
      { title: "Points", body: ["The faster the right guess, the more the guesser scores (up to 300). In a group, everyone who gets it scores.", "The artist gets 100 for being understood. Bad art costs everyone."] },
    ],
  },

  initialState(seed, players, config, ctx) {
    const cfg = drawConfigSchema.parse(config);
    const rng = makeRng(seed);
    const first = players.length === 2 ? (cfg.firstPlayer ?? rng.int(2)) : rng.int(players.length);
    const base: DrawState = {
      players: [...players],
      seed,
      rngCursor: rng.cursor(),
      rounds: players.length === 2 ? cfg.rounds : groupRounds(players.length),
      drawMs: cfg.drawSeconds * 1000,
      round: 1,
      firstDrawer: first,
      phase: "choosing",
      options: [],
      word: null,
      deadline: ctx.now + CHOOSE_MS,
      startedAt: null,
      guesses: [],
      solved: [],
      scores: Object.fromEntries(players.map((p) => [p, 0])),
      history: [],
      winner: null,
    };
    return { ...base, ...dealOptions(base) };
  },

  validateMove(s, move, by, ctx) {
    if (s.winner) return false;
    const drawer = drawerOf(s);
    switch (move.type) {
      case "choose":
        return s.phase === "choosing" && by === drawer;
      case "pass":
        return s.phase === "drawing" && by === drawer;
      case "guess":
        return s.phase === "drawing" && by !== drawer && !(s.solved ?? []).some((g) => g.by === by) && ctx.now <= s.deadline + 1500 && s.guesses.length < 120;
      case "tick":
        return ctx.now >= s.deadline;
    }
  },

  applyMove(s, move, by, ctx) {
    switch (move.type) {
      case "choose":
        return { ...s, phase: "drawing", word: s.options[move.index]!, options: [], startedAt: ctx.now, deadline: ctx.now + s.drawMs };
      case "pass":
        return endRound(s, ctx.now, { passed: true });
      case "tick":
        // Out of time picking: we pick the easy one for you. Out of time drawing: round over.
        if (s.phase === "choosing") return { ...s, phase: "drawing", word: s.options[0]!, options: [], startedAt: ctx.now, deadline: ctx.now + s.drawMs };
        return endRound(s, ctx.now);
      case "guess": {
        const g = normalise(move.text);
        const target = normalise(s.word!);
        if (g === target || g === `${target}s` || `${g}s` === target) {
          const left = Math.max(0, s.deadline - ctx.now);
          const solved = [...(s.solved ?? []), { by, points: 100 + Math.round((left / s.drawMs) * 200) }];
          const next = { ...s, solved, guesses: [...s.guesses, { text: "", close: false, by, correct: true }] };
          // The round ends once every guesser has it.
          return solved.length >= s.players.length - 1 ? endRound(next, ctx.now) : next;
        }
        return { ...s, guesses: [...s.guesses, { text: move.text.slice(0, 40), close: nearlyEqual(g, target), by }] };
      }
    }
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const drawer = drawerOf(s);
    const isDrawer = player === drawer;
    return {
      players: s.players,
      me: player,
      drawer,
      round: s.round,
      rounds: s.rounds,
      phase: s.phase,
      options: isDrawer && s.phase === "choosing" ? s.options : null,
      word: isDrawer || s.winner ? s.word : null,
      pattern: s.word && !isDrawer ? s.word.replace(/[^\s]/g, "_").split("").join(" ") : null,
      deadline: s.deadline,
      drawMs: s.drawMs,
      guesses: s.guesses,
      solvers: (s.solved ?? []).map((g) => g.by),
      scores: s.scores,
      history: s.history,
      winner: s.winner,
    };
  },
};
