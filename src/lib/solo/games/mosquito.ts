import { makeRng } from "@/games/_engine/rng";

/**
 * Mosquito Wahala: mosquitoes come in waves, zig-zagging down towards your bed. Your spray can
 * puffs by itself; slide it under them. A mosquito that reaches the bed bites you; five bites and
 * you're done for the night. Some mosquitoes drop power-ups: a coil (they slow down), a net (no
 * bites for a while) and a double spray.
 *
 * Two ways to play. All Night is the endless game, the same for everyone on the same seed. The
 * career is five rooms of ten nights: each room adds its own trouble and ends with a boss, and
 * what you buy in the shop helps there only.
 *
 * Pure and seeded, stepped on a fixed clock. The can's position is an input to each step.
 */
export const W = 358;
export const H = 560;
export const CAN_Y = 476;
export const BED_Y = 410;
export const STEP = 1 / 60;
export const START_BITES = 5;
export const POWER_SECONDS = 8;

export const NIGHTS_PER_ROOM = 10;
export const ROOMS = [
  { name: "Boys' Quarters", place: "Yaba", about: "Learn the can. Small Boys, then Belle Fulls.", boss: "Madam Belle" },
  { name: "Face-Me-I-Face-You", place: "Surulere", about: "NEPA takes light in the middle of the night.", boss: "Area Father" },
  { name: "Hostel Block C", place: "Campus", about: "Two bunks to protect, and the Sharp Guys arrive.", boss: "The Bunkmate" },
  { name: "Lagoon Chalet", place: "Badagry", about: "Swarms blow in through both windows. Quiet Ones join them.", boss: "Lagoon Twins" },
  { name: "Rainy Night", place: "Epe", about: "Puddles hatch new mosquitoes until you clear them.", boss: "Queen Mosquito" },
] as const;
export const NIGHTS = ROOMS.length * NIGHTS_PER_ROOM;

export type NightSpec = {
  night: number;
  room: number;
  /** 1 to 10 within the room; the tenth is the boss. */
  index: number;
  boss: boolean;
  waves: number;
  perWave: number;
  speed: number;
  gap: number;
  fat: number;
  sharp: number;
  quiet: number;
  dark: boolean;
  bunks: boolean;
  sides: boolean;
  puddles: boolean;
  bossHp: number;
  bossCount: number;
  summon: number;
  adds: number;
  dive: number;
  bossSpeed: number;
};

const BOSS_HP = [55, 75, 90, 34, 100];
const BOSS_SUMMON = [4.2, 3.8, 3.8, 5, 4];
const BOSS_ADDS = [2, 3, 2, 2, 2];
const BOSS_DIVE = [9, 8, 7.5, 9, 7.5];
const BOSS_SPEED = [0.7, 0.8, 1.5, 0.9, 1.1];

/** What one night of the career throws at you. */
export function nightSpec(night: number): NightSpec {
  const room = Math.floor((night - 1) / NIGHTS_PER_ROOM);
  const index = ((night - 1) % NIGHTS_PER_ROOM) + 1;
  return {
    night,
    room,
    index,
    boss: index === NIGHTS_PER_ROOM,
    waves: index <= 3 ? 3 : index <= 7 ? 4 : 5,
    perWave: 6 + Math.ceil(index * 0.7) + Math.floor(room / 2),
    speed: 56 + room * 7 + index * 1.6,
    gap: Math.max(0.5, 1.05 - room * 0.08 - index * 0.02),
    fat: room === 0 ? (index >= 4 ? 0.15 : 0) : 0.12,
    sharp: room >= 2 ? 0.16 : 0,
    quiet: room >= 3 ? 0.14 : 0,
    dark: room === 1,
    bunks: room === 2,
    sides: room === 3,
    puddles: room === 4,
    bossHp: BOSS_HP[room]!,
    bossCount: room === 3 ? 2 : 1,
    summon: BOSS_SUMMON[room]!,
    adds: BOSS_ADDS[room]!,
    dive: BOSS_DIVE[room]!,
    bossSpeed: BOSS_SPEED[room]!,
  };
}

export const roomOf = (night: number) => Math.floor((night - 1) / NIGHTS_PER_ROOM);
export function nightOfMode(mode: string): number | null {
  const m = /^night-(\d{1,2})$/.exec(mode);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= NIGHTS ? n : null;
}
/** Nights open in order, by surviving the one before. */
export const nightOpen = (night: number, cleared: (n: number) => boolean) => night === 1 || cleared(night - 1);

/** Fewer bites, more stars. */
export const starsFor = (bitesTaken: number) => (bitesTaken <= 1 ? 3 : bitesTaken <= 3 ? 2 : 1);
export const nightPay = (night: number) => 300 + night * 30;
export const sleepBonus = (stars: number) => (stars === 3 ? 150 : stars === 2 ? 60 : 0);
/** A survived night pays this into your savings. It is also the night's saved score. */
export const takings = (night: number, bitesTaken: number) => nightPay(night) + sleepBonus(starsFor(bitesTaken));
export function starsOfTakings(night: number, score: number) {
  if (score <= 0) return 0;
  const bonus = score - nightPay(night);
  return bonus >= sleepBonus(3) ? 3 : bonus >= sleepBonus(2) ? 2 : 1;
}

export const RANKS = [
  { name: "Light Sleeper", stars: 0 },
  { name: "Night Guard", stars: 25 },
  { name: "Mosquito Hunter", stars: 60 },
  { name: "Area Exterminator", stars: 100 },
  { name: "Commander of Sleep", stars: 135 },
] as const;
export function rankFor(stars: number) {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (stars >= r.stars) index = i;
  });
  return { ...RANKS[index]!, index, next: RANKS[index + 1] ?? null };
}

export const GEAR = [
  { id: "nozzle", name: "Wide Nozzle", about: "A wider cloud of mist.", price: 6000 },
  { id: "trigger", name: "Fast Trigger", about: "Sprays more often.", price: 12000 },
  { id: "coil", name: "Coil Stand", about: "Every night starts with a lit coil.", price: 4000 },
  { id: "net", name: "Mended Net", about: "Blocks your first bite each night.", price: 9000 },
  { id: "fan", name: "Standing Fan", about: "Slows mosquitoes near the bed.", price: 15000 },
] as const;
export type GearId = (typeof GEAR)[number]["id"];
export const isGear = (id: string): id is GearId => GEAR.some((g) => g.id === id);

export type Mosquito = { id: number; x: number; y: number; vx: number; vy: number; phase: number; hp: number; big: boolean; kind?: "sharp" | "quiet"; up?: boolean };
export type Puff = { x: number; y: number; r: number; life: number };
export type Power = { kind: "coil" | "net" | "double"; x: number; y: number };
export type Boss = { id: number; x: number; y: number; hp: number; max: number; move: "hover" | "dive" | "rise"; dive: number; summon: number; phase: number; struck: number };
export type Puddle = { id: number; x: number; y: number; hatch: number; clear: number };
export type MosquitoState = {
  bugs: Mosquito[];
  puffs: Puff[];
  powers: Power[];
  can: number;
  bites: number;
  wave: number;
  toSpawn: number;
  nextSpawn: number;
  nextPuff: number;
  coil: number;
  net: number;
  double: number;
  score: number;
  kills: number;
  time: number;
  nextId: number;
  cursor: number;
  over: boolean;
  /** The career night being played; 0 is All Night. */
  night: number;
  gear: string[];
  won: boolean;
  /** Big Spray: full at 1. */
  fog: number;
  /** Seconds of blackout left, and when the next one comes. */
  dark: number;
  nextDark: number;
  /** Bites the Mended Net can still block tonight. */
  shield: number;
  bosses: Boss[];
  puddles: Puddle[];
  nextPuddle: number;
};
export type MosquitoEvents = {
  hits: { x: number; y: number; killed: boolean; points: number }[];
  bitten: boolean;
  blocked: boolean;
  wave: number | null;
  power: Power["kind"] | null;
  light: "off" | "on" | null;
  fog: boolean;
  bossHit: { x: number; y: number } | null;
  bossDown: boolean;
  dive: boolean;
  puddle: "new" | "cleared" | null;
  won: boolean;
};

export const waveSize = (wave: number) => 6 + wave * 2;
const FOG_PER_KILL = 1 / 14;
const DARK_SECONDS = 9;
const DARK_EVERY = 28;
const HOVER_Y = 112;
const MAX_BUGS = 14;
const DIVE_STOP = 6;

export function newMosquito(seed: string, career?: { night: number; gear?: readonly string[] }): MosquitoState {
  const base: MosquitoState = {
    bugs: [],
    puffs: [],
    powers: [],
    can: W / 2,
    bites: START_BITES,
    wave: 1,
    toSpawn: waveSize(1),
    nextSpawn: 1,
    nextPuff: 0,
    coil: 0,
    net: 0,
    double: 0,
    score: 0,
    kills: 0,
    time: 0,
    nextId: 1,
    cursor: makeRng(seed).cursor(),
    over: false,
    night: 0,
    gear: [],
    won: false,
    fog: 0,
    dark: 0,
    nextDark: 0,
    shield: 0,
    bosses: [],
    puddles: [],
    nextPuddle: 0,
  };
  if (!career) return base;
  const spec = nightSpec(career.night);
  const gear = (career.gear ?? []).filter(isGear);
  const bosses: Boss[] = spec.boss
    ? Array.from({ length: spec.bossCount }, (_, i) => ({ id: i + 1, x: W / 2, y: HOVER_Y, hp: spec.bossHp, max: spec.bossHp, move: "hover", dive: spec.dive + i * 3, summon: 3 + i * 2, phase: i * Math.PI, struck: 0 }))
    : [];
  return {
    ...base,
    night: career.night,
    gear,
    toSpawn: spec.boss ? 0 : spec.perWave,
    coil: gear.includes("coil") ? POWER_SECONDS : 0,
    shield: gear.includes("net") ? 1 : 0,
    nextDark: spec.dark ? 10 : 0,
    nextPuddle: spec.puddles ? 4 : 0,
    bosses,
  };
}

type Rng = ReturnType<typeof makeRng>;

function nightBug(spec: NightSpec, s: MosquitoState, rng: Rng): Mosquito {
  const r = rng.next();
  const big = r < spec.fat;
  const kind = big ? undefined : r < spec.fat + spec.sharp ? ("sharp" as const) : r < spec.fat + spec.sharp + spec.quiet ? ("quiet" as const) : undefined;
  let x = 20 + rng.next() * (W - 40);
  let y = -10;
  let vx = (rng.next() - 0.5) * 80;
  if (spec.bunks) {
    // They gang up on one bunk, then the other, so you have to cross the room.
    const right = Math.floor(s.nextId / 4) % 2 === 1;
    x = (right ? W / 2 + 24 : 16) + rng.next() * (W / 2 - 40);
  } else if (spec.sides) {
    const left = rng.next() < 0.5;
    x = left ? 14 : W - 14;
    y = 50 + rng.next() * 130;
    vx = (left ? 1 : -1) * (80 + rng.next() * 70);
  }
  const id = s.nextId++;
  return { id, x, y, vx, vy: spec.speed, phase: rng.next() * 6, hp: big ? 3 : 1, big, ...(kind ? { kind } : {}) };
}

function bite(s: MosquitoState, ev: MosquitoEvents) {
  if (s.net > 0) ev.blocked = true;
  else if (s.shield > 0) {
    s.shield--;
    ev.blocked = true;
  } else {
    s.bites--;
    ev.bitten = true;
  }
}

export function stepMosquito(seed: string, s0: MosquitoState, canX: number, act: { fog?: boolean } = {}): { state: MosquitoState; ev: MosquitoEvents } {
  const ev: MosquitoEvents = { hits: [], bitten: false, blocked: false, wave: null, power: null, light: null, fog: false, bossHit: null, bossDown: false, dive: false, puddle: null, won: false };
  if (s0.over) return { state: s0, ev };
  const dt = STEP;
  const s: MosquitoState = { ...s0, can: Math.max(30, Math.min(W - 30, canX)), time: s0.time + dt, coil: Math.max(0, s0.coil - dt), net: Math.max(0, s0.net - dt), double: Math.max(0, s0.double - dt) };
  const rng = makeRng(seed, s.cursor);
  const spec = s.night ? nightSpec(s.night) : null;
  const speed = (spec ? spec.speed : 58 + s.wave * 10) * (s.coil > 0 ? 0.5 : 1);

  // New mosquitoes fly in from the top and the sides.
  let bugs = s.bugs;
  if (s.toSpawn > 0 && s.time >= s.nextSpawn) {
    if (spec) {
      const group = Math.min(spec.sides ? 3 : 1, s.toSpawn);
      const fresh: Mosquito[] = [];
      for (let i = 0; i < group; i++) fresh.push(nightBug(spec, s, rng));
      bugs = [...bugs, ...fresh];
      s.toSpawn -= group;
      s.nextSpawn = s.time + spec.gap * group * (0.6 + rng.next() * 0.8);
    } else {
      const big = s.wave >= 3 && rng.next() < 0.15 + s.wave * 0.02;
      bugs = [...bugs, { id: s.nextId, x: 20 + rng.next() * (W - 40), y: -10, vx: (rng.next() - 0.5) * 80, vy: speed, phase: rng.next() * 6, hp: big ? 3 : 1, big }];
      s.nextId++;
      s.toSpawn--;
      s.nextSpawn = s.time + Math.max(0.3, 1.1 - s.wave * 0.08) * (0.6 + rng.next() * 0.8);
    }
  }

  // NEPA: the light goes, and comes back.
  if (spec?.dark) {
    if (s.dark > 0) {
      s.dark = Math.max(0, s.dark - dt);
      if (s.dark === 0) {
        ev.light = "on";
        s.nextDark = s.time + DARK_EVERY;
      }
    } else if (s.time >= s.nextDark) {
      s.dark = DARK_SECONDS;
      ev.light = "off";
    }
  }

  // Rainy nights: puddles hatch mosquitoes until the can is held over them.
  if (spec?.puddles) {
    let puddles = s.puddles;
    if ((s.toSpawn > 0 || s.bosses.length > 0) && puddles.length < 2 && s.time >= s.nextPuddle) {
      puddles = [...puddles, { id: s.nextId++, x: 40 + rng.next() * (W - 80), y: 512 + rng.next() * 26, hatch: 3.5, clear: 0 }];
      s.nextPuddle = s.time + Math.max(5, 10 - spec.index * 0.4);
      ev.puddle = "new";
    }
    const left: Puddle[] = [];
    for (const p0 of puddles) {
      const p = { ...p0, hatch: p0.hatch - dt, clear: Math.abs(p0.x - s.can) < 38 ? p0.clear + dt : Math.max(0, p0.clear - dt * 0.5) };
      if (p.clear >= 0.55) {
        ev.puddle = "cleared";
        continue;
      }
      if (p.hatch <= 0) {
        p.hatch = 5.5;
        if (bugs.length < MAX_BUGS) bugs = [...bugs, { id: s.nextId++, x: p.x, y: 450, vx: (rng.next() - 0.5) * 60, vy: speed, phase: rng.next() * 6, hp: 1, big: false, up: true }];
      }
      left.push(p);
    }
    s.puddles = left;
  }

  // The can puffs on its own: a cloud that rises and spreads.
  let puffs = s.puffs;
  if (s.time >= s.nextPuff) {
    const spread = s.double > 0 ? [-14, 14] : [0];
    const start = s.gear.includes("nozzle") ? 12 : 8;
    puffs = [...puffs, ...spread.map((d) => ({ x: s.can + d, y: CAN_Y - 30, r: start, life: 1 }))];
    const fast = s.gear.includes("trigger") ? 0.75 : 1;
    s.nextPuff = s.time + (s.double > 0 ? 0.14 : 0.2) * fast;
  }
  puffs = puffs.map((p) => ({ ...p, y: p.y - 430 * dt, r: p.r + 26 * dt, life: p.life - dt * 1.9 })).filter((p) => p.life > 0 && p.y > -20);

  const killed = (b: Mosquito) => {
    const points = (b.big ? 60 : 25) * s.wave;
    s.score += points;
    s.kills++;
    if (spec) s.fog = Math.min(1, s.fog + FOG_PER_KILL);
    return points;
  };

  // Big Spray: fills the room once the meter is full.
  let bosses = s.bosses;
  if (spec && act.fog && s.fog >= 1) {
    s.fog = 0;
    ev.fog = true;
    bugs = bugs.filter((b) => {
      const hp = b.hp - 3;
      if (hp > 0) return true;
      ev.hits.push({ x: b.x, y: b.y, killed: true, points: killed(b) });
      return false;
    });
    bosses = bosses.map((b) => ({ ...b, hp: b.hp - Math.ceil(b.max * 0.12) }));
  }

  // Bosses drift overhead, call for backup and dive at the bed.
  if (spec && bosses.length) {
    const next: Boss[] = [];
    for (const b0 of bosses) {
      const b = { ...b0, phase: b0.phase + dt };
      const hurry = b.hp < b.max / 2 && spec.room === 4 ? 0.6 : 1;
      if (b.move === "hover") {
        b.x = W / 2 + Math.sin(b.phase * spec.bossSpeed) * (W / 2 - 72);
        b.y = HOVER_Y + Math.sin(b.phase * 1.7) * 14;
        b.dive -= dt;
        if (b.dive <= 0) {
          b.move = "dive";
          b.struck = 0;
          ev.dive = true;
        }
      } else if (b.move === "dive") {
        b.y += 105 * dt;
        if (b.y >= BED_Y - 34) {
          bite(s, ev);
          b.move = "rise";
        }
      } else {
        b.y -= 170 * dt;
        if (b.y <= HOVER_Y) {
          b.move = "hover";
          b.dive = spec.dive * hurry;
        }
      }
      b.summon -= dt;
      if (b.summon <= 0) {
        b.summon = spec.summon * hurry;
        for (let i = 0; i < spec.adds && bugs.length < MAX_BUGS; i++) {
          const add = nightBug(spec, s, rng);
          bugs = [...bugs, { ...add, x: Math.max(16, Math.min(W - 16, b.x + (i - (spec.adds - 1) / 2) * 34)), y: b.y + 22 }];
        }
      }
      let hp = b.hp;
      puffs = puffs.filter((p) => {
        if (hp > 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 32) {
          hp--;
          ev.bossHit = { x: p.x, y: p.y };
          s.score += 5;
          // Mist in the face stops a dive: enough of it and the boss gives up.
          if (b.move === "dive") {
            b.y -= 12;
            if (++b.struck >= DIVE_STOP) b.move = "rise";
          }
          return false;
        }
        return true;
      });
      b.hp = hp;
      if (b.hp > 0) next.push(b);
      else {
        ev.bossDown = true;
        s.score += 500 * (spec.room + 1);
      }
    }
    bosses = next;
    if (!bosses.length) {
      for (const b of bugs) ev.hits.push({ x: b.x, y: b.y, killed: true, points: killed(b) });
      bugs = [];
    }
  }
  s.bosses = bosses;

  // Mosquitoes zig-zag downwards; puffs hurt them.
  const kept: Mosquito[] = [];
  for (const b0 of bugs) {
    const b = { ...b0, phase: b0.phase + dt * 5 };
    const jitter = (rng.next() - 0.5) * (1100 + s.wave * 80) * dt;
    b.vx = Math.max(-170, Math.min(170, b.vx * 0.98 + jitter));
    // Sharp Guys swerve away from mist coming up underneath them.
    if (b.kind === "sharp") {
      const near = puffs.find((p) => p.y > b.y && p.y - b.y < 90 && Math.abs(p.x - b.x) < 46);
      if (near) b.vx = Math.max(-170, Math.min(170, b.vx + (b.x >= near.x ? 1 : -1) * 1500 * dt));
    }
    b.x += (b.vx + Math.sin(b.phase) * 60) * dt;
    if (b.up) {
      b.y -= 150 * dt;
      if (b.y < 130) delete b.up;
    } else {
      const fan = s.gear.includes("fan") && b.y > BED_Y - 130 ? 0.6 : 1;
      b.y += speed * (b.big ? 0.75 : 1) * fan * (0.6 + Math.abs(Math.sin(b.phase * 0.5))) * dt;
    }
    if (b.x < 14) [b.x, b.vx] = [14, Math.abs(b.vx)];
    if (b.x > W - 14) [b.x, b.vx] = [W - 14, -Math.abs(b.vx)];
    let hp = b.hp;
    puffs = puffs.filter((p) => {
      if (hp > 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + (b.big ? 11 : 6)) {
        hp--;
        return false;
      }
      return true;
    });
    if (hp < b.hp) {
      const dead = hp <= 0;
      const points = dead ? killed(b) : 0;
      if (dead && rng.next() < 0.09) {
        const r = rng.next();
        s.powers = [...s.powers, { kind: r < 0.34 ? "coil" : r < 0.67 ? "net" : "double", x: b.x, y: b.y }];
      }
      ev.hits.push({ x: b.x, y: b.y, killed: dead, points });
      if (dead) continue;
    }
    b.hp = hp;
    if (b.y >= BED_Y && !b.up) {
      bite(s, ev);
      continue;
    }
    kept.push(b);
  }
  s.bugs = kept;
  s.puffs = puffs;

  // Power-ups drift down; the can collects them.
  const powers: Power[] = [];
  for (const p of s.powers) {
    const y = p.y + 90 * dt;
    if (y > CAN_Y - 40 && Math.abs(p.x - s.can) < 40) {
      ev.power = p.kind;
      if (p.kind === "coil") s.coil = POWER_SECONDS;
      else if (p.kind === "net") s.net = POWER_SECONDS;
      else s.double = POWER_SECONDS;
    } else if (y < H) powers.push({ ...p, y });
  }
  s.powers = powers;

  if (spec) {
    // The career: clear every wave (or the boss) and morning comes.
    const clear = s.toSpawn === 0 && !s.bugs.length;
    if (spec.boss ? !s.bosses.length : clear && s.wave >= spec.waves && !s.puddles.length) s.won = true;
    else if (!spec.boss && clear && s.wave < spec.waves) {
      s.score += 200 * s.wave;
      s.wave++;
      s.toSpawn = spec.perWave;
      s.nextSpawn = s.time + 2;
      ev.wave = s.wave;
    }
  } else if (s.toSpawn === 0 && !s.bugs.length) {
    // Wave cleared: a short breather, then a bigger one.
    s.score += 200 * s.wave;
    s.wave++;
    s.toSpawn = waveSize(s.wave);
    s.nextSpawn = s.time + 2;
    ev.wave = s.wave;
  }
  s.cursor = rng.cursor();
  if (s.bites <= 0) {
    s.over = true;
    s.won = false;
  } else if (s.won) {
    s.over = true;
    ev.won = true;
  }
  return { state: s, ev };
}
