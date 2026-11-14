import { describe, expect, it } from "vitest";
import { DAYS, FRY_SECONDS, QUICK, UPGRADES, add, bin, careerDay, configFor, fry, newMama, newOnDay, select, serve, stars, tick, waiting, type MamaConfig, type MamaState } from "./mama";

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
    if (wantsDodo && (s.fry.stage === "idle" || s.fry.stage === "burnt")) {
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
    expect(stars(takings(QUICK.easy, 1.6), QUICK.easy)).toBeGreaterThanOrEqual(2);
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

  it("shop upgrades: ambience helps on the hard days only, never in Yaba or quick rushes", () => {
    const all = UPGRADES.map((u) => u.id);
    expect(configFor("day-3", all).patience).toBe(careerDay(3).patience);
    expect(configFor("hard", all)).toBe(QUICK.hard);
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

  it("reads modes", () => {
    expect(configFor("hard")).toBe(QUICK.hard);
    expect(configFor("day-4").seconds).toBe(75);
    expect(configFor("whatever")).toBe(QUICK.normal);
  });
});
