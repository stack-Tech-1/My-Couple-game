import { describe, expect, it } from "vitest";
import { DAYS, FRY_SECONDS, QUICK, TUTORIAL_ORDER, UPGRADES, buyGas, gasLeft, rushTime, tutorialStep, areaIndex, dayOpen, upgradePrice, add, bin, careerDay, configFor, fry, newMama, newOnDay, select, serve, stars, tick, waiting, type MamaConfig, type MamaState } from "./mama";

/**
 * A test player that plays like a person who knows the game: it looks after whoever is closest
 * to leaving, keeps dodo frying ahead of time, bins a wrong plate, and takes `react` seconds per
 * tap (a steady player is about 0.7s, a slow one 1.6s).
 */
export function autoplay(seed: string, cfg: MamaConfig, react: number): MamaState {
  let s = newMama(seed, cfg);
  let busy = 0;
  const dt = 0.1;
  while (!s.over) {
    s = tick(seed, s, dt);
    busy -= dt;
    if (busy > 0) continue;
    const act = (next: MamaState) => {
      s = next;
      busy = react;
    };
    const queue = s.spots
      .map((c, i) => ({ c, i }))
      .filter((x) => waiting(x.c))
      .sort((a, b) => a.c!.patience - b.c!.patience);
    const wantsDodo = queue.some((x) => x.c!.order.includes("dodo") && !s.plates[x.i]!.includes("dodo"));
    // Out of gas with dodo wanted: buy a cylinder if the takings allow.
    if (wantsDodo && gasLeft(s) <= 0 && s.fry.stage !== "ready") {
      const r = buyGas(s);
      if (r.ok) {
        act(r.state);
        continue;
      }
    }
    if (wantsDodo && (s.fry.stage === "idle" || s.fry.stage === "burnt") && gasLeft(s) > 0) {
      act(fry(s));
      continue;
    }
    // Work on the most urgent order that can be finished now.
    const target = queue.find((x) => x.c!.order.some((it) => !s.plates[x.i]!.includes(it) && (it !== "dodo" || s.fry.stage === "ready"))) ?? queue[0];
    if (!target) continue;
    if (s.selected !== target.i) {
      act(select(s, target.i));
      continue;
    }
    const plate = s.plates[target.i]!;
    if (plate.some((it) => !target.c!.order.includes(it))) {
      act(bin(s));
      continue;
    }
    const missing = target.c!.order.find((it) => !plate.includes(it) && (it !== "dodo" || s.fry.stage === "ready"));
    if (missing) {
      act(add(s, missing).state);
      continue;
    }
    if (target.c!.order.every((it) => plate.includes(it))) act(serve(s, target.i).state);
  }
  return s;
}

const seeds = ["a", "b", "c", "d", "e", "f"];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const takings = (cfg: MamaConfig, react: number) => median(seeds.map((sd) => autoplay(sd, cfg, react).money));

describe("Mama Put career and difficulty", () => {
  it("every career day is fair: sharp players can get 3 stars, good players 2 (1 in Victoria Island), and slow players get through Yaba and Ikeja", () => {
    for (let d = 1; d <= DAYS; d++) {
      const cfg = careerDay(d);
      expect(stars(takings(cfg, 0.7), cfg), `day ${d}, sharp`).toBe(3);
      expect(stars(takings(cfg, 1.0), cfg), `day ${d}, good`).toBeGreaterThanOrEqual(d <= 24 ? 2 : 1);
      if (d <= 12) expect(stars(takings(cfg, 1.6), cfg), `day ${d}, slow`).toBeGreaterThanOrEqual(1);
    }
  });

  it("difficulties really differ", () => {
    const slow = (k: keyof typeof QUICK) => takings(QUICK[k], 1.3);
    expect(slow("easy")).toBeGreaterThan(slow("normal"));
    expect(slow("normal")).toBeGreaterThan(slow("hard"));
    for (const k of ["easy", "normal", "hard"] as const) expect(stars(takings(QUICK[k], 0.7), QUICK[k]), k).toBe(3);
    expect(stars(takings(QUICK.easy, 1.6), QUICK.easy)).toBeGreaterThanOrEqual(1);
  });

  it("orders only use what's on the day's menu", () => {
    for (const d of [1, 2, 3, 5, 9, 13]) {
      const cfg = careerDay(d);
      let s = newMama(`menu-${d}`, cfg);
      for (let i = 0; i < 600 && !s.over; i++) {
        s = tick(`menu-${d}`, s, 0.1);
        for (const c of s.spots) if (c) for (const it of c.order) expect(cfg.menu).toContain(it);
      }
    }
  });

  it("introduces new dishes along the way", () => {
    expect(newOnDay(1)).toEqual(["jollof", "chicken", "drink"]);
    expect(newOnDay(5)).toEqual(["dodo"]);
    expect(newOnDay(13)).toEqual(["moin"]);
    expect(careerDay(30).menu).toHaveLength(11);
  });

  it("shop upgrades: ambience counts half in Yaba, three quarters in Ikeja, fully after; never in quick rushes", () => {
    const all = UPGRADES.map((u) => u.id);
    expect(configFor("hard", all)).toBe(QUICK.hard);
    expect(configFor("day-3", all).patience).toBeCloseTo(careerDay(3).patience * 1.2, 5);
    expect(configFor("day-10", all).patience).toBeCloseTo(careerDay(10).patience * 1.3, 5);
    expect(configFor("day-25", all).patience).toBeCloseTo(careerDay(25).patience * 1.4, 5);
    expect(configFor("day-12", ["fan"]).patience).toBeGreaterThan(careerDay(12).patience);
    expect(configFor("day-12", ["fan"]).patience).toBeLessThan(careerDay(12).patience * 1.05);
    // A slow player on the last day does clearly better in a fully kitted buka.
    expect(takings(configFor("day-30", all), 1.3)).toBeGreaterThan(takings(careerDay(30), 1.3) * 1.2);
  });

  it("kitchen upgrades: the big pan fries faster, non-stick burns later, the tip jar pays more", () => {
    const cfg = configFor("day-8", ["big-pan", "non-stick", "tip-jar"]);
    let s = fry(newMama("pan", cfg));
    s = tick("pan", s, FRY_SECONDS / 1.5 + 0.01);
    expect(s.fry.stage).toBe("ready");
    s = tick("pan", s, 9);
    expect(s.fry.stage).toBe("ready");
    expect(cfg.tips).toBe(1.1);
    expect(cfg.owned).toEqual(["big-pan", "non-stick", "tip-jar"]);
  });

  it("prices rise by area, days open in order", () => {
    expect(upgradePrice(0, "fan")).toBe(15000);
    expect(upgradePrice(1, "fan")).toBe(22500);
    expect(upgradePrice(4, "paint")).toBe(480000);
    expect(areaIndex(6)).toBe(0);
    expect(areaIndex(7)).toBe(1);
    expect(areaIndex(30)).toBe(4);
    const best: Record<number, number> = { 1: careerDay(1).stars[0], 2: careerDay(2).stars[0] - 1 };
    expect(dayOpen(1, () => undefined)).toBe(true);
    expect(dayOpen(2, (d) => best[d])).toBe(true);
    expect(dayOpen(3, (d) => best[d])).toBe(false);
  });

  it("gas: the flame uses it, frying stops when it's out, and a refill comes out of the takings", () => {
    const cfg = { ...careerDay(8), gas: 4 };
    let s = fry(newMama("gas", cfg));
    s = tick("gas", s, 3.5);
    expect(s.fry.stage).toBe("ready");
    s = tick("gas", s, 1);
    expect(gasLeft(s)).toBe(0);
    // No gas: the ready dodo stays ready (no flame, no burning), and nothing new can fry.
    s = tick("gas", s, 20);
    expect(s.fry.stage).toBe("ready");
    s = { ...s, fry: { stage: "idle", t: 0 } };
    expect(fry(s).fry.stage).toBe("idle");
    // A refill needs the money.
    expect(buyGas({ ...s, money: 100 }).ok).toBe(false);
    const r = buyGas({ ...s, money: 5000 });
    expect(r.ok).toBe(true);
    expect(r.state.money).toBe(5000 - cfg.gasPrice!);
    expect(gasLeft(r.state)).toBe(4);
    expect(fry(r.state).fry.stage).toBe("frying");
    // Gas costs more in the fancier areas.
    expect(careerDay(3).gasPrice).toBe(800);
    expect(careerDay(28).gasPrice).toBe(3200);
  });

  it("tutorial: one customer, no clock, step by step, then the day begins", () => {
    const seed = "tut";
    let s = newMama(seed, configFor("day-1", [], { tutorial: true }));
    expect(configFor("day-2", [], { tutorial: true }).tutorial).toBeUndefined();
    for (let i = 0; i < 300; i++) s = tick(seed, s, 0.5);
    // Two and a half minutes in: still one customer, patience untouched, the day not started.
    expect(s.over).toBe(false);
    expect(rushTime(s)).toBe(0);
    expect(s.spots.filter(Boolean)).toHaveLength(1);
    const c = s.spots[0]!;
    expect(c.order).toEqual([...TUTORIAL_ORDER]);
    expect(c.patience).toBe(c.max);
    expect(tutorialStep(s)).toEqual({ kind: "add", item: "jollof" });
    s = select(s, 2);
    expect(tutorialStep(s)).toEqual({ kind: "plate" });
    s = select(s, 0);
    for (const it of TUTORIAL_ORDER) s = add(s, it).state;
    expect(tutorialStep(s)).toEqual({ kind: "serve" });
    s = serve(s, 0).state;
    expect(s.tut).toBe(false);
    expect(tutorialStep(s)).toBeNull();
    // Now the real day: more customers come, and it ends a minute later.
    for (let i = 0; i < 40; i++) s = tick(seed, s, 0.5);
    expect(s.spots.filter((x) => x && !x.leaving).length).toBeGreaterThan(1);
    for (let i = 0; i < 100 && !s.over; i++) s = tick(seed, s, 0.5);
    expect(s.over).toBe(true);
  });

  it("reads modes", () => {
    expect(configFor("hard")).toBe(QUICK.hard);
    expect(configFor("day-4").seconds).toBe(75);
    expect(configFor("whatever")).toBe(QUICK.normal);
  });
});
