import { describe, expect, it } from "vitest";
import { BALL_R, PLANK_Y, W } from "./bash";
import { BUILDINGS, DANFO_Y, STREAK, WALLS, buildWall, isBossWall, launchWall, newWall, plankSize, rankFor, starsFor, starsOfTakings, stepWall, takings, wallOfMode, wallOpen, wallPay, type WallBrick, type WallState } from "./bashwall";

/** A fair player: follows the lowest falling ball, hitting it a little off centre. */
function playWall(wall: number, seed: string, gear: string[] = []) {
  let s: WallState = launchWall(seed, newWall(seed, wall, gear));
  let x = W / 2;
  for (let i = 0; i < 120 * 60 * 6 && !s.over; i++) {
    if (!s.launched) s = launchWall(seed, s);
    const low = [...s.balls].filter((b) => b.vy > 0).sort((a, b) => b.y - a.y)[0] ?? s.balls[0]!;
    const goal = low.x + Math.sin(i / 200) * plankSize(s) * 0.3;
    const reach = 420 / 120;
    x += Math.max(-reach, Math.min(reach, goal - x));
    s = stepWall(seed, s, x).state;
  }
  return s;
}
const lone = (s: WallState, b: Partial<WallBrick>): WallState => ({ ...s, launched: true, bricks: [{ id: 1, col: 3, row: 3, hp: 1, kind: "brick", paint: 0, ...b }] });
const aimAt = (s: WallState): WallState => ({ ...s, balls: [{ id: 1, x: 7 + 3 * 50 + 22, y: 70 + 3 * 26 + 20 + BALL_R + 3, vx: 0, vy: -300 }] });

describe("Bash Am career", () => {
  it("has five sites of ten walls, each ending with a boss", () => {
    expect(WALLS).toBe(50);
    for (let n = 1; n <= WALLS; n++) expect(isBossWall(n)).toBe(n % 10 === 0);
    expect(newWall("s", 10).boss).not.toBeNull();
    expect(newWall("s", 9).boss).toBeNull();
    expect(buildWall("s", 12).every((b) => b.kind === "stall")).toBe(true);
    expect(buildWall("s", 32).every((b) => b.kind === "glass")).toBe(true);
    expect(buildWall("s", 44).some((b) => b.kind === "rock")).toBe(true);
  });

  it("reads wall modes and opens walls in order", () => {
    expect(wallOfMode("wall-14")).toBe(14);
    expect(wallOfMode("wall-51")).toBeNull();
    expect(wallOfMode("normal")).toBeNull();
    expect(wallOpen(1, () => false)).toBe(true);
    expect(wallOpen(5, () => false)).toBe(false);
    expect(wallOpen(5, (n) => n === 4)).toBe(true);
  });

  it("pays more for fewer drops, and the saved score gives the stars back", () => {
    expect(takings(14, 0)).toBe(920);
    expect(wallPay(14)).toBe(770);
    expect([0, 1, 2].map(starsFor)).toEqual([3, 2, 1]);
    for (let n = 1; n <= WALLS; n++) for (const d of [0, 1, 2]) expect(starsOfTakings(n, takings(n, d))).toBe(starsFor(d));
    expect(starsOfTakings(14, 0)).toBe(0);
    expect(rankFor(34).name).toBe("Block Moulder");
    expect(rankFor(150).next).toBeNull();
  });

  it("the same seed and moves play the same wall", () => {
    let a = launchWall("same", newWall("same", 34));
    let b = launchWall("same", newWall("same", 34));
    for (let i = 0; i < 1500; i++) [a, b] = [stepWall("same", a, 120).state, stepWall("same", b, 120).state];
    expect(a).toEqual(b);
  });

  it("clearing the last brick wins the wall", () => {
    const s = aimAt(lone(newWall("w", 1), {}));
    let t = s;
    let won = false;
    for (let i = 0; i < 20 && !t.over; i++) {
      const r = stepWall("w", t, W / 2);
      t = r.state;
      won ||= r.ev.won;
    }
    expect(won).toBe(true);
  });

  it("a streak lights the fire ball, which goes straight through bricks", () => {
    const extra: WallBrick = { id: 2, col: 0, row: 0, hp: 1, kind: "brick", paint: 0 };
    const s = aimAt({ ...lone(newWall("h", 1), {}), combo: STREAK - 1 });
    let t: WallState = { ...s, bricks: [...s.bricks, extra] };
    let lit = false;
    for (let i = 0; i < 20; i++) {
      const r = stepWall("h", t, W / 2);
      t = r.state;
      lit ||= r.ev.hot;
    }
    expect(lit).toBe(true);
    expect(t.hot).toBeGreaterThan(0);

    const tough: WallBrick = { id: 1, col: 3, row: 3, hp: 2, kind: "tough", paint: 0 };
    let fire: WallState = { ...aimAt(lone(newWall("h", 1), tough)), hot: 3, bricks: [tough, extra] };
    for (let i = 0; i < 20; i++) fire = stepWall("h", fire, W / 2).state;
    expect(fire.bricks.map((b) => b.id)).toEqual([2]);
    expect(fire.balls[0]!.vy).toBeLessThan(0);
  });

  it("dynamite takes its neighbours with it, but never rock", () => {
    const base = aimAt(newWall("d", 45));
    const bricks: WallBrick[] = [
      { id: 1, col: 3, row: 3, hp: 1, kind: "dynamite", paint: 0 },
      { id: 2, col: 2, row: 3, hp: 2, kind: "tough", paint: 0 },
      { id: 3, col: 4, row: 3, hp: 1, kind: "rock", paint: 0 },
      { id: 4, col: 0, row: 0, hp: 1, kind: "brick", paint: 0 },
    ];
    let t: WallState = { ...base, launched: true, bricks };
    for (let i = 0; i < 12; i++) t = stepWall("d", t, W / 2).state;
    expect(t.bricks.map((b) => b.id).sort()).toEqual([3, 4]);
  });

  it("dropping every ball costs a ball, and the third ends the wall", () => {
    const s: WallState = { ...newWall("l", 1), launched: true, balls: [{ id: 1, x: 20, y: 590, vx: 0, vy: 300 }] };
    const one = stepWall("l", s, 300).state;
    expect(one.dropped).toBe(1);
    expect(one.lives).toBe(2);
    expect(one.launched).toBe(false);
    expect(stepWall("l", { ...s, lives: 1 }, 300).state.over).toBe(true);
  });

  it("a cement floor saves one ball", () => {
    const s: WallState = { ...newWall("f", 1), launched: true, floor: true, balls: [{ id: 1, x: 20, y: 545, vx: 0, vy: 300 }] };
    let t = s;
    for (let i = 0; i < 12; i++) t = stepWall("f", t, 300).state;
    expect(t.dropped).toBe(0);
    expect(t.floor).toBe(false);
    expect(t.balls[0]!.vy).toBeLessThan(0);
  });

  it("buildings help on the wall", () => {
    expect(BUILDINGS).toHaveLength(5);
    expect(plankSize(newWall("g", 1, ["shed"]))).toBeGreaterThan(plankSize(newWall("g", 1)));
    expect(newWall("g", 1, ["chemist"]).lives).toBe(4);
    expect(buildWall("g", 9).some((b) => b.hp === 2)).toBe(true);
    expect(buildWall("g", 9, ["welder"]).every((b) => b.hp === 1)).toBe(true);
  });

  it("danfos knock a ball off course", () => {
    const s: WallState = { ...newWall("b", 21), launched: true, nextDanfo: 1e9, danfos: [{ id: 1, x: 100, vx: 100 }], balls: [{ id: 1, x: 100, y: DANFO_Y - BALL_R - 1, vx: 0, vy: 300 }] };
    const t = stepWall("b", s, 300);
    expect(t.ev.danfoHit).toBe(true);
    expect(t.state.balls[0]!.vy).toBeLessThan(0);
    expect(t.state.balls[0]!.vx).toBeGreaterThan(0);
    expect(PLANK_Y).toBeGreaterThan(DANFO_Y);
  });

  it("every wall can be cleared by a fair player, with no buildings", () => {
    const lost: number[] = [];
    for (let n = 1; n <= WALLS; n++) {
      const wins = ["a", "b", "c", "d", "e"].filter((q) => playWall(n, `${q}${n}`).won).length;
      if (wins < 3) lost.push(n);
    }
    expect(lost).toEqual([]);
  }, 180_000);
});
