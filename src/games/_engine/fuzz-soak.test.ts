import { describe, expect, it } from "vitest";
import { GAME_LOGIC } from "@/games/logic";
import { makeRng } from "@/games/_engine/rng";
import { ANSWERS } from "@/content/words/answers5";
import { fuzzMove, type FuzzHints } from "./fuzz-player";

/**
 * Long-session soak for the games without a bot: a test player that only knows each game's move
 * shapes plays whole games the way the server does (state saved as JSON between moves, every
 * view rebuilt). Nothing may throw, moves may not slow down as the game goes on, and the saved
 * state may not keep growing. The bot games have their own soak (soak.test.ts).
 */
const BOT_GAMES = new Set(["whot", "ludo", "ayo", "draughts", "tic-tac-toe", "connect-four", "box-am"]);
const IDS = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b", "00000000-0000-4000-8000-00000000000c", "00000000-0000-4000-8000-00000000000d"];
const games = Object.values(GAME_LOGIC).filter((g) => !BOT_GAMES.has(g.id));

describe("long sessions stay fast: games without a bot", () => {
  for (const logic of games) {
    const sizes = [...new Set([Math.max(2, logic.minPlayers), Math.min(4, logic.maxPlayers)])];
    for (const n of sizes) {
      it(`${logic.id} with ${n}: plays through without errors, slowdown or runaway state`, () => {
        const players = IDS.slice(0, n);
        const rng = makeRng(`fuzz-${logic.id}-${n}`);
        const hints: FuzzHints = { players, words: ANSWERS.slice(0, 400) };
        const ctx = { now: 1_700_000_000_000, isWord: () => true };
        const config = logic.configSchema ? logic.configSchema.parse({}) : {};
        let s: unknown = JSON.parse(JSON.stringify(logic.initialState(`fuzz-${logic.id}`, players as never, config as never, ctx)));
        const times: number[] = [];
        let biggest = 0;
        let stuck = 0;
        for (let k = 0; k < 1500 && !logic.isOver(s).over && stuck < 60; k++) {
          let moved = false;
          // Whoever has a legal move takes it (turn games: one player; simultaneous games: anyone).
          for (const by of [...players].sort(() => rng.next() - 0.5)) {
            const m = fuzzMove(logic, s, by, ctx, rng.next, hints);
            if (m === null) continue;
            const t0 = performance.now();
            const next = logic.applyMove(s, m, by, ctx);
            for (const p of players) logic.viewFor(next, p);
            const saved = JSON.stringify(next);
            s = JSON.parse(saved);
            times.push(performance.now() - t0);
            biggest = Math.max(biggest, saved.length);
            moved = true;
            break;
          }
          // Nobody can move: time passes (timers, reveals, rounds that close on the clock).
          ctx.now += moved ? 1500 : 31_000;
          stuck = moved ? 0 : stuck + 1;
        }
        expect(times.length, `${logic.id}: the test player found no legal move at all`).toBeGreaterThan(0);
        if (times.length >= 40) {
          const fifth = Math.floor(times.length / 5);
          // Medians, so one hiccup from a busy machine doesn't count as a slowdown.
          const avg = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
          const early = avg(times.slice(0, fifth));
          const late = avg(times.slice(-fifth));
          expect(late, `${logic.id}: early ${early.toFixed(2)}ms, late ${late.toFixed(2)}ms over ${times.length} moves`).toBeLessThan(early * 4 + 3);
        }
        expect(Math.max(...times), `${logic.id}: slowest move`).toBeLessThan(250);
        expect(biggest, `${logic.id}: state size`).toBeLessThan(200_000);
        console.log(`[fuzz] ${logic.id} x${n}: ${times.length} moves, ${logic.isOver(s).over ? "finished" : "still going"}, max state ${(biggest / 1024).toFixed(1)} KB, slowest ${Math.max(...times).toFixed(1)} ms`);
      }, 120_000);
    }
  }
});
