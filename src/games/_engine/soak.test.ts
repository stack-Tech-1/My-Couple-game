import { describe, expect, it } from "vitest";
import { GAME_LOGIC } from "@/games/logic";
import { makeRng } from "@/games/_engine/rng";
import { BOT_ID, botMove, type BotBase } from "@/lib/solo/bots";

/**
 * Long-session soak: whole games played move by move the way the server plays them (state saved
 * as JSON and read back between moves, every player's view rebuilt), checking that moves don't
 * get slower and the saved state doesn't keep growing as a game goes on. This is the shape of the
 * old Ludo stall, where each roll took longer than the last.
 */
const BASES: BotBase[] = ["whot", "ludo", "ayo", "draughts", "tic-tac-toe", "connect-four", "box-am"];
const GAMES_EACH = 4;

describe("long sessions stay fast", () => {
  for (const base of BASES) {
    it(`${base}: moves stay as quick at the end of a game as at the start, and the state stays small`, () => {
      const logic = GAME_LOGIC[base]!;
      const players = ["me", BOT_ID];
      const rng = makeRng(`soak-${base}`);
      const ctx = { now: 0 };
      let totalMoves = 0;
      for (let g = 0; g < GAMES_EACH; g++) {
        const config = logic.configSchema ? logic.configSchema.parse({}) : {};
        let s: unknown = JSON.parse(JSON.stringify(logic.initialState(`soak-${base}-${g}`, players, config as never, ctx)));
        const times: number[] = [];
        let biggest = 0;
        for (let k = 0; k < 3000 && !logic.isOver(s).over; k++) {
          const theirs = botMove(base, logic, s, BOT_ID, "medium", ctx, rng.next);
          const m = theirs ?? botMove(base, logic, s, "me", "easy", ctx, rng.next);
          if (m === null) break;
          const by = theirs !== null ? BOT_ID : "me";
          const t0 = performance.now();
          const move = logic.moveSchema.parse(m);
          if (!logic.validateMove(s, move, by, ctx)) throw new Error(`${base}: the bot made an illegal move`);
          const next = logic.applyMove(s, move, by, ctx);
          for (const p of players) logic.viewFor(next, p);
          const saved = JSON.stringify(next);
          s = JSON.parse(saved);
          times.push(performance.now() - t0);
          biggest = Math.max(biggest, saved.length);
        }
        totalMoves += times.length;
        // The slowest stretch late in the game is no worse than a few times the early moves.
        if (times.length >= 40) {
          const fifth = Math.floor(times.length / 5);
          // Medians, so one hiccup from a busy machine doesn't count as a slowdown.
          const avg = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
          const early = avg(times.slice(0, fifth));
          const late = avg(times.slice(-fifth));
          expect(late, `${base} game ${g}: early ${early.toFixed(2)}ms, late ${late.toFixed(2)}ms over ${times.length} moves`).toBeLessThan(early * 4 + 2);
        }
        // Every move must be quick in absolute terms too (server time per move, phone time per render).
        expect(Math.max(...times), `${base} game ${g}: slowest move`).toBeLessThan(250);
        expect(biggest, `${base} game ${g}: state size`).toBeLessThan(150_000);
      }
      expect(totalMoves).toBeGreaterThan(GAMES_EACH * 4);
    }, 120_000);
  }
});
