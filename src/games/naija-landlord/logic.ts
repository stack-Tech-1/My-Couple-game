import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, PlayerList } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";

/**
 * Naija Landlord: a short Lagos property game for 2 to 4 players. Our own design: a 20-space
 * loop, 12 streets in 6 neighbourhoods, 10 rounds, no auctions, no trading. Money is in
 * thousands of naira (150 = ₦150k). Rules and numbers come from the plan doc and its simulation.
 */

export type HoodId = "aj" | "ya" | "su" | "ik" | "le" | "io";
export type Space =
  | { kind: "street"; name: string; hood: HoodId; price: number; rent: number }
  | { kind: "payday" | "card" | "danfo" | "lastma" | "goslow" | "owambe" };

export const HOODS: Record<HoodId, { name: string; color: string }> = {
  aj: { name: "Ajegunle", color: "#8a5a3c" },
  ya: { name: "Yaba", color: "#4fa3d1" },
  su: { name: "Surulere", color: "#d4589a" },
  ik: { name: "Ikeja", color: "#e8873a" },
  le: { name: "Lekki", color: "#3f9a5c" },
  io: { name: "Ikoyi and VI", color: "#2f3f8f" },
};

const st = (name: string, hood: HoodId, price: number, rent: number): Space => ({ kind: "street", name, hood, price, rent });
export const SPACES: Space[] = [
  { kind: "payday" },
  st("Boundary Road", "aj", 100, 10),
  { kind: "card" },
  st("Tolu", "aj", 100, 10),
  { kind: "danfo" },
  st("Sabo", "ya", 150, 15),
  st("Akoka", "ya", 150, 15),
  { kind: "lastma" },
  st("Ojuelegba", "su", 200, 20),
  st("Adeniran Ogunsanya", "su", 200, 20),
  { kind: "goslow" },
  st("Allen Avenue", "ik", 280, 30),
  st("Computer Village", "ik", 280, 30),
  { kind: "card" },
  { kind: "danfo" },
  st("Admiralty Way", "le", 380, 40),
  st("Chevron", "le", 380, 40),
  { kind: "owambe" },
  st("Bourdillon", "io", 500, 55),
  st("Banana Island", "io", 500, 55),
];
export const BOARD_SIZE = SPACES.length;
export const START_CASH = 1500;
export const PAYDAY = 200;
export const ROUNDS = 10;
export const LASTMA_FINE = 50;
export const DANFO_FARE = 20;
export const OWAMBE = { big: { each: 50, cost: 100 }, small: { each: 20 } };
export const ROLL_MS = 20_000;
export const DECIDE_MS = 30_000;
export const targetFor = (players: number) => (players >= 4 ? 3250 : 3000);

export type Street = Extract<Space, { kind: "street" }>;
export const street = (sq: number): Street | null => {
  const s = SPACES[sq];
  return s?.kind === "street" ? s : null;
};
export const hoodSquares = (hood: HoodId) => SPACES.flatMap((s, i) => (s.kind === "street" && s.hood === hood ? [i] : []));

/** The Lagos Life deck. `text` is shown to everyone when the card is drawn. */
export type CardEffect =
  | { kind: "cash"; amount: number }
  | { kind: "perBuilding"; amount: number }
  | { kind: "fromEach"; amount: number }
  | { kind: "fromLeader"; amount: number }
  | { kind: "back"; steps: number }
  | { kind: "nextDanfo" }
  | { kind: "nextFreeStreet" }
  | { kind: "holiday"; landings: number }
  | { kind: "demolish" }
  | { kind: "othersSkip" }
  | { kind: "tenantRan" }
  | { kind: "swap" }
  | { kind: "onile" };
export const CARDS: { text: string; effect: CardEffect }[] = [
  { text: "Your aunty in London sent money. Collect ₦150k.", effect: { kind: "cash", amount: 150 } },
  { text: "NEPA took light. Generator fuel: pay ₦40k.", effect: { kind: "cash", amount: -40 } },
  { text: "A tenant paid two years upfront. Collect ₦100k.", effect: { kind: "cash", amount: 100 } },
  { text: "Agbero collected levy. Pay ₦20k.", effect: { kind: "cash", amount: -20 } },
  { text: "Danfo strike. You trekked: move back 3 spaces.", effect: { kind: "back", steps: 3 } },
  { text: "Your crypto finally went up. Collect ₦80k.", effect: { kind: "cash", amount: 80 } },
  { text: "Flood season. Fix your gutters: pay ₦25k for every building you own.", effect: { kind: "perBuilding", amount: 25 } },
  { text: "Omo onile showed up at your site. Pay ₦50k, or lose your next roll.", effect: { kind: "onile" } },
  { text: "You won the office Whot tournament. Every player pays you ₦20k.", effect: { kind: "fromEach", amount: 20 } },
  { text: "Free ride on the Blue Line. Go to the next danfo stop for free.", effect: { kind: "nextDanfo" } },
  { text: "You won the land dispute in court. Collect ₦200k from the richest player.", effect: { kind: "fromLeader", amount: 200 } },
  { text: "Your landlord friend owes you a favour. No rent the next 2 times you land on a street.", effect: { kind: "holiday", landings: 2 } },
  { text: "Demolition notice from the government. Lose a building from your most expensive street.", effect: { kind: "demolish" } },
  { text: "Okada shortcut. Move forward to the next street nobody owns.", effect: { kind: "nextFreeStreet" } },
  { text: "Third Mainland Bridge is closed. Everyone else skips their next roll.", effect: { kind: "othersSkip" } },
  { text: "Your tenant ran away at night. The next rent you collect goes to the bank.", effect: { kind: "tenantRan" } },
  { text: "Mummy needs you at home. Swap places on the board with another player.", effect: { kind: "swap" } },
  { text: "You sold your old phone at Computer Village. Collect ₦60k.", effect: { kind: "cash", amount: 60 } },
  { text: "Generator packed up. Repairs: pay ₦50k.", effect: { kind: "cash", amount: -50 } },
  { text: "School fees season. Pay ₦60k.", effect: { kind: "cash", amount: -60 } },
];

/** A question waiting on the current player. `yes` is the first button. */
export type Decision =
  | { kind: "buy"; sq: number; price: number }
  | { kind: "buyout"; sq: number; price: number; rent: number; owner: PlayerId }
  | { kind: "owambe" }
  | { kind: "onile" };

/** Shown in the feed. "@<player id>" inside text is replaced with that player's name. */
export type NlEvent = { id: number; by: PlayerId; text: string; tone?: "good" | "bad" | "card" };
export type EndReason = "target" | "rounds" | "standing";

export type NlState = {
  players: PlayerList;
  seed: string;
  rngCursor: number;
  cash: Record<PlayerId, number>;
  pos: Record<PlayerId, number>;
  owner: (PlayerId | null)[];
  /** 0 none, 1 flats, 2 estate. */
  level: number[];
  out: PlayerId[];
  /** Players who have taken a turn themselves. The timer only plays for people who have shown up. */
  awake: PlayerId[];
  skip: PlayerId[];
  holiday: Record<PlayerId, number>;
  tenantRan: PlayerId[];
  turn: number;
  firstTurn: number;
  round: number;
  rounds: number;
  target: number;
  phase: "roll" | "decide";
  decision: Decision | null;
  /** Rolls taken this turn (doubles earn one more). */
  rolls: number;
  dice: [number, number] | null;
  rollId: number;
  deadline: number;
  deck: number[];
  deckPos: number;
  lastCard: number | null;
  events: NlEvent[];
  seq: number;
  winner: PlayerId | "tie" | null;
  reason: EndReason | null;
};

export type NlMove = { kind: "roll" } | { kind: "build"; sq: number } | { kind: "answer"; yes: boolean } | { kind: "tick" };
export type NlConfig = { firstPlayer?: 0 | 1 };
export type NlView = Omit<NlState, "seed" | "rngCursor" | "deck" | "deckPos"> & {
  me: PlayerId;
  worth: Record<PlayerId, number>;
  /** Squares you can build on right now. */
  canBuild: number[];
};

const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("roll") }),
  z.object({ kind: z.literal("build"), sq: z.number().int().min(0).max(BOARD_SIZE - 1) }),
  z.object({ kind: z.literal("answer"), yes: z.boolean() }),
  z.object({ kind: z.literal("tick") }),
]) as z.ZodType<NlMove>;
const configSchema = z.object({ firstPlayer: z.union([z.literal(0), z.literal(1)]).optional() });

export const naira = (k: number) => (Math.abs(k) >= 1000 ? `₦${(k / 1000).toFixed(k % 1000 === 0 ? 0 : k % 100 === 0 ? 1 : 2)}M` : `₦${k}k`);

const active = (s: NlState) => s.players.filter((p) => !s.out.includes(p));
const current = (s: NlState) => s.players[s.turn]!;
export const buildCost = (sq: number) => street(sq)!.price / 2;

export function ownsHood(s: Pick<NlState, "owner">, hood: HoodId, who: PlayerId) {
  return hoodSquares(hood).every((sq) => s.owner[sq] === who);
}

export function worthOf(s: Pick<NlState, "cash" | "owner" | "level">, who: PlayerId) {
  let w = s.cash[who] ?? 0;
  s.owner.forEach((o, sq) => {
    if (o === who) w += street(sq)!.price + s.level[sq]! * buildCost(sq);
  });
  return w;
}

export function rentFor(s: Pick<NlState, "owner" | "level">, sq: number) {
  const st = street(sq)!;
  const lv = s.level[sq]!;
  if (lv === 2) return st.rent * 6;
  if (lv === 1) return st.rent * 3;
  return ownsHood(s, st.hood, s.owner[sq]!) ? st.rent * 2 : st.rent;
}

export function buildable(s: NlState, who: PlayerId): number[] {
  if (s.winner || s.phase !== "roll" || current(s) !== who || s.rolls > 0) return [];
  return SPACES.flatMap((sp, sq) =>
    sp.kind === "street" && s.owner[sq] === who && s.level[sq]! < 2 && ownsHood(s, sp.hood, who) && s.cash[who]! >= buildCost(sq) ? [sq] : [],
  );
}

/** Working copy so the helpers below can change things in place. */
type Draft = NlState;
const clone = (s: NlState): Draft => ({
  ...s,
  cash: { ...s.cash },
  pos: { ...s.pos },
  owner: [...s.owner],
  level: [...s.level],
  out: [...s.out],
  awake: [...s.awake],
  skip: [...s.skip],
  holiday: { ...s.holiday },
  tenantRan: [...s.tenantRan],
  events: [...s.events],
});

function log(d: Draft, by: PlayerId, text: string, tone?: NlEvent["tone"]) {
  d.seq++;
  d.events.push({ id: d.seq, by, text, ...(tone ? { tone } : {}) });
  if (d.events.length > 14) d.events.splice(0, d.events.length - 14);
}

/**
 * `who` pays `amount` to `to` (or the bank). Short of cash, buildings then streets are sold back
 * to the bank at half price. Still short means bankrupt: out of the game, streets back on the market.
 */
function pay(d: Draft, who: PlayerId, amount: number, to: PlayerId | null) {
  if (amount <= 0) return;
  if (d.cash[who]! < amount) raise(d, who, amount);
  const paid = Math.min(amount, d.cash[who]!);
  d.cash[who]! -= paid;
  if (to && !d.out.includes(to)) {
    // The tenant who ran away takes your next rent with them.
    if (d.tenantRan.includes(to)) {
      d.tenantRan = d.tenantRan.filter((p) => p !== to);
      log(d, to, `lost ${naira(paid)} rent. The tenant ran away with it`, "bad");
    } else d.cash[to]! += paid;
  }
  if (paid < amount) {
    d.out.push(who);
    d.owner.forEach((o, sq) => {
      if (o === who) {
        d.owner[sq] = null;
        d.level[sq] = 0;
      }
    });
    log(d, who, "is broke and out of the game. Their streets go back on the market", "bad");
  }
}

function raise(d: Draft, who: PlayerId, need: number) {
  const mine = d.owner.flatMap((o, sq) => (o === who ? [sq] : [])).sort((a, b) => street(a)!.price - street(b)!.price);
  for (const sq of mine) {
    while (d.cash[who]! < need && d.level[sq]! > 0) {
      d.level[sq]!--;
      d.cash[who]! += buildCost(sq) / 2;
      log(d, who, `sold a building on ${street(sq)!.name} to raise cash`, "bad");
    }
  }
  for (const sq of mine) {
    if (d.cash[who]! >= need) break;
    if (d.level[sq]! > 0) continue;
    d.owner[sq] = null;
    d.cash[who]! += street(sq)!.price / 2;
    log(d, who, `sold ${street(sq)!.name} back to the bank to raise cash`, "bad");
  }
}

function moveTo(d: Draft, who: PlayerId, to: number, opts: { forward: boolean; payday: boolean }) {
  const from = d.pos[who]!;
  if (opts.forward && opts.payday && to < from) {
    d.cash[who]! += PAYDAY;
    log(d, who, `passed Alaba Payday. Collected ${naira(PAYDAY)}`, "good");
  }
  d.pos[who] = to;
}

/** What happens on the square `who` just landed on. May leave a decision pending. */
function land(d: Draft, who: PlayerId, rng: ReturnType<typeof makeRng>): void {
  const sq = d.pos[who]!;
  const sp = SPACES[sq]!;
  switch (sp.kind) {
    case "payday":
      return;
    case "street": {
      const o = d.owner[sq] ?? null;
      if (o === null) {
        if (d.cash[who]! >= sp.price) d.decision = { kind: "buy", sq, price: sp.price };
        else log(d, who, `landed on ${sp.name} but can't afford ${naira(sp.price)}`);
        return;
      }
      if (o === who) return;
      const rent = rentFor(d, sq);
      const otherSq = hoodSquares(sp.hood).find((x) => x !== sq)!;
      const price = sp.price * 1.5;
      if (d.owner[otherSq] === who && d.level[sq] === 0 && d.cash[who]! >= price) {
        d.decision = { kind: "buyout", sq, price, rent, owner: o };
        return;
      }
      payRent(d, who, sq, rent, o);
      return;
    }
    case "card":
      return drawCard(d, who, rng);
    case "danfo": {
      const other = SPACES.findIndex((s, i) => s.kind === "danfo" && i !== sq);
      pay(d, who, DANFO_FARE, null);
      if (d.out.includes(who)) return;
      moveTo(d, who, other, { forward: true, payday: true });
      log(d, who, `took a danfo for ${naira(DANFO_FARE)} and jumped ahead`);
      return;
    }
    case "lastma":
      log(d, who, `got stopped by LASTMA. Fined ${naira(LASTMA_FINE)}`, "bad");
      return pay(d, who, LASTMA_FINE, null);
    case "goslow":
      if (!d.skip.includes(who)) d.skip.push(who);
      log(d, who, "is stuck in go-slow and skips the next roll", "bad");
      return;
    case "owambe":
      d.decision = { kind: "owambe" };
      return;
  }
}

function payRent(d: Draft, who: PlayerId, sq: number, rent: number, owner: PlayerId) {
  const sp = street(sq)!;
  if ((d.holiday[who] ?? 0) > 0) {
    d.holiday[who]!--;
    log(d, who, `landed on ${sp.name}. Rent holiday, nothing to pay`, "good");
    return;
  }
  log(d, who, `paid @${owner} ${naira(rent)} rent on ${sp.name}`, "bad");
  pay(d, who, rent, owner);
}

function drawCard(d: Draft, who: PlayerId, rng: ReturnType<typeof makeRng>): void {
  if (d.deckPos >= d.deck.length) {
    d.deck = shuffle(CARDS.map((_, i) => i), rng);
    d.deckPos = 0;
  }
  const idx = d.deck[d.deckPos++]!;
  d.lastCard = idx;
  const card = CARDS[idx]!;
  log(d, who, `drew a Lagos Life card: "${card.text}"`, "card");
  const e = card.effect;
  const others = active(d).filter((p) => p !== who);
  switch (e.kind) {
    case "cash":
      if (e.amount > 0) d.cash[who]! += e.amount;
      else pay(d, who, -e.amount, null);
      return;
    case "perBuilding": {
      const n = d.owner.reduce((a, o, sq) => a + (o === who ? d.level[sq]! : 0), 0);
      return pay(d, who, n * e.amount, null);
    }
    case "fromEach":
      for (const p of others) pay(d, p, e.amount, who);
      return;
    case "fromLeader": {
      const leader = [...active(d)].sort((a, b) => worthOf(d, b) - worthOf(d, a))[0]!;
      if (leader === who) log(d, who, "is already the richest. Nobody to collect from");
      else pay(d, leader, e.amount, who);
      return;
    }
    case "back":
      moveTo(d, who, (d.pos[who]! - e.steps + BOARD_SIZE) % BOARD_SIZE, { forward: false, payday: false });
      return land(d, who, rng);
    case "nextDanfo": {
      let to = (d.pos[who]! + 1) % BOARD_SIZE;
      while (SPACES[to]!.kind !== "danfo") to = (to + 1) % BOARD_SIZE;
      moveTo(d, who, to, { forward: true, payday: true });
      return;
    }
    case "nextFreeStreet": {
      for (let i = 1; i < BOARD_SIZE; i++) {
        const to = (d.pos[who]! + i) % BOARD_SIZE;
        if (street(to) && d.owner[to] === null) {
          moveTo(d, who, to, { forward: true, payday: true });
          return land(d, who, rng);
        }
      }
      log(d, who, "found every street taken. Stays put");
      return;
    }
    case "holiday":
      d.holiday[who] = (d.holiday[who] ?? 0) + e.landings;
      return;
    case "demolish": {
      const built = d.owner.flatMap((o, sq) => (o === who && d.level[sq]! > 0 ? [sq] : [])).sort((a, b) => street(b)!.price - street(a)!.price);
      if (built[0] === undefined) return log(d, who, "has no buildings. The notice goes in the bin", "good");
      d.level[built[0]]!--;
      return;
    }
    case "othersSkip":
      for (const p of others) if (!d.skip.includes(p)) d.skip.push(p);
      return;
    case "tenantRan":
      if (!d.tenantRan.includes(who)) d.tenantRan.push(who);
      return;
    case "swap": {
      if (!others.length) return;
      const them = others[rng.int(others.length)]!;
      const mine = d.pos[who]!;
      d.pos[who] = d.pos[them]!;
      d.pos[them] = mine;
      log(d, who, `swapped places with @${them}`);
      return;
    }
    case "onile":
      d.decision = { kind: "onile" };
      return;
  }
}

function seatOrder(s: NlState, seat: number) {
  const n = s.players.length;
  return (seat - s.firstTurn + n) % n;
}

/** After a turn's business is done: check for a winner, then pass the turn (or roll again on doubles). */
function settle(d: Draft, now: number): NlState {
  const alive = active(d);
  if (alive.length <= 1) {
    d.winner = alive[0] ?? "tie";
    d.reason = "standing";
    return d;
  }
  const rich = alive.filter((p) => worthOf(d, p) >= d.target).sort((a, b) => worthOf(d, b) - worthOf(d, a));
  if (rich[0]) {
    d.winner = rich[0];
    d.reason = "target";
    log(d, rich[0], `is worth ${naira(worthOf(d, rich[0]))}. Landlord of Lagos!`, "good");
    return d;
  }
  if (d.decision) {
    d.phase = "decide";
    d.deadline = now + DECIDE_MS;
    return d;
  }
  const me = current(d);
  const doubles = d.dice && d.dice[0] === d.dice[1];
  if (doubles && d.rolls < 2 && !d.out.includes(me) && !d.skip.includes(me)) {
    d.phase = "roll";
    d.deadline = now + ROLL_MS;
    return d;
  }
  return nextTurn(d, now);
}

function nextTurn(d: Draft, now: number): NlState {
  const n = d.players.length;
  let seat = d.turn;
  for (;;) {
    const next = (seat + 1) % n;
    if (seatOrder(d, next) <= seatOrder(d, seat)) {
      if (d.round >= d.rounds) return finishByWorth(d);
      d.round++;
    }
    seat = next;
    const p = d.players[seat]!;
    if (d.out.includes(p)) continue;
    if (d.skip.includes(p)) {
      d.skip = d.skip.filter((x) => x !== p);
      log(d, p, "sits out this roll");
      continue;
    }
    break;
  }
  d.turn = seat;
  d.phase = "roll";
  d.rolls = 0;
  d.decision = null;
  d.deadline = now + ROLL_MS;
  return d;
}

function finishByWorth(d: Draft): NlState {
  const ranked = active(d).sort((a, b) => worthOf(d, b) - worthOf(d, a));
  const top = ranked[0]!;
  const tied = ranked[1] !== undefined && worthOf(d, ranked[1]) === worthOf(d, top);
  d.winner = tied ? "tie" : top;
  d.reason = "rounds";
  d.decision = null;
  return d;
}

function doRoll(s: NlState, now: number): NlState {
  const d = clone(s);
  const me = current(d);
  const rng = makeRng(d.seed, d.rngCursor);
  const dice: [number, number] = [rng.int(6) + 1, rng.int(6) + 1];
  d.dice = dice;
  d.rolls++;
  d.rollId++;
  log(d, me, `rolled ${dice[0]} and ${dice[1]}${dice[0] === dice[1] ? ". Doubles!" : ""}`);
  moveTo(d, me, (d.pos[me]! + dice[0] + dice[1]) % BOARD_SIZE, { forward: true, payday: true });
  land(d, me, rng);
  d.rngCursor = rng.cursor();
  return settle(d, now);
}

function answer(s: NlState, yes: boolean, now: number): NlState {
  const d = clone(s);
  const me = current(d);
  const q = d.decision!;
  d.decision = null;
  const rng = makeRng(d.seed, d.rngCursor);
  switch (q.kind) {
    case "buy":
      if (yes && d.cash[me]! >= q.price) {
        d.cash[me]! -= q.price;
        d.owner[q.sq] = me;
        log(d, me, `bought ${street(q.sq)!.name} for ${naira(q.price)}. Na your own now!`, "good");
      } else log(d, me, `passed on ${street(q.sq)!.name}`);
      break;
    case "buyout":
      if (yes && d.cash[me]! >= q.price && d.owner[q.sq] === q.owner) {
        d.cash[me]! -= q.price;
        d.cash[q.owner]! += q.price;
        d.owner[q.sq] = me;
        log(d, me, `bought out @${q.owner} on ${street(q.sq)!.name} for ${naira(q.price)}. ${HOODS[street(q.sq)!.hood].name} is all theirs`, "good");
      } else payRent(d, me, q.sq, q.rent, q.owner);
      break;
    case "owambe": {
      const others = active(d).filter((p) => p !== me);
      if (yes) {
        log(d, me, `threw a big owambe. Everyone else pays ${naira(OWAMBE.big.each)}, the party costs ${naira(OWAMBE.big.cost)}`, "card");
        pay(d, me, OWAMBE.big.cost, null);
        for (const p of others) pay(d, p, OWAMBE.big.each, me);
      } else {
        log(d, me, `kept the owambe to small chops. Everyone else pays ${naira(OWAMBE.small.each)}`, "card");
        for (const p of others) pay(d, p, OWAMBE.small.each, me);
      }
      break;
    }
    case "onile":
      if (yes) {
        log(d, me, `settled the omo onile with ${naira(50)}`, "bad");
        pay(d, me, 50, null);
      } else {
        if (!d.skip.includes(me)) d.skip.push(me);
        log(d, me, "refused the omo onile and loses the next roll", "bad");
      }
      break;
  }
  d.rngCursor = rng.cursor();
  return settle(d, now);
}

export const naijaLandlord: GameLogic<NlState, NlMove, NlView, NlConfig, PlayerList> = {
  id: "naija-landlord",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: 15,
  moveSchema,
  configSchema: configSchema as unknown as z.ZodType<NlConfig>,
  rules: {
    summary: "Buy Lagos streets, collect rent, survive go-slow and owambe bills. Richest landlord wins.",
    sections: [
      { title: "The start", body: [`Everyone gets ${naira(START_CASH)} and one street for free.`, `The game lasts ${ROUNDS} rounds. Be the first worth ${naira(3000)} (${naira(3250)} with 4 players) to win early.`] },
      { title: "A turn", body: ["Roll two dice and move. Doubles roll again, once.", `Pass Alaba Payday to collect ${naira(PAYDAY)}.`, "Land on a free street to buy it, or pass. Land on someone's street and you pay rent."] },
      { title: "Buy-out", body: ["Own one street in a neighbourhood and land on the other? You can buy it from its owner for 1.5 times the price. They can't refuse, but they make a profit."] },
      { title: "Building", body: ["Own both streets in a neighbourhood and you can build before you roll: flats, then an estate. Each costs half the street price.", "Rent doubles when you own both streets, goes up 3 times with flats, and 6 times with an estate."] },
      { title: "Lagos life", body: ["Danfo: pay ₦20k and jump to the other stop. LASTMA: ₦50k fine. Go-slow: skip your next roll.", "Owambe: you're the celebrant. Host big, or keep it to small chops.", "Lagos Life cards can help you or hurt you."] },
      { title: "Winning", body: ["After the last round, the highest net worth wins: cash, plus streets and buildings at what you paid.", "Run out of money and you're out. You have 20 seconds to roll, or Amah rolls for you."] },
    ],
  },

  initialState(seed, players, config, ctx) {
    const rng = makeRng(seed);
    const first = players.length === 2 ? (config.firstPlayer ?? rng.int(2)) : rng.int(players.length);
    const owner: (PlayerId | null)[] = SPACES.map(() => null);
    const streets = shuffle(
      SPACES.flatMap((s, i) => (s.kind === "street" ? [i] : [])),
      rng,
    );
    // One free street each.
    for (const p of players) owner[streets.pop()!] = p;
    const deck = shuffle(
      CARDS.map((_, i) => i),
      rng,
    );
    return {
      players: [...players],
      seed,
      rngCursor: rng.cursor(),
      cash: Object.fromEntries(players.map((p) => [p, START_CASH])),
      pos: Object.fromEntries(players.map((p) => [p, 0])),
      owner,
      level: SPACES.map(() => 0),
      out: [],
      awake: [],
      skip: [],
      holiday: Object.fromEntries(players.map((p) => [p, 0])),
      tenantRan: [],
      turn: first,
      firstTurn: first,
      round: 1,
      rounds: ROUNDS,
      target: targetFor(players.length),
      phase: "roll",
      decision: null,
      rolls: 0,
      dice: null,
      rollId: 0,
      deadline: ctx.now + ROLL_MS,
      deck,
      deckPos: 0,
      lastCard: null,
      events: [],
      seq: 0,
      winner: null,
      reason: null,
    };
  },

  validateMove(s, move, by, ctx) {
    if (s.winner || !s.players.includes(by)) return false;
    if (move.kind === "tick") return ctx.now >= s.deadline && s.awake.includes(current(s));
    if (current(s) !== by) return false;
    switch (move.kind) {
      case "roll":
        return s.phase === "roll";
      case "build":
        return buildable(s, by).includes(move.sq);
      case "answer":
        return s.phase === "decide" && s.decision !== null;
    }
  },

  applyMove(prev, move, by, ctx) {
    const s = move.kind === "tick" || prev.awake.includes(by) ? prev : { ...prev, awake: [...prev.awake, by] };
    switch (move.kind) {
      case "roll":
        return doRoll(s, ctx.now);
      case "build": {
        const d = clone(s);
        const me = current(d);
        d.cash[me]! -= buildCost(move.sq);
        d.level[move.sq]!++;
        log(d, me, `built ${d.level[move.sq] === 1 ? "flats" : "an estate"} on ${street(move.sq)!.name}`, "good");
        // Building can push you over the target.
        d.decision = null;
        const settled = worthOf(d, me) >= d.target ? settle(d, ctx.now) : d;
        return { ...settled, deadline: settled.winner ? settled.deadline : ctx.now + ROLL_MS };
      }
      case "answer":
        return answer(s, move.yes, ctx.now);
      case "tick":
        // Out of time: Amah rolls for you, or takes the safe answer (no purchase, small chops, pay up).
        if (s.phase === "roll") return doRoll(s, ctx.now);
        return answer(s, s.decision?.kind === "onile", ctx.now);
    }
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  // The seed, cursor and deck order stay on the server: they'd reveal every future roll and card.
  viewFor(s, player) {
    const { seed: _seed, rngCursor: _c, deck: _d, deckPos: _p, ...rest } = s;
    return {
      ...rest,
      me: player,
      worth: Object.fromEntries(s.players.map((p) => [p, s.out.includes(p) ? 0 : worthOf(s, p)])),
      canBuild: buildable(s, player),
    };
  },
};
