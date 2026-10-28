import { describe, expect, it } from "vitest";
import { buildable, naijaLandlord as g, rentFor, SPACES, START_CASH, worthOf, type NlMove, type NlState } from "./logic";

const ctx = { now: 1_000 };
const two = ["ada", "bo"] as const;
const four = ["ada", "bo", "chi", "dayo"] as const;
const start = (players: readonly string[] = two) => g.initialState("seed-1", players, { firstPlayer: 0 }, ctx);
const who = (s: NlState) => s.players[s.turn]!;
const streets = SPACES.flatMap((sp, i) => (sp.kind === "street" ? [i] : []));

describe("naija landlord: setup", () => {
  it("deals one free street each, and the right target", () => {
    const s = start(four);
    for (const p of four) expect(s.owner.filter((o) => o === p)).toHaveLength(1);
    expect(s.cash.ada).toBe(START_CASH);
    expect(s.target).toBe(3250);
    expect(start().target).toBe(3000);
  });

  it("hides the dice seed and deck order from players", () => {
    const v = g.viewFor(start(), "ada") as unknown as Record<string, unknown>;
    expect(v.seed).toBeUndefined();
    expect(v.deck).toBeUndefined();
    expect(v.rngCursor).toBeUndefined();
  });
});

describe("naija landlord: rules", () => {
  it("rent doubles for a full neighbourhood, then x3 with flats and x6 with an estate", () => {
    const s = start();
    const owner = s.owner.map(() => null as string | null);
    owner[1] = "ada";
    expect(rentFor({ owner, level: s.level }, 1)).toBe(10);
    owner[3] = "ada";
    expect(rentFor({ owner, level: s.level }, 1)).toBe(20);
    const level: number[] = s.level.map((_, i) => (i === 1 ? 1 : 0));
    expect(rentFor({ owner, level }, 1)).toBe(30);
    level[1] = 2;
    expect(rentFor({ owner, level }, 1)).toBe(60);
  });

  it("only lets you build on a full neighbourhood, before you roll", () => {
    let s = start();
    s = { ...s, owner: s.owner.map((_, i) => (i === 1 || i === 3 ? "ada" : null)) };
    expect(buildable(s, "ada")).toEqual([1, 3]);
    expect(buildable(s, "bo")).toEqual([]);
    s = g.applyMove(s, { kind: "build", sq: 1 }, "ada", ctx);
    expect(s.level[1]).toBe(1);
    expect(s.cash.ada).toBe(START_CASH - 50);
    expect(worthOf(s, "ada")).toBe(START_CASH - 50 + 100 + 50 + 100);
    expect(g.validateMove({ ...s, rolls: 1 }, { kind: "build", sq: 3 }, "ada", ctx)).toBe(false);
  });

  it("offers a buy-out when you own the other street, and pays the owner 1.5x", () => {
    let s = start();
    s = { ...s, owner: s.owner.map((_, i) => (i === 5 ? "ada" : i === 6 ? "bo" : null)), pos: { ada: 6, bo: 0 }, turn: 0 };
    // Fake a landing on Akoka by settling a buy-out decision directly.
    s = { ...s, phase: "decide", decision: { kind: "buyout", sq: 6, price: 225, rent: 15, owner: "bo" }, dice: [1, 2] };
    s = g.applyMove(s, { kind: "answer", yes: true }, "ada", ctx);
    expect(s.owner[6]).toBe("ada");
    expect(s.cash.ada).toBe(START_CASH - 225);
    expect(s.cash.bo).toBe(START_CASH + 225);
    expect(who(s)).toBe("bo");
  });

  it("the timer only plays for someone who has already taken a turn", () => {
    const s = start();
    const late = { now: s.deadline + 1 };
    expect(g.validateMove(s, { kind: "tick" }, "bo", late)).toBe(false);
    const rolled = g.applyMove(s, { kind: "roll" }, "ada", ctx);
    expect(rolled.awake).toContain("ada");
  });

  it("running out of money puts you out, and the last one standing wins", () => {
    let s = start();
    s = { ...s, cash: { ada: 10, bo: 1500 }, owner: s.owner.map(() => null), pos: { ada: 6, bo: 0 }, dice: [1, 2], rolls: 1 };
    s = { ...s, phase: "decide", decision: { kind: "onile" } };
    s = g.applyMove(s, { kind: "answer", yes: true }, "ada", ctx);
    expect(s.out).toContain("ada");
    expect(s.winner).toBe("bo");
    expect(s.reason).toBe("standing");
  });
});

describe("naija landlord: full games", () => {
  /** Plays random legal moves; every game must finish within the round cap without errors. */
  function playOut(seed: string, players: readonly string[]) {
    let s = g.initialState(seed, players, {}, ctx);
    let now = ctx.now;
    let steps = 0;
    let n = 0;
    while (!s.winner) {
      if (++steps > 5000) throw new Error(`stuck: ${seed}`);
      now += 1000;
      const me = who(s);
      const r = (seed.length + steps * 7 + (n = (n * 31 + 17) % 101)) % 10;
      let move: NlMove;
      if (s.phase === "decide") move = { kind: "answer", yes: r < 7 };
      else if (r < 5 && buildable(s, me).length) move = { kind: "build", sq: buildable(s, me)[0]! };
      else move = { kind: "roll" };
      expect(g.validateMove(s, move, me, { now })).toBe(true);
      s = g.applyMove(s, move, me, { now });
      for (const p of s.players) if (!s.out.includes(p)) expect(s.cash[p]).toBeGreaterThanOrEqual(0);
      expect(s.round).toBeLessThanOrEqual(s.rounds);
    }
    return s;
  }

  it("300 random games all finish", () => {
    const reasons: Record<string, number> = {};
    let built = 0;
    for (let i = 0; i < 300; i++) {
      const players = i % 3 === 0 ? four : i % 3 === 1 ? (["ada", "bo", "chi"] as const) : two;
      const s = playOut(`fuzz-${i}`, players);
      reasons[s.reason!] = (reasons[s.reason!] ?? 0) + 1;
      if (s.level.some((l) => l > 0)) built++;
    }
    expect(reasons.rounds ?? 0).toBeGreaterThan(0);
    expect(built).toBeGreaterThan(30);
    expect(streets).toHaveLength(12);
  });
});
