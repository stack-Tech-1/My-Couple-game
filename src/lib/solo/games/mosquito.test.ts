import { describe, expect, it } from "vitest";
import { BED_Y, GEAR, H, NIGHTS, RANKS, START_BITES, STEP, W, newMosquito, nightOfMode, nightOpen, nightPay, nightSpec, rankFor, starsFor, starsOfTakings, stepMosquito, takings, type MosquitoState } from "./mosquito";

/** A fair player: heads for the closest threat at a thumb's speed, and uses Big Spray when it's full. */
function playNight(night: number, seed: string, gear: string[] = [], skill = 1) {
  let s: MosquitoState = newMosquito(seed, { night, gear });
  let x = W / 2;
  const limit = 6 * 60 * 60;
  for (let i = 0; i < limit && !s.over; i++) {
    const puddle = s.puddles[0];
    const lowest = [...s.bugs].filter((b) => !b.up && b.y > 0).sort((a, b) => b.y - a.y)[0];
    const boss = s.bosses[0];
    const diving = s.bosses.find((b) => b.move === "dive");
    const goal = diving ? diving.x : lowest && lowest.y > 150 ? lowest.x : puddle ? puddle.x : boss ? boss.x : (lowest?.x ?? W / 2);
    const reach = 380 * skill * STEP;
    x += Math.max(-reach, Math.min(reach, goal - x));
    s = stepMosquito(seed, s, x, { fog: s.fog >= 1 }).state;
  }
  return s;
}

describe("Mosquito Wahala career", () => {
  it("has five rooms of ten nights, each ending with a boss", () => {
    expect(NIGHTS).toBe(50);
    for (let n = 1; n <= NIGHTS; n++) expect(nightSpec(n).boss).toBe(n % 10 === 0);
    expect(nightSpec(11).dark).toBe(true);
    expect(nightSpec(21).bunks).toBe(true);
    expect(nightSpec(31).sides).toBe(true);
    expect(nightSpec(41).puddles).toBe(true);
    expect(newMosquito("s", { night: 40 }).bosses).toHaveLength(2);
  });

  it("reads night modes and opens nights in order", () => {
    expect(nightOfMode("night-14")).toBe(14);
    expect(nightOfMode("night-51")).toBeNull();
    expect(nightOfMode("normal")).toBeNull();
    expect(nightOpen(1, () => false)).toBe(true);
    expect(nightOpen(5, (n) => n === 4)).toBe(true);
    expect(nightOpen(5, () => false)).toBe(false);
  });

  it("pays more for fewer bites, and the saved score gives the stars back", () => {
    expect(takings(14, 1)).toBe(870);
    expect([0, 1, 2, 3, 4].map(starsFor)).toEqual([3, 3, 2, 2, 1]);
    for (let n = 1; n <= NIGHTS; n++) for (let b = 0; b < START_BITES; b++) expect(starsOfTakings(n, takings(n, b))).toBe(starsFor(b));
    expect(starsOfTakings(14, 0)).toBe(0);
    expect(nightPay(14)).toBe(720);
  });

  it("ranks climb with stars up to the top of the 150", () => {
    expect(rankFor(0).name).toBe(RANKS[0].name);
    expect(rankFor(34).name).toBe("Night Guard");
    expect(rankFor(34).next?.stars).toBe(60);
    expect(rankFor(150).next).toBeNull();
  });

  it("the same seed and moves play the same night", () => {
    let a = newMosquito("same", { night: 34 });
    let b = newMosquito("same", { night: 34 });
    for (let i = 0; i < 900; i++) [a, b] = [stepMosquito("same", a, 120).state, stepMosquito("same", b, 120).state];
    expect(a).toEqual(b);
  });

  it("NEPA takes light, then brings it back", () => {
    let s = newMosquito("n", { night: 11 });
    const seen: string[] = [];
    for (let i = 0; i < 60 * 25 && !s.over; i++) {
      const r = stepMosquito("n", { ...s, bites: 5 }, 179);
      s = r.state;
      if (r.ev.light) seen.push(r.ev.light);
    }
    expect(seen.slice(0, 2)).toEqual(["off", "on"]);
  });

  it("Big Spray clears the room only when it's full", () => {
    const bugs = [{ id: 1, x: 40, y: 100, vx: 0, vy: 0, phase: 0, hp: 3, big: true }, { id: 2, x: 300, y: 120, vx: 0, vy: 0, phase: 0, hp: 1, big: false }];
    const base = { ...newMosquito("f", { night: 5 }), nextSpawn: 1e9, nextPuff: 1e9, bugs };
    expect(stepMosquito("f", { ...base, fog: 0.5 }, 179, { fog: true }).state.bugs).toHaveLength(2);
    const r = stepMosquito("f", { ...base, fog: 1 }, 179, { fog: true });
    expect(r.ev.fog).toBe(true);
    expect(r.state.bugs).toHaveLength(0);
    expect(r.state.fog).toBeLessThan(0.2);
  });

  it("the Mended Net blocks one bite a night, and the Coil Stand starts lit", () => {
    const s = newMosquito("g", { night: 2, gear: ["net", "coil"] });
    expect(s.coil).toBeGreaterThan(0);
    const low = (st: MosquitoState) => ({ ...st, nextSpawn: 1e9, nextPuff: 1e9, bugs: [{ id: 1, x: 20, y: BED_Y - 0.1, vx: 0, vy: 0, phase: 0, hp: 1, big: false }] });
    const one = stepMosquito("g", low(s), 340);
    expect(one.ev.blocked).toBe(true);
    expect(one.state.bites).toBe(START_BITES);
    expect(stepMosquito("g", low(one.state), 340).state.bites).toBe(START_BITES - 1);
  });

  it("a puddle hatches mosquitoes until the can is held over it", () => {
    const s = { ...newMosquito("p", { night: 41 }), nextSpawn: 1e9, puddles: [{ id: 99, x: 100, y: 520, hatch: 9, clear: 0 }], nextPuddle: 1e9 };
    let t = s;
    for (let i = 0; i < 40; i++) t = stepMosquito("p", t, 100).state;
    expect(t.puddles).toHaveLength(0);
  });

  it("a boss goes down to steady spraying and morning comes", () => {
    let s = newMosquito("b", { night: 10 });
    s = { ...s, bites: 5, bosses: [{ ...s.bosses[0]!, hp: 2 }] };
    let won = false;
    for (let i = 0; i < 60 * 20 && !s.over; i++) {
      const r = stepMosquito("b", s, s.bosses[0]?.x ?? W / 2);
      s = r.state;
      won ||= r.ev.won;
    }
    expect(won).toBe(true);
    expect(s.won).toBe(true);
  });

  it("every night can be survived by a fair player, with no gear", () => {
    const lost: number[] = [];
    for (let n = 1; n <= NIGHTS; n++) {
      const wins = ["a", "b", "c", "d", "e"].filter((seed) => playNight(n, `${seed}${n}`).won).length;
      if (wins < 2) lost.push(n);
    }
    expect(lost).toEqual([]);
  }, 120_000);

  it("All Night stays as it was: no bosses, gear or Big Spray", () => {
    const s = newMosquito("all");
    expect(s.night).toBe(0);
    const r = stepMosquito("all", { ...s, fog: 1 }, W / 2, { fog: true });
    expect(r.ev.fog).toBe(false);
    expect(GEAR.length).toBe(5);
    expect(H).toBe(560);
  });
});
