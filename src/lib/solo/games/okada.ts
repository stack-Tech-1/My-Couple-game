import { makeRng } from "@/games/_engine/rng";

/**
 * Okada Rush: ride an okada up a Lagos road. Swipe between three lanes. Passengers wave from the
 * kerb: ride past them in the kerb lane to pick one up, then drop them at their bus stop (in the
 * kerb lane on that side) for the fare. Dodge danfos, kekes and the rest; a pothole slows you,
 * a deep one throws you off. Agberos and LASTMA stand in the kerb lanes and cost you money.
 *
 * Routes are fixed distances with star targets; Free Ride goes on until you crash. Speed grows as
 * you ride. Pure and seeded: time moves in `tick`. The world is in metres and seconds; lane 0 is
 * the left kerb lane, lane 2 the right.
 */
export const LANES = 3;
/** Metres of road the screen shows ahead of the okada, and behind it. */
export const VIEW_AHEAD = 26;
export const VIEW_BEHIND = 6;
/** The okada's length, and how close to a lane's middle counts as being in it. */
export const BIKE_LEN = 2;
const HIT_X = 0.55;

export type Kind =
  // Traffic: blocks a lane, moves up the road slower than you (or stops).
  | "danfo" | "keke" | "car" | "brt" | "truck" | "suv"
  // On the road: a pothole slows you, a deep one throws you; a cone, puddle or sand slows you; a barrier blocks.
  | "pothole" | "deep" | "puddle" | "cone" | "sand" | "barrier"
  // At the kerb.
  | "passenger" | "stop" | "agbero" | "lastma";

/** Length in metres and cruising speed (m/s) of each thing on the road. */
export const SIZE: Record<Kind, { len: number; v: number }> = {
  danfo: { len: 5, v: 4 }, keke: { len: 2.6, v: 3.5 }, car: { len: 4.2, v: 6 }, brt: { len: 11, v: 5 }, truck: { len: 12, v: 3 }, suv: { len: 4.8, v: 7 },
  pothole: { len: 1.4, v: 0 }, deep: { len: 1.8, v: 0 }, puddle: { len: 2.4, v: 0 }, cone: { len: 0.8, v: 0 }, sand: { len: 2.2, v: 0 }, barrier: { len: 1, v: 0 },
  passenger: { len: 1, v: 0 }, stop: { len: 3, v: 0 }, agbero: { len: 1, v: 0 }, lastma: { len: 1, v: 0 },
};
const TRAFFIC: readonly Kind[] = ["danfo", "keke", "car", "brt", "truck", "suv"];
const BLOCKS: readonly Kind[] = [...TRAFFIC, "barrier"];
const SLOWS: readonly Kind[] = ["pothole", "puddle", "cone", "sand"];
export const isTraffic = (k: Kind) => TRAFFIC.includes(k);
const atKerb = (k: Kind) => k === "passenger" || k === "stop" || k === "agbero" || k === "lastma";

export type Thing = {
  id: number;
  kind: Kind;
  lane: number;
  /** World position of its back end (metres up the road). */
  y: number;
  v: number;
  /** A danfo stopped to load: seconds left. */
  stopT?: number;
  /** Which look (passengers and stops). */
  look?: number;
  /** Already dealt with (passed, paid, picked up). */
  done?: boolean;
};

/** Bus stops, named on the signs and in the passengers' requests. */
export const STOP_NAMES = [
  ["Sabo", "Yaba Tech", "Tejuosho", "Ojuelegba", "Jibowu", "Alagomeji", "Unilag Gate", "Herbert Macaulay"],
  ["Maryland", "Anthony", "Obanikoro", "Palmgrove", "Onipanu", "Fadeyi", "Ojota", "Ketu"],
  [],
  ["Ikate", "Chevron", "Agungi", "Osapa", "Jakande", "Ajah", "Abraham Adesanya", "Sangotedo"],
  ["Bar Beach", "Adeola Odeku", "Ahmadu Bello", "Ozumba Mbadiwe", "Kuramo", "Tiamiyu Savage", "Akin Adesola", "Eko Hotel"],
] as const;

export type RouteConfig = {
  /** Metres to the end of the route; 0 rides until you crash. */
  length: number;
  /** Speed at the start, how fast it grows (m/s each second), and the top speed. */
  v0: number;
  accel: number;
  vmax: number;
  /** Things per 100 metres of road, by kind. */
  density: Partial<Record<Kind, number>>;
  /** A fare: naira when a passenger gets on, plus naira per 100 metres they ride; and a multiplier on tips. */
  flag: number;
  fare: number;
  tips: number;
  /** Paid for distance itself (the bridge): naira per 100 metres. */
  perHundred?: number;
  /** Which stop names to use (an index into STOP_NAMES). */
  names: number;
  /** Naira for one, two and three stars (routes only). */
  stars: readonly [number, number, number];
  /** Garage items in play. */
  gear?: readonly GearId[];
};

/**
 * The garage, bought with Okada Rush savings (everything you've taken in). Like Mama Put's shop,
 * it only counts on the routes: Free Ride is the same for everyone. Bike colours are just looks.
 */
export const GEAR = [
  { id: "helmet", name: "Helmet", price: 15000, about: "LASTMA no go stop you again." },
  { id: "bike", name: "New bike", price: 40000, about: "Changes lane much faster." },
  { id: "phone", name: "Phone holder", price: 10000, about: "Shows the way to the next stop." },
  { id: "spare", name: "Spare tyre", price: 25000, about: "Survive one bad pothole each ride." },
  { id: "raincoat", name: "Raincoat", price: 12000, about: "Puddles don't slow you down." },
  { id: "mirrors", name: "Side mirrors", price: 30000, about: "A proper bike: 10% more in fares." },
] as const;
export type GearId = (typeof GEAR)[number]["id"];
export const isGear = (id: string): id is GearId => GEAR.some((g) => g.id === id);
/** Bike colours, from the garage too. */
export const SKINS = [
  { id: "skin-red", name: "Red", price: 0 },
  { id: "skin-blue", name: "Blue", price: 8000 },
  { id: "skin-black", name: "Black", price: 8000 },
  { id: "skin-gold", name: "Gold", price: 20000 },
  { id: "skin-green", name: "Green and white", price: 8000 },
  { id: "skin-pink", name: "Pink", price: 8000 },
] as const;
export type SkinId = (typeof SKINS)[number]["id"];
export const isSkin = (id: string): id is SkinId => SKINS.some((s) => s.id === id);

export const ROUTES = ["Yaba streets", "Ikorodu Road", "Third Mainland Bridge", "Lekki-Epe Expressway", "VI at night"] as const;
export const ROUTE_ABOUT = ["Learn the road. Slow and forgiving.", "Danfos everywhere, and the agberos are out.", "No stops: just speed, and you're paid by the kilometre.", "Big tippers, and potholes to match.", "Dark, fast and busy. The big leagues."] as const;

const ROUTE_CFG: readonly Omit<RouteConfig, "stars">[] = [
  { length: 1000, v0: 5.5, accel: 0.03, vmax: 9, density: { danfo: 0.9, keke: 0.9, car: 0.5, pothole: 0.9, passenger: 1.6, agbero: 0.15 }, flag: 300, fare: 150, tips: 1, names: 0 },
  { length: 1200, v0: 6.5, accel: 0.035, vmax: 10.5, density: { danfo: 2, keke: 1, car: 0.6, brt: 0.4, pothole: 0.8, cone: 0.3, passenger: 1.6, agbero: 0.4, lastma: 0.25 }, flag: 400, fare: 200, tips: 1, names: 1 },
  { length: 1500, v0: 8, accel: 0.045, vmax: 13, density: { car: 1.8, suv: 1, truck: 0.6, danfo: 0.8, pothole: 0.5, sand: 0.3, barrier: 0.25, deep: 0.2 }, flag: 0, fare: 0, tips: 1, perHundred: 250, names: 2 },
  { length: 1400, v0: 7, accel: 0.04, vmax: 11.5, density: { car: 1, suv: 0.8, danfo: 0.8, truck: 0.3, pothole: 1.5, deep: 0.45, cone: 0.4, passenger: 1.5, agbero: 0.25, lastma: 0.2 }, flag: 600, fare: 300, tips: 2, names: 3 },
  { length: 1500, v0: 7.5, accel: 0.045, vmax: 12.5, density: { danfo: 1.4, keke: 0.8, car: 1, suv: 0.8, pothole: 0.9, deep: 0.3, puddle: 0.8, barrier: 0.25, passenger: 1.5, agbero: 0.35, lastma: 0.35 }, flag: 700, fare: 350, tips: 1.5, names: 4 },
];

/**
 * Star targets per route, measured with the test player in okada.test (run it with
 * OKADA_CALIBRATE=1): three for a sharp rider, two for a good one, one for a slow one.
 */
const ROUTE_STARS: readonly (readonly [number, number, number])[] = [
  [1100, 1800, 2300],
  [1600, 2500, 3200],
  [2100, 3300, 4200],
  [3300, 5300, 6700],
  [3600, 5700, 7200],
];

export const routeConfig = (n: number): RouteConfig => {
  const i = Math.max(0, Math.min(ROUTES.length - 1, n - 1));
  return { ...ROUTE_CFG[i]!, stars: ROUTE_STARS[i]! };
};
/** Free Ride: Ikorodu Road's traffic, endless, getting busier the further you go. */
export const FREE: RouteConfig = { ...ROUTE_CFG[1]!, length: 0, vmax: 14, accel: 0.04, stars: [3000, 6000, 10000] };

/** "route-1" … "route-5", or "free" (also the daily game). Gear only counts on routes. */
export function okadaConfig(mode: string, gear: readonly string[] = []): RouteConfig {
  const r = /^route-([1-5])$/.exec(mode);
  if (!r) return FREE;
  return { ...routeConfig(Number(r[1])), gear: GEAR.filter((g) => gear.includes(g.id)).map((g) => g.id) };
}
/** A route opens once the one before has a star. */
export const routeOpen = (n: number, best: (n: number) => number | undefined) => n <= 1 || (best(n - 1) ?? 0) >= routeConfig(n - 1).stars[0];
export const routeStars = (n: number, money: number) => routeConfig(n).stars.filter((x) => money >= x).length;

/** Ranks, by the distance you've ridden in all. */
export const RANKS = [
  { name: "Learner", km: 0 },
  { name: "Rider", km: 5 },
  { name: "Express Rider", km: 20 },
  { name: "Park Chairman", km: 60 },
  { name: "Okada Legend", km: 150 },
] as const;
export const rankFor = (km: number) => {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (km >= RANKS[k]!.km) i = k;
  return { index: i, ...RANKS[i]!, next: RANKS[i + 1] ?? null };
};

/** Who's on the back: where they're going and when they got on. */
/** `late`: seconds stuck behind traffic with them on the back (it eats the tip). */
export type Fare = { stopId: number; stop: string; look: number; from: number; at: number; bumps: number; late: number };

export type OkadaState = {
  cfg: RouteConfig;
  time: number;
  /** Metres up the road (the okada's back wheel). */
  y: number;
  v: number;
  /** The lane you're heading for, and where the okada actually is (sliding between lanes). */
  lane: number;
  x: number;
  things: Thing[];
  nextId: number;
  /** Road already filled with things, up to here. */
  filled: number;
  cursor: number;
  money: number;
  fare: Fare | null;
  served: number;
  missed: number;
  /** Seconds of wobble left after a pothole (slower). */
  slow: number;
  /** Seconds stopped by LASTMA. */
  held: number;
  spareUsed: boolean;
  over: boolean;
  /** How it ended: the route's end, or a crash. */
  end: "finish" | "crash" | null;
  /** Paid by the kilometre so far (the bridge). */
  paidTo: number;
  /** Riding behind slow traffic. */
  stuck?: boolean;
};

/** What happened in a tick, for sounds and pop-ups. */
export type OkadaEvent =
  | { kind: "pick"; stop: string }
  | { kind: "drop"; paid: number; tip: number; stop: string }
  | { kind: "missed"; paid: number; stop: string }
  | { kind: "bump"; deep: boolean; saved: boolean }
  | { kind: "slow"; what: Kind }
  | { kind: "agbero"; paid: number }
  | { kind: "lastma"; paid: number }
  | { kind: "km"; paid: number }
  | { kind: "blocked" }
  | { kind: "crash"; into: Kind }
  | { kind: "finish" };

export function newOkada(seed: string, cfg: RouteConfig = FREE): OkadaState {
  let s: OkadaState = { cfg, time: 0, y: 0, v: cfg.v0, lane: 1, x: 1, things: [], nextId: 1, filled: 30, cursor: makeRng(seed).cursor(), money: 0, fare: null, served: 0, missed: 0, slow: 0, held: 0, spareUsed: false, over: false, end: null, paidTo: 0 };
  s = fill(seed, s);
  return s;
}

const has = (s: OkadaState, g: GearId) => !!s.cfg.gear?.includes(g);
/** Lanes a second the okada slides across. */
const laneRate = (s: OkadaState) => (has(s, "bike") ? 7 : 4.5);

/** How busy the road is: Free Ride gets busier the further you go. */
const busier = (s: OkadaState) => (s.cfg.length ? 1 : 1 + Math.min(1.2, s.y / 2500));

/** Fill the road ahead, ten metres at a time, never closing all three lanes at once. */
function fill(seed: string, s0: OkadaState): OkadaState {
  const s = { ...s0, things: [...s0.things] };
  const ahead = s.y + VIEW_AHEAD + 40;
  const end = s.cfg.length ? s.cfg.length - 20 : Infinity;
  if (s.filled >= ahead) return s0;
  const rng = makeRng(seed, s.cursor);
  while (s.filled < ahead) {
    const y0 = s.filled;
    s.filled += 10;
    if (y0 > end) continue;
    for (const [k, per100] of Object.entries(s.cfg.density) as [Kind, number][]) {
      const busy = atKerb(k) ? 1 : busier(s);
      if (rng.next() >= (per100 * busy) / 10) continue;
      const y = y0 + rng.next() * 10;
      if (k === "passenger") {
        // Only worth having when there are stops ahead to take them to.
        const lane = rng.next() < 0.5 ? 0 : 2;
        if (s.things.some((t) => atKerb(t.kind) && t.lane === lane && Math.abs(t.y - y) < 12)) continue;
        s.things.push({ id: s.nextId++, kind: "passenger", lane, y, v: 0, look: rng.int(6) });
        // A bus stop for them somewhere ahead, on either side.
        const sy = y + 90 + rng.next() * 160;
        if (!s.cfg.length || sy < end) {
          const sl = rng.next() < 0.5 ? 0 : 2;
          const names = STOP_NAMES[s.cfg.names] ?? STOP_NAMES[0];
          s.things.push({ id: s.nextId++, kind: "stop", lane: sl, y: sy, v: 0, look: rng.int(Math.max(1, names.length)) });
        }
        continue;
      }
      if (atKerb(k)) {
        const lane = rng.next() < 0.5 ? 0 : 2;
        if (s.things.some((t) => atKerb(t.kind) && t.lane === lane && Math.abs(t.y - y) < 12)) continue;
        s.things.push({ id: s.nextId++, kind: k, lane, y, v: 0 });
        continue;
      }
      const lane = k === "brt" ? 0 : rng.int(LANES);
      const len = SIZE[k].len;
      // Keep a way through: no more than two lanes closed around here.
      const near = s.things.filter((t) => !atKerb(t.kind) && t.y < y + len + 9 && t.y + SIZE[t.kind].len > y - 9);
      if (near.some((t) => t.lane === lane)) continue;
      if (BLOCKS.includes(k) || k === "deep") {
        const shut = new Set(near.filter((t) => BLOCKS.includes(t.kind) || t.kind === "deep").map((t) => t.lane));
        shut.add(lane);
        if (shut.size >= LANES) continue;
      }
      s.things.push({ id: s.nextId++, kind: k, lane, y, v: SIZE[k].v * (0.8 + rng.next() * 0.4) });
    }
  }
  s.cursor = rng.cursor();
  return s;
}

/** Swipe: head one lane left (-1) or right (+1). */
export function steer(s: OkadaState, d: -1 | 1): OkadaState {
  if (s.over) return s;
  const lane = Math.max(0, Math.min(LANES - 1, s.lane + d));
  return lane === s.lane ? s : { ...s, lane };
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** Time passes: the road moves, traffic moves, things happen. */
export function tick(seed: string, s0: OkadaState, dt: number): { state: OkadaState; events: OkadaEvent[] } {
  if (s0.over) return { state: s0, events: [] };
  const events: OkadaEvent[] = [];
  let s: OkadaState = { ...s0, time: s0.time + dt };
  const cfg = s.cfg;
  // Speed: grows with time; a wobble slows you, LASTMA stops you.
  const top = Math.min(cfg.vmax, cfg.v0 + cfg.accel * s.time);
  s.held = Math.max(0, s.held - dt);
  s.slow = Math.max(0, s.slow - dt);
  s.v = s.held > 0 ? 0 : s.slow > 0 ? top * 0.6 : top;
  const y0 = s.y;
  s.y += s.v * dt;
  // Sliding between lanes. A lane with a vehicle right beside you can't be entered: the okada
  // wobbles back (and hoots).
  const step = laneRate(s) * dt;
  let nx = Math.abs(s.lane - s.x) <= step ? s.lane : s.x + Math.sign(s.lane - s.x) * step;
  if (Math.abs(nx - s.lane) < HIT_X && Math.abs(s.x - s.lane) >= HIT_X && s.things.some((o) => isTraffic(o.kind) && o.lane === s.lane && overlaps(s.y - 0.3, s.y + BIKE_LEN + 0.8, o.y, o.y + SIZE[o.kind].len))) {
    s.lane = Math.round(s0.x);
    nx = s.x + Math.sign(s.lane - s.x) * Math.min(step, Math.abs(s.lane - s.x));
    events.push({ kind: "blocked" });
  }
  s.x = nx;

  // Traffic moves; danfos pull over to load, kekes too.
  const rng = makeRng(seed, s.cursor);
  // (Copies, so marking things done below never touches the previous state.)
  s.things = s.things.map((t) => {
    if (!isTraffic(t.kind)) return { ...t };
    let { stopT } = t;
    if (stopT != null) stopT = stopT - dt > 0 ? stopT - dt : undefined;
    else if ((t.kind === "danfo" || t.kind === "keke") && t.lane !== 1 && t.y - s.y > 14 && t.y - s.y < 22 && rng.next() < dt * 0.25 && !closesRoad(s, t)) stopT = 1.5 + rng.next() * 2;
    return { ...t, stopT, y: t.y + (stopT ? 0 : t.v * dt) };
  });
  s.cursor = rng.cursor();
  // Traffic queues: nothing drives through the vehicle ahead of it, or into the okada from behind.
  const queue = s.things.filter((o) => isTraffic(o.kind)).sort((a, b) => b.y - a.y);
  for (const o of queue) {
    const lead = queue.find((p) => p !== o && p.lane === o.lane && p.y > o.y);
    if (lead) o.y = Math.min(o.y, lead.y - SIZE[o.kind].len - 0.8);
    if (Math.abs(s.x - o.lane) < HIT_X + 0.3 && o.y + SIZE[o.kind].len <= y0 + 0.05) o.y = Math.min(o.y, s.y - SIZE[o.kind].len - 0.3);
  }

  // What's under the okada now.
  const lane = Math.round(s.x);
  const inLane = (t: Thing) => Math.abs(s.x - t.lane) < HIT_X;
  let behind = false;
  for (const t of s.things) {
    if (!isTraffic(t.kind) || t.stopT || !inLane(t)) continue;
    const before = s0.things.find((o) => o.id === t.id);
    // It was ahead of the okada last tick: ride behind it.
    if (before && y0 + BIKE_LEN <= before.y + 0.3 && s.y + BIKE_LEN > t.y - 0.4) {
      s.y = Math.max(y0, t.y - 0.4 - BIKE_LEN);
      s.v = Math.min(s.v, t.v);
      behind = true;
    }
  }
  if (behind && s.fare) s.fare = { ...s.fare, late: s.fare.late + dt };
  s.stuck = behind;
  for (const t of s.things) {
    if (t.done) continue;
    const len = SIZE[t.kind].len;
    if (atKerb(t.kind)) {
      // The okada's front passed it this tick?
      if (!(y0 + BIKE_LEN < t.y && s.y + BIKE_LEN >= t.y)) continue;
      t.done = true;
      if (lane !== t.lane) {
        if (t.kind === "stop" && s.fare?.stopId === t.id) missStop(s, t, events);
        continue;
      }
      if (t.kind === "passenger" && !s.fare) {
        const stop = nextStopFor(s, t);
        if (stop) {
          s.fare = { stopId: stop.id, stop: stopName(s, stop), look: t.look ?? 0, from: s.y, at: s.time, bumps: 0, late: 0 };
          events.push({ kind: "pick", stop: s.fare.stop });
        }
      } else if (t.kind === "stop" && s.fare?.stopId === t.id) {
        const f = s.fare;
        const base = Math.round(((cfg.flag + ((s.y - f.from) / 100) * cfg.fare) * (has(s, "mirrors") ? 1.1 : 1)) / 10) * 10;
        // A tip for a smooth, quick ride: no potholes, not stuck behind a danfo.
        const tip = f.bumps === 0 ? Math.round((base * 0.25 * cfg.tips * Math.max(0, 1 - f.late / 4)) / 10) * 10 : 0;
        s.money += base + tip;
        s.served++;
        s.fare = null;
        events.push({ kind: "drop", paid: base, tip, stop: f.stop });
      } else if (t.kind === "agbero") {
        const paid = Math.min(s.money, 200);
        s.money -= paid;
        events.push({ kind: "agbero", paid });
      } else if (t.kind === "lastma" && !has(s, "helmet")) {
        const paid = Math.min(s.money, 500);
        s.money -= paid;
        s.held = 1.2;
        events.push({ kind: "lastma", paid });
      }
      continue;
    }
    if (!inLane(t) || !overlaps(s.y, s.y + BIKE_LEN, t.y, t.y + len)) continue;
    if (BLOCKS.includes(t.kind) || (t.kind === "deep" && !(has(s, "spare") && !s.spareUsed))) {
      if (t.kind === "deep") events.push({ kind: "bump", deep: true, saved: false });
      s.over = true;
      s.end = "crash";
      events.push({ kind: "crash", into: t.kind });
      break;
    }
    t.done = true;
    if (t.kind === "deep") {
      s.spareUsed = true;
      s.slow = 2;
      events.push({ kind: "bump", deep: true, saved: true });
    } else if (t.kind === "pothole") {
      s.slow = 1.2;
      if (s.fare) s.fare = { ...s.fare, bumps: s.fare.bumps + 1 };
      events.push({ kind: "bump", deep: false, saved: false });
    } else if (SLOWS.includes(t.kind) && !(t.kind === "puddle" && has(s, "raincoat"))) {
      s.slow = 0.8;
      events.push({ kind: "slow", what: t.kind });
    }
  }
  // The bridge pays by the kilometre... in hundred-metre steps.
  if (cfg.perHundred) {
    while (s.paidTo + 100 <= s.y) {
      s.paidTo += 100;
      // Full pay at top speed: stuck behind a truck or wobbling pays less.
      s.money += Math.round((cfg.perHundred * Math.max(0.4, Math.min(1, s.v / Math.min(cfg.vmax, cfg.v0 + cfg.accel * s.time)))) / 10) * 10;
      if (s.paidTo % 1000 === 0) {
        s.money += cfg.perHundred * 5;
        events.push({ kind: "km", paid: cfg.perHundred * 5 });
      }
    }
  }

  if (!s.over && cfg.length && s.y >= cfg.length) {
    s.over = true;
    s.end = "finish";
    events.push({ kind: "finish" });
  }
  // Forget what's gone off the bottom of the screen; fill the road ahead.
  s.things = s.things.filter((t) => t.y + SIZE[t.kind].len > s.y - VIEW_BEHIND - 4 || (s.fare?.stopId === t.id));
  if (!s.over) s = fill(seed, s);
  return { state: s, events };
}

/** Would this danfo stopping here wall off all three lanes? */
function closesRoad(s: OkadaState, d: Thing) {
  const shut = new Set([d.lane]);
  for (const t of s.things) if (t.id !== d.id && !atKerb(t.kind) && (BLOCKS.includes(t.kind) || t.kind === "deep") && t.y < d.y + SIZE[d.kind].len + 10 && t.y + SIZE[t.kind].len > d.y - 10) shut.add(t.lane);
  return shut.size >= LANES;
}

function missStop(s: OkadaState, t: Thing, events: OkadaEvent[]) {
  const f = s.fare!;
  const half = Math.round((s.cfg.flag + ((s.y - f.from) / 100) * s.cfg.fare) / 2 / 10) * 10;
  s.money += half;
  s.missed++;
  s.fare = null;
  events.push({ kind: "missed", paid: half, stop: stopName(s, t) });
}

/** The first stop ahead of a passenger that nobody else is going to. */
function nextStopFor(s: OkadaState, p: Thing) {
  return s.things.filter((t) => t.kind === "stop" && !t.done && t.y > p.y + 40).sort((a, b) => a.y - b.y)[0];
}
export const stopName = (s: Pick<OkadaState, "cfg">, t: Pick<Thing, "look">) => {
  const names = STOP_NAMES[s.cfg.names] ?? STOP_NAMES[0];
  return names.length ? names[(t.look ?? 0) % names.length]! : "the stop";
};
/** The stop your passenger is going to, if it's on the road yet. */
export const fareStop = (s: OkadaState) => (s.fare ? s.things.find((t) => t.id === s.fare!.stopId) ?? null : null);
/** Metres ridden, and how far through the route (0 to 1; 0 on Free Ride). */
export const progress = (s: OkadaState) => (s.cfg.length ? Math.min(1, s.y / s.cfg.length) : 0);
export const stars = (s: Pick<OkadaState, "cfg" | "money">) => s.cfg.stars.filter((x) => s.money >= x).length;
