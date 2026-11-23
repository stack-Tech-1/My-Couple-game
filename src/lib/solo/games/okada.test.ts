import { describe, expect, it } from "vitest";
import { BIKE_LEN, FREE, LANES, ROUTES, SIZE, VIEW_AHEAD, fareStop, isTraffic, newOkada, okadaConfig, rankFor, routeConfig, routeOpen, steer, throttle, tick, type OkadaState, type RouteConfig, type Thing } from "./okada";

const BLOCKERS = new Set(["danfo", "keke", "car", "brt", "truck", "suv", "barrier", "deep"]);

/**
 * A test player: every `react` seconds it looks at the road it can see and steers one lane
 * towards the best lane: clear of traffic, then where its passenger's stop or the next passenger
 * is, away from potholes, agberos and LASTMA.
 */
export function autoplay(seed: string, cfg: RouteConfig, react: number, maxSeconds = 600): OkadaState {
  let s = newOkada(seed, cfg);
  let wait = 0;
  const dt = 1 / 30;
  while (!s.over && s.time < maxSeconds) {
    s = tick(seed, s, dt).state;
    wait -= dt;
    if (wait > 0) continue;
    wait = react;
    const front = s.y + BIKE_LEN;
    // How long until each thing reaches the okada, at today's speeds.
    const eta = (t: Thing) => {
      const gap = t.y - front;
      const closing = s.v - (t.stopT ? 0 : t.v);
      if (gap + SIZE[t.kind].len < -BIKE_LEN) return Infinity;
      if (gap <= 0) return 0;
      return closing > 0.1 ? gap / closing : Infinity;
    };
    const horizon = react + 1.3;
    const score = [0, 0, 0];
    for (let lane = 0; lane < LANES; lane++) {
      for (const t of s.things) {
        if (t.done || t.lane !== lane || t.y - front > VIEW_AHEAD) continue;
        const e = eta(t);
        const still = !isTraffic(t.kind) || !!t.stopT;
        if (BLOCKERS.has(t.kind) && still && e < horizon) score[lane]! -= 1000;
        else if (BLOCKERS.has(t.kind) && e < horizon + 1) score[lane]! -= 30;
        else if (t.kind === "pothole" && e < horizon) score[lane]! -= 25;
        else if ((t.kind === "agbero" || t.kind === "lastma") && e < horizon + 1) score[lane]! -= 40;
      }
      score[lane]! -= Math.abs(lane - s.x) * 4 + (lane === 1 ? 0 : 3);
    }
    const stop = fareStop(s);
    const want = stop && !stop.done ? stop : !s.fare ? s.things.filter((t) => t.kind === "passenger" && !t.done && t.y > front).sort((a, b) => a.y - b.y)[0] : undefined;
    if (want && want.y - front < VIEW_AHEAD) score[want.lane]! += want.kind === "stop" ? 120 : 60;
    const best = score.indexOf(Math.max(...score));
    if (best !== s.lane) s = steer(s, best > s.lane ? 1 : -1);
  }
  return s;
}

const seeds = ["a", "b", "c", "d", "e", "f", "g"];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const takings = (cfg: RouteConfig, react: number) => median(seeds.map((sd) => autoplay(sd, cfg, react).money));
const run = (seed: string, s: OkadaState, secs: number) => {
  for (let t = 0; t < secs && !s.over; t += 0.05) s = tick(seed, s, 0.05).state;
  return s;
};
/** A road with nothing on it but what the test puts there. */
const empty = (cfg: RouteConfig = FREE): OkadaState => ({ ...newOkada("x", { ...cfg, density: {} }), things: [] });

describe("Okada Rush", () => {
  it("the same seed rides the same road", () => {
    expect(autoplay("same", routeConfig(2), 0.8)).toEqual(autoplay("same", routeConfig(2), 0.8));
  });

  it("swipes move one lane at a time, never off the road", () => {
    let s = empty();
    s = steer(s, -1);
    expect(s.lane).toBe(0);
    expect(steer(s, -1).lane).toBe(0);
    s = run("x", s, 1);
    expect(s.x).toBe(0);
  });

  it("pick up at the kerb, drop at the stop: fare plus a tip for a smooth ride; miss it and it's half", () => {
    let s = empty({ ...FREE, flag: 0, fare: 100, tips: 1 });
    s = { ...steer(s, -1), x: 0, things: [{ id: 1, kind: "passenger", lane: 0, y: 10, v: 0, look: 0 }, { id: 2, kind: "stop", lane: 0, y: 110, v: 0, look: 3 }] };
    s = run("x", s, 3);
    expect(s.fare).toMatchObject({ stopId: 2 });
    s = run("x", s, 30);
    expect(s.served).toBe(1);
    // The fare, plus a tip that grows with how quick the ride was.
    expect(s.money).toBeGreaterThanOrEqual(100 + 20);
    expect(s.money).toBeLessThanOrEqual(100 + 40);

    let m = empty({ ...FREE, flag: 0, fare: 100 });
    m = { ...steer(m, -1), x: 0, things: [{ id: 1, kind: "passenger", lane: 0, y: 10, v: 0 }, { id: 2, kind: "stop", lane: 2, y: 110, v: 0 }] };
    m = run("x", m, 30);
    expect(m.missed).toBe(1);
    expect(m.money).toBe(50);
  });

  it("traffic ends the ride; a pothole slows you; a deep one throws you unless you have a spare", () => {
    let s = empty();
    s = { ...s, things: [{ id: 1, kind: "danfo", lane: 1, y: 12, v: 0, stopT: 99 }] };
    s = run("x", s, 5);
    expect(s).toMatchObject({ over: true, end: "crash" });

    let p = empty();
    p = { ...p, things: [{ id: 1, kind: "pothole", lane: 1, y: 6, v: 0 }] };
    const r = tick("x", run("x", p, 0.6), 0.2);
    expect(run("x", p, 1.2).slow).toBeGreaterThan(0);
    expect(r.state.over).toBe(false);

    const deep = (gear: string[]) => ({ ...empty(okadaConfig("route-4", gear)), things: [{ id: 1, kind: "deep" as const, lane: 1, y: 6, v: 0 }] });
    expect(run("x", deep([]), 2).end).toBe("crash");
    const saved = run("x", deep(["spare"]), 2);
    expect(saved.over).toBe(false);
    expect(saved.spareUsed).toBe(true);
  });

  it("agberos take ₦200; LASTMA fines ₦500 and holds you, unless you wear a helmet", () => {
    const at = (kind: "agbero" | "lastma", gear: string[] = []) => run("x", { ...steer(empty(okadaConfig("route-2", gear)), -1), x: 0, money: 1000, things: [{ id: 1, kind, lane: 0, y: 8, v: 0 }] }, 3);
    expect(at("agbero").money).toBe(800);
    expect(at("lastma").money).toBe(500);
    expect(at("lastma", ["helmet"]).money).toBe(1000);
  });

  it("routes end at their length; the bridge pays by distance", () => {
    const s = autoplay("end", routeConfig(1), 0.5);
    expect(s.end).toBe("finish");
    expect(s.y).toBeGreaterThanOrEqual(routeConfig(1).length);
    const b = run("x", empty(routeConfig(3)), 30);
    expect(b.money).toBeGreaterThan(0);
  });

  it("there's always a way through: a careful rider gets to the end of every route", () => {
    for (let n = 1; n <= ROUTES.length; n++) {
      const ends = seeds.map((sd) => autoplay(sd, routeConfig(n), 0.4).end);
      expect(ends.filter((e) => e === "finish").length, `route ${n}`).toBeGreaterThanOrEqual(5);
    }
  }, 120000);

  it("every route is fair: sharp riders get three stars, good riders two, slow riders one", () => {
    for (let n = 1; n <= ROUTES.length; n++) {
      const cfg = routeConfig(n);
      const stars = (m: number) => cfg.stars.filter((x) => m >= x).length;
      expect(stars(takings(cfg, 0.5)), `route ${n}, sharp`).toBe(3);
      expect(stars(takings(cfg, 0.8)), `route ${n}, good`).toBeGreaterThanOrEqual(2);
      expect(stars(takings(cfg, 1.1)), `route ${n}, slow`).toBeGreaterThanOrEqual(1);
    }
  }, 120000);

  it("free ride goes on until you crash and gets busier", () => {
    const s = autoplay("free", FREE, 0.9, 900);
    expect(s.end).toBe("crash");
    expect(s.cfg.length).toBe(0);
  });

  it("traffic is never spawned on top of the okada", () => {
    for (const sd of seeds) {
      const s = newOkada(sd, routeConfig(5));
      for (const t of s.things) if (isTraffic(t.kind)) expect(t.y).toBeGreaterThan(BIKE_LEN);
    }
  });

  it("routes open in order; ranks follow distance", () => {
    expect(routeOpen(1, () => undefined)).toBe(true);
    expect(routeOpen(2, () => routeConfig(1).stars[0] - 1)).toBe(false);
    expect(routeOpen(2, () => routeConfig(1).stars[0])).toBe(true);
    expect(rankFor(0).name).toBe("Learner");
    expect(rankFor(25)).toMatchObject({ name: "Express Rider", next: { name: "Park Chairman" } });
    expect(okadaConfig("free", ["helmet"]).gear).toBeUndefined();
    expect(okadaConfig("route-2", ["helmet", "nonsense"]).gear).toEqual(["helmet"]);
  });

  // OKADA_CALIBRATE=1 npx vitest run src/lib/solo/games/okada.test.ts -t calibrate
  it.skipIf(!process.env.OKADA_CALIBRATE)("calibrate: prints star targets and how rides end", () => {
    const down = (n: number) => Math.floor(n / 100) * 100;
    for (let n = 1; n <= ROUTES.length; n++) {
      const cfg = routeConfig(n);
      const [sharp, good, slow] = [0.5, 0.8, 1.1].map((r) => takings(cfg, r)) as [number, number, number];
      const ends = [0.5, 0.8, 1.1].map((r) => seeds.map((sd) => autoplay(sd, cfg, r).end?.[0]).join(""));
      const three = down(sharp * 0.95);
      console.log(`route ${n}: [${down(Math.min(slow * 0.9, three * 0.5))}, ${down(Math.min(good * 0.95, three * 0.8))}, ${three}]  raw ${slow} ${good} ${sharp}  ends ${ends.join(" / ")}`);
    }
    const free = [0.5, 0.8, 1.1].map((r) => seeds.map((sd) => { const s = autoplay(sd, FREE, r, 900); return `${Math.round(s.y)}m ₦${s.money}`; }).join(", "));
    console.log("free:", free.join("\n      "));
  }, 900000);

  it("the flag fare is paid as they climb on, with a beat on the brakes", () => {
    let s = empty({ ...FREE, flag: 300, fare: 100 });
    s = { ...steer(s, -1), x: 0, things: [{ id: 1, kind: "passenger", lane: 0, y: 10, v: 0, look: 0 }, { id: 2, kind: "stop", lane: 0, y: 400, v: 0 }] };
    let paid = 0;
    let braked = false;
    for (let i = 0; i < 400 && !paid; i++) {
      const r = tick("x", s, 1 / 30);
      s = r.state;
      const e = r.events.find((x) => x.kind === "pick");
      if (e && e.kind === "pick") paid = e.paid;
      if (paid && (s.pause ?? 0) > 0) braked = true;
    }
    expect(paid).toBe(300);
    expect(s.money).toBe(300);
    expect(braked).toBe(true);
    // The brake takes hold on the next moment.
    s = tick("x", s, 1 / 30).state;
    expect(s.v).toBeLessThan(2);
  });

  it("holding the throttle goes up to half as fast again, and lets go smoothly", () => {
    let s = empty();
    s = run("x", s, 5);
    const cruising = s.v;
    s = run("x", throttle(s, true), 1);
    expect(s.v).toBeGreaterThan(cruising * 1.4);
    expect(s.v).toBeLessThanOrEqual(cruising * 1.5 + 0.5);
    s = run("x", throttle(s, false), 0.1);
    expect(s.v).toBeGreaterThan(cruising * 1.05);
    s = run("x", s, 1);
    expect(s.v).toBeLessThan(cruising * 1.1);
  });
});
