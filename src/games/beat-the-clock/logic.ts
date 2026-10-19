import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle, type Rng } from "@/games/_engine/rng";

export const ROUND_MS = 60_000;
export const COUNTDOWN_MS = 3_000;
export const TARGET = 20;
export const WRONG_PENALTY_MS = 2_000;

export const INKS = { red: "#c8402a", blue: "#3d6e8f", green: "#5f7a4f", gold: "#b8893b" } as const;
type Ink = keyof typeof INKS;

const GROUPS: Record<string, string[]> = {
  fruit: ["apple", "mango", "pear", "plum", "grape", "lemon", "peach", "cherry"],
  animal: ["otter", "zebra", "tiger", "camel", "panda", "goat", "whale", "fox"],
  instrument: ["drum", "flute", "violin", "piano", "harp", "trumpet", "cello", "banjo"],
  vehicle: ["bus", "tram", "ferry", "truck", "scooter", "taxi", "van", "train"],
  weather: ["rain", "fog", "sleet", "hail", "snow", "drizzle", "thunder", "breeze"],
  furniture: ["sofa", "desk", "stool", "shelf", "bench", "wardrobe", "dresser", "bed"],
};

export type Challenge =
  | { kind: "math"; prompt: string; options: string[]; answer: number }
  | { kind: "stroop"; word: Ink; ink: Ink; options: string[]; answer: number }
  | { kind: "odd"; options: string[]; answer: number };

/** Deterministic challenge for one player's k-th step. Lives server-side only. */
export function challenge(seed: string, seat: number, k: number): Challenge {
  const rng: Rng = makeRng(`${seed}:${seat}:${k}`);
  const kind = ["math", "stroop", "odd"][rng.int(3)]!;
  if (kind === "math") {
    const op = rng.int(3);
    const a = 2 + rng.int(op === 2 ? 11 : 40);
    const b = 2 + rng.int(op === 2 ? 11 : 30);
    const [prompt, value] = op === 0 ? [`${a} + ${b}`, a + b] : op === 1 ? [`${Math.max(a, b)} − ${Math.min(a, b)}`, Math.abs(a - b)] : [`${a} × ${b}`, a * b];
    const wrong = new Set<number>();
    while (wrong.size < 3) {
      const d = (1 + rng.int(op === 2 ? 12 : 9)) * (rng.int(2) ? 1 : -1);
      if (value + d >= 0) wrong.add(value + d);
    }
    const options = shuffle([value, ...wrong], rng).map(String);
    return { kind: "math", prompt, options, answer: options.indexOf(String(value)) };
  }
  if (kind === "stroop") {
    const names = Object.keys(INKS) as Ink[];
    const word = names[rng.int(4)]!;
    let ink = names[rng.int(4)]!;
    if (ink === word) ink = names[(names.indexOf(word) + 1 + rng.int(3)) % 4]!;
    const options = shuffle(names, rng);
    return { kind: "stroop", word, ink, options, answer: options.indexOf(ink) };
  }
  const groups = shuffle(Object.keys(GROUPS), rng);
  const main = shuffle(GROUPS[groups[0]!]!, rng).slice(0, 3);
  const odd = GROUPS[groups[1]!]![rng.int(8)]!;
  const options = shuffle([...main, odd], rng);
  return { kind: "odd", options, answer: options.indexOf(odd) };
}

/** What the client gets: the challenge without its answer. */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type PublicChallenge = DistOmit<Challenge, "answer">;
const hide = (c: Challenge): PublicChallenge => {
  const { answer: _a, ...rest } = c;
  return rest as PublicChallenge;
};

export type ClockState = {
  players: Players;
  seed: string;
  phase: "lobby" | "live";
  ready: Record<PlayerId, boolean>;
  startsAt: number | null;
  deadline: number | null;
  score: number;
  steps: Record<PlayerId, number>;
  rights: Record<PlayerId, number>;
  wrongs: number;
  lastWrong: Record<PlayerId, number | null>;
  result: "win" | "loss" | null;
};
export type ClockMove = { type: "ready" } | { type: "answer"; step: number; choice: number } | { type: "tick" };
export type ClockView = Omit<ClockState, "seed"> & { me: PlayerId; current: PublicChallenge | null; target: number };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("answer"), step: z.number().int().min(0).max(10_000), choice: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal("tick") }),
]);

const seat = (s: ClockState, p: PlayerId) => (s.players[0] === p ? 0 : 1);

export const beatTheClock: GameLogic<ClockState, ClockMove, ClockView> = {
  id: "beat-the-clock",
  category: "coop",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 5,
  moveSchema,
  rules: {
    summary: `Sixty seconds, one shared score. Hit ${TARGET} together to beat the clock.`,
    sections: [
      { title: "Challenges", body: ["Quick sums, odd ones out, and colour words printed in the wrong colour (tap the ink, not the word).", "You each get your own stream; every right answer counts for the team."] },
      { title: "Mistakes", body: ["A wrong answer knocks two seconds off the shared clock. Speed matters, but so does not panicking."] },
    ],
  },

  initialState(seed, players) {
    const zero = { [players[0]]: 0, [players[1]]: 0 };
    return {
      players,
      seed,
      phase: "lobby",
      ready: { [players[0]]: false, [players[1]]: false },
      startsAt: null,
      deadline: null,
      score: 0,
      steps: zero,
      rights: zero,
      wrongs: 0,
      lastWrong: { [players[0]]: null, [players[1]]: null },
      result: null,
    };
  },

  validateMove(s, move, by, ctx) {
    if (s.result) return false;
    if (move.type === "ready") return s.phase === "lobby" && !s.ready[by];
    if (s.phase !== "live") return false;
    if (move.type === "tick") return ctx.now >= s.deadline!;
    return move.step === s.steps[by] && ctx.now >= s.startsAt! - 250 && ctx.now <= s.deadline! + 500;
  },

  applyMove(s, move, by, ctx) {
    if (move.type === "ready") {
      const ready = { ...s.ready, [by]: true };
      if (!s.players.every((p) => ready[p])) return { ...s, ready };
      const startsAt = ctx.now + COUNTDOWN_MS;
      return { ...s, ready, phase: "live", startsAt, deadline: startsAt + ROUND_MS };
    }
    if (move.type === "tick") return { ...s, result: s.score >= TARGET ? "win" : "loss" };

    const c = challenge(s.seed, seat(s, by), move.step);
    const right = c.answer === move.choice;
    const score = s.score + (right ? 1 : 0);
    return {
      ...s,
      score,
      steps: { ...s.steps, [by]: s.steps[by]! + 1 },
      rights: right ? { ...s.rights, [by]: s.rights[by]! + 1 } : s.rights,
      wrongs: s.wrongs + (right ? 0 : 1),
      lastWrong: { ...s.lastWrong, [by]: right ? null : move.step },
      deadline: right ? s.deadline : s.deadline! - WRONG_PENALTY_MS,
      result: score >= TARGET ? "win" : null,
    };
  },

  isOver(s): Outcome {
    return s.result ? { over: true, coop: s.result } : { over: false };
  },

  viewFor(s, player) {
    const { seed, ...rest } = s;
    return {
      ...rest,
      me: player,
      target: TARGET,
      current: s.phase === "live" && !s.result ? hide(challenge(seed, seat(s, player), s.steps[player]!)) : null,
    };
  },
};
