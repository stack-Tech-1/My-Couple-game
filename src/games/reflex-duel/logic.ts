import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { makeRng } from "@/games/_engine/rng";

export const WINS_NEEDED = 4; // best of 7
export const MIN_HUMAN_MS = 90; // faster than this is anticipation, not reaction
export const MAX_MS = 2000;
export const ROUND_TIMEOUT_MS = 2500; // after the signal
const EARLY_GRACE_MS = 250; // server-side tolerance for clock skew when judging false starts

export type Tap = { kind: "tap"; ms: number } | { kind: "early" };
export type RoundResult = {
  n: number;
  winner: PlayerId | null;
  reason: "faster" | "false-start" | "no-show" | "replay";
  taps: Record<PlayerId, Tap | null>;
};

export type ReflexState = {
  players: PlayerList;
  seed: string;
  rngCursor: number;
  phase: "lobby" | "armed";
  ready: Record<PlayerId, boolean>;
  round: number;
  /** Server time the signal fires for the current round. */
  goAt: number | null;
  taps: Record<PlayerId, Tap | null>;
  score: Record<PlayerId, number>;
  results: RoundResult[];
  winner: PlayerId | null;
};

/** ms: reaction measured on the tapper's own screen, from the moment the signal was drawn. null = tapped before it. */
export type ReflexMove = { type: "ready" } | { type: "tap"; ms: number | null } | { type: "tick" };
export type ReflexView = Omit<ReflexState, "seed" | "rngCursor"> & { me: PlayerId };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("tap"), ms: z.number().min(0).max(60_000).nullable() }),
  z.object({ type: z.literal("tick") }),
]);

/** Random gap before the signal: long enough to be tense, short enough not to be boring. */
function nextGoAt(s: ReflexState, now: number, pause: number) {
  const rng = makeRng(s.seed, s.rngCursor);
  const goAt = now + pause + 1500 + rng.int(3500);
  return { goAt, rngCursor: rng.cursor() };
}

function resolve(s: ReflexState, now: number, result: Omit<RoundResult, "n" | "taps">): ReflexState {
  const score = { ...s.score };
  if (result.winner) score[result.winner] = score[result.winner]! + 1;
  const results = [...s.results, { ...result, n: s.round, taps: s.taps }].slice(-12);
  const champion = s.players.find((p) => score[p]! >= WINS_NEEDED) ?? null;
  const empty = Object.fromEntries(s.players.map((p) => [p, null]));
  if (champion) return { ...s, score, results, winner: champion, goAt: null, taps: empty };
  const { goAt, rngCursor } = nextGoAt(s, now, 1800);
  return { ...s, score, results, round: s.round + 1, goAt, rngCursor, taps: empty };
}

/**
 * Settles the round once nobody else can change it. Two players: a false start hands the point over
 * at once. Groups: a false start knocks you out of the round; the fastest clean tap wins once every
 * clean player has tapped, or the last one standing wins if everyone else jumped.
 */
function settle(s: ReflexState, now: number): ReflexState {
  const early = s.players.filter((p) => s.taps[p]?.kind === "early");
  const clean = s.players.filter((p) => s.taps[p]?.kind !== "early");
  if (!clean.length) return resolve(s, now, { winner: null, reason: "replay" });
  if (clean.length === 1 && early.length) return resolve(s, now, { winner: clean[0]!, reason: "false-start" });
  if (!clean.every((p) => s.taps[p])) return s;
  const times = clean.map((p) => ({ p, ms: (s.taps[p] as { ms: number }).ms }));
  const best = Math.min(...times.map((t) => t.ms));
  const fastest = times.filter((t) => t.ms === best);
  return resolve(s, now, fastest.length === 1 ? { winner: fastest[0]!.p, reason: "faster" } : { winner: null, reason: "replay" });
}

export const reflexDuel: GameLogic<ReflexState, ReflexMove, ReflexView, Record<string, never>, PlayerList> = {
  id: "reflex-duel",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 3,
  moveSchema,
  rules: {
    summary: "Wait for the screen to change, then tap. Fastest finger takes the round. First to four wins.",
    sections: [
      { title: "Each round", body: ["The screen holds dark for a random few seconds. When it flashes, tap anywhere (or hit space).", "Your time is measured on your own phone, so a slow connection won't cost you."] },
      { title: "False starts", body: ["Tap before the flash and you're out of the round. Two players: your opponent takes the point. Everyone jumps the gun? Replay."] },
      { title: "Winning", body: ["Best of seven: first to four rounds."] },
    ],
  },

  initialState(seed, players) {
    const each = <T,>(v: T) => Object.fromEntries(players.map((p) => [p, v])) as Record<PlayerId, T>;
    return {
      players: [...players],
      seed,
      rngCursor: 0,
      phase: "lobby",
      ready: each(false),
      round: 1,
      goAt: null,
      taps: each<Tap | null>(null),
      score: each(0),
      results: [],
      winner: null,
    };
  },

  validateMove(s, move, by, ctx) {
    if (s.winner) return false;
    if (move.type === "ready") return s.phase === "lobby" && !s.ready[by];
    if (s.phase !== "armed" || s.goAt === null) return false;
    if (move.type === "tap") return s.taps[by] === null;
    return ctx.now >= s.goAt + ROUND_TIMEOUT_MS; // tick
  },

  applyMove(s, move, by, ctx) {
    if (move.type === "ready") {
      const ready = { ...s.ready, [by]: true };
      if (!s.players.every((p) => ready[p])) return { ...s, ready };
      const { goAt, rngCursor } = nextGoAt(s, ctx.now, 1000);
      return { ...s, ready, phase: "armed", goAt, rngCursor };
    }

    if (move.type === "tick") {
      // Time's up: anyone who hasn't tapped is out of this round.
      const tapped = s.players.filter((p) => s.taps[p]?.kind === "tap");
      if (!tapped.length) return resolve(s, ctx.now, { winner: null, reason: "replay" });
      const times = tapped.map((p) => ({ p, ms: (s.taps[p] as { ms: number }).ms }));
      const best = Math.min(...times.map((t) => t.ms));
      const fastest = times.filter((t) => t.ms === best);
      return resolve(s, ctx.now, fastest.length === 1 ? { winner: fastest[0]!.p, reason: tapped.length === 1 ? "no-show" : "faster" } : { winner: null, reason: "replay" });
    }

    // A tap. The server's own clock decides gross false starts; the client's flag covers the rest.
    const early = move.ms === null || ctx.now < s.goAt! - EARLY_GRACE_MS || move.ms < MIN_HUMAN_MS;
    const tap: Tap = early ? { kind: "early" } : { kind: "tap", ms: Math.round(Math.min(move.ms!, MAX_MS)) };
    return settle({ ...s, taps: { ...s.taps, [by]: tap } }, ctx.now);
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const { seed: _seed, rngCursor: _cursor, ...rest } = s;
    return { ...rest, me: player };
  },
};
