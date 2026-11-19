import { describe, expect, it } from "vitest";
import { soloGame } from "./catalog";
import { BALL_R, PLANK_Y, START_LIVES, launch, newBash, stepBash, wall, type BashState } from "./games/bash";
import { CAP, dealLevel, drinksFor, isWon, newZobo, pour, pourAmount, solvable, undo, zoboScore } from "./games/zobo";
import { RIM_Y, multiplier, newCatch, stepCatch, type CatchState } from "./games/catch";
import { BED_Y, START_BITES, newMosquito, stepMosquito, waveSize } from "./games/mosquito";
import { FRY_SECONDS, BURN_AFTER, RUSH_SECONDS, add, bin, fry, newMama, orderPrice, serve, stars, tick, type MamaState } from "./games/mama";
import { PEGS, RINGS, TIME_LIMIT, clockText, hung, newPump, pump, pumpResult, pumpScore, stepPump, type PumpState } from "./games/pump";

const run = (s: PumpState, steps: number) => {
  for (let i = 0; i < steps && !s.over; i++) s = stepPump(s);
  return s;
};

describe("Pump Am", () => {
  it("starts the same rings for the same seed, all floating", () => {
    expect(newPump("a")).toEqual(newPump("a"));
    expect(newPump("a").rings).toHaveLength(RINGS);
    expect(hung(newPump("a"))).toBe(0);
  });

  it("a pump lifts the rings on its side", () => {
    const s = newPump("lift");
    const lifted = run(pump("lift", s, 0), 20);
    const still = run(s, 20);
    const leftY = (x: PumpState) => x.rings.filter((r) => r.x < 120).reduce((t, r) => t + r.y, 0);
    expect(leftY(lifted)).toBeLessThan(leftY(still));
  });

  it("a flat ring sinking over a peg slides on and stays", () => {
    const s = newPump("peg");
    const peg = PEGS[0];
    const ring = { ...s.rings[0]!, x: peg.x, y: peg.tip - 20, vx: 0, vy: 30, tumble: 0, spin: 0 };
    let t: PumpState = { ...s, rings: [ring, ...s.rings.slice(1)] };
    t = run(t, 60);
    expect(t.rings[0]!.peg).toBe(0);
    // Pumping can't knock it off.
    t = run(pump("peg", t, 0), 120);
    expect(t.rings[0]!.peg).toBe(0);
    expect(t.rings[0]!.y).toBeGreaterThan(peg.tip);
  });

  it("a ring on its edge bounces off the peg instead", () => {
    const s = newPump("edge");
    const peg = PEGS[1];
    const ring = { ...s.rings[0]!, x: peg.x, y: peg.tip - 20, vx: 0, vy: 30, tumble: Math.PI / 2, spin: 0 };
    const t = run({ ...s, rings: [ring, ...s.rings.slice(1)] }, 60);
    expect(t.rings[0]!.peg).toBeNull();
  });

  it("ends at the time limit, and scores rings plus a bonus only for all ten", () => {
    const s = run(newPump("time"), TIME_LIMIT * 60 + 5);
    expect(s.over).toBe(true);
    const some = { ...s, rings: s.rings.map((r, i) => ({ ...r, peg: i < 3 ? 0 : null })) };
    expect(pumpScore(some)).toBe(300);
    const all = { ...s, time: 60, rings: s.rings.map((r) => ({ ...r, peg: 1 })) };
    expect(pumpScore(all)).toBe(1000 + 120 * 20);
    // The server's plausibility check lets real scores through.
    expect(pumpScore(all)).toBeLessThanOrEqual(soloGame("pump-am")!.cap(60));
    // And back again, for the finish screen and the poster.
    expect(pumpResult(pumpScore(some))).toEqual({ rings: 3, seconds: null });
    expect(pumpResult(pumpScore(all))).toEqual({ rings: 10, seconds: 60 });
    expect(pumpResult(0)).toEqual({ rings: 0, seconds: null });
    expect(clockText(84)).toBe("1:24");
  });
});

describe("Bash Am", () => {
  const stepN = (s: BashState, n: number, x = s.plank) => {
    for (let i = 0; i < n && !s.over; i++) s = stepBash("b", s, x).state;
    return s;
  };

  it("builds the same wall for the same seed, bigger and tougher on later streets", () => {
    expect(wall("b", 1)).toEqual(wall("b", 1));
    expect(wall("b", 1).every((k) => !k.tough)).toBe(true);
    expect(wall("b", 5).some((k) => k.tough)).toBe(true);
    for (let l = 1; l < 12; l++) expect(wall("b", l).length).toBeGreaterThan(5);
  });

  it("waits on the plank until launched, then flies", () => {
    const s = stepN(newBash("b"), 30, 100);
    expect(s.launched).toBe(false);
    expect(s.ball.x).toBe(s.plank);
    const t = stepN(launch("b", s), 30);
    expect(t.ball.y).toBeLessThan(PLANK_Y - BALL_R - 5);
  });

  it("breaks a brick it hits and scores it", () => {
    let s = launch("b", newBash("b"));
    const k = s.bricks[s.bricks.length - 1]!;
    s = { ...s, ball: { x: 7 + k.col * 50 + 22, y: 70 + k.row * 26 + 40, vx: 0, vy: -300 } };
    const before = s.bricks.length;
    s = stepN(s, 30, s.plank);
    expect(s.bricks.length).toBe(before - 1);
    expect(s.score).toBeGreaterThan(0);
  });

  it("loses a ball when it falls past the plank, and ends after the last one", () => {
    let s = launch("b", newBash("b"));
    s = { ...s, ball: { x: 20, y: PLANK_Y + 30, vx: 0, vy: 300 } };
    s = stepN(s, 60, 300);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.launched).toBe(false);
    s = { ...launch("b", s), lives: 1, ball: { x: 20, y: PLANK_Y + 30, vx: 0, vy: 300 } };
    s = stepN(s, 60, 300);
    expect(s.over).toBe(true);
  });

  it("moves on to the next street when the wall is gone", () => {
    let s = launch("b", newBash("b"));
    s = { ...s, bricks: [] };
    const r = stepBash("b", s, s.plank);
    expect(r.ev.cleared).toBe(true);
    expect(r.state.level).toBe(2);
    expect(r.state.bricks.length).toBeGreaterThan(0);
  });
});

describe("Zobo Sort", () => {
  it("deals four of each drink plus two empty bottles, and every deal can be solved", () => {
    for (const level of [1, 3, 7, 12]) {
      const b = dealLevel("z", level);
      const n = drinksFor(level);
      expect(b).toHaveLength(n + 2);
      const counts = Array(n).fill(0);
      b.flat().forEach((d) => counts[d]++);
      expect(counts.every((c) => c === CAP)).toBe(true);
      expect(isWon(b)).toBe(false);
      expect(solvable(b)).toBe(true);
    }
  });

  it("pours onto the same drink or into an empty bottle, as much as fits", () => {
    const bottles = [[0, 1, 1], [2, 1], [], [3, 3, 3, 3]];
    expect(pourAmount(bottles, 0, 1)).toBe(2);
    expect(pourAmount(bottles, 0, 2)).toBe(2);
    expect(pourAmount(bottles, 1, 3)).toBe(0);
    expect(pourAmount(bottles, 2, 0)).toBe(0);
  });

  it("counts moves, undoes up to five times, and knows when it's won", () => {
    let s = { ...newZobo("z", 1), bottles: [[0, 0, 0], [0], []] };
    const t = pour(s, 1, 0)!;
    expect(t.won).toBe(true);
    expect(t.moves).toBe(1);
    expect(zoboScore(t)).toBeGreaterThan(100);
    s = { ...s, bottles: [[0, 1], [1], [], []] };
    let u = pour(s, 0, 1)!;
    u = undo(u)!;
    expect(u.bottles).toEqual(s.bottles);
    expect(u.undosLeft).toBe(4);
    expect(pour(s, 2, 0)).toBeNull();
  });
});

describe("Catch Am", () => {
  const drop = (s: CatchState, kind: "puff" | "pepper", x: number): CatchState => ({ ...s, nextSpawn: 1e9, items: [{ id: 99, kind, x, y: RIM_Y - 4, vy: 300, rot: 0, spin: 0, sway: 0 }] });

  it("catches food in the basket and scores it", () => {
    const r = stepCatch("c", drop(newCatch("c"), "puff", 179), 179);
    expect(r.ev.caught).toHaveLength(1);
    expect(r.state.score).toBe(10);
    expect(r.state.caught).toBe(1);
  });

  it("a pepper costs a life and the combo; three peppers end it", () => {
    let s = { ...newCatch("c"), combo: 5 };
    s = stepCatch("c", drop(s, "pepper", 179), 179).state;
    expect(s.lives).toBe(2);
    expect(s.combo).toBe(0);
    s = stepCatch("c", drop(stepCatch("c", drop(s, "pepper", 179), 179).state, "pepper", 179), 179).state;
    expect(s.over).toBe(true);
  });

  it("food that misses the basket breaks the combo, not a life", () => {
    let s = { ...newCatch("c"), combo: 4, nextSpawn: 1e9 };
    s = { ...s, items: [{ id: 1, kind: "akara", x: 20, y: 579, vy: 300, rot: 0, spin: 0, sway: 0 }] };
    s = stepCatch("c", s, 300).state;
    expect(s.combo).toBe(0);
    expect(s.lives).toBe(3);
    expect(multiplier(3)).toBe(2);
  });

  it("drops food over time, the same for the same seed", () => {
    let a = newCatch("same"), b = newCatch("same");
    for (let i = 0; i < 300; i++) [a, b] = [stepCatch("same", a, 100).state, stepCatch("same", b, 100).state];
    expect(a.items).toEqual(b.items);
    expect(a.items.length + a.caught).toBeGreaterThan(0);
  });
});

describe("Mosquito Wahala", () => {
  it("sends waves that grow, and a spray kills what it touches", () => {
    expect(waveSize(2)).toBeGreaterThan(waveSize(1));
    let s = newMosquito("m");
    s = { ...s, nextSpawn: 1e9, bugs: [{ id: 1, x: 179, y: 300, vx: 0, vy: 0, phase: 0, hp: 1, big: false }], puffs: [{ x: 179, y: 302, r: 10, life: 1 }] };
    const r = stepMosquito("m", s, 179);
    expect(r.ev.hits.some((h) => h.killed)).toBe(true);
    expect(r.state.kills).toBe(1);
  });

  it("a mosquito that reaches the bed bites, unless the net is up", () => {
    const base = { ...newMosquito("m"), nextSpawn: 1e9, nextPuff: 1e9, bugs: [{ id: 1, x: 20, y: BED_Y - 0.1, vx: 0, vy: 0, phase: 0, hp: 1, big: false }] };
    expect(stepMosquito("m", base, 340).state.bites).toBe(START_BITES - 1);
    expect(stepMosquito("m", { ...base, net: 5 }, 340).state.bites).toBe(START_BITES);
    expect(stepMosquito("m", { ...base, bites: 1 }, 340).state.over).toBe(true);
  });
});

describe("Mama Put", () => {
  const run = (s: MamaState, secs: number) => {
    for (let t = 0; t < secs; t += 0.1) s = tick("mp", s, 0.1);
    return s;
  };

  it("customers arrive with an order, and leave unpaid if you take too long", () => {
    let s = run(newMama("mp"), 2);
    const c = s.spots.find(Boolean)!;
    expect(c.order.length).toBeGreaterThanOrEqual(2);
    s = run(s, c.max + 1);
    expect(s.lost).toBeGreaterThan(0);
  });

  it("the right plate is paid with a tip; the wrong one isn't paid at all", () => {
    let s = run(newMama("mp"), 2);
    const i = s.spots.findIndex(Boolean);
    s = { ...s, selected: i, fry: { stage: "ready", t: 0 } };
    for (const item of s.spots[i]!.order) {
      if (item === "dodo") s = { ...s, fry: { stage: "ready", t: 0 } };
      s = add(s, item).state;
    }
    const r = serve(s, i);
    expect(r.right).toBe(true);
    expect(r.paid).toBe(orderPrice(s.spots[i]!.order));
    expect(r.tip).toBeGreaterThan(0);
    expect(r.state.money).toBe(r.paid + r.tip);

    let w = run(newMama("mp2"), 2);
    const j = w.spots.findIndex(Boolean);
    w = { ...w, selected: j };
    w = add(w, "fish").state;
    w = add(w, "egusi").state;
    w = add(w, "drink").state;
    const bad = serve(w, j);
    expect(bad.right).toBe(false);
    expect(bad.state.money).toBe(0);
  });

  it("dodo must be fried, and burns if it's left", () => {
    let s = newMama("mp");
    expect(add(s, "dodo").why).toBe("fry");
    s = fry(s);
    s = run(s, FRY_SECONDS + 0.2);
    expect(s.fry.stage).toBe("ready");
    s = run(s, BURN_AFTER + 0.2);
    expect(s.fry.stage).toBe("burnt");
    expect(fry(s).fry.stage).toBe("frying");
    expect(bin(add(s, "beef").state).plates[s.selected]).toEqual([]);
  });

  it("the rush ends after ninety seconds and stars follow the takings", () => {
    expect(run(newMama("mp"), RUSH_SECONDS + 0.5).over).toBe(true);
    expect([stars(0), stars(7000), stars(13000), stars(20000)]).toEqual([0, 1, 2, 3]);
  });
});
