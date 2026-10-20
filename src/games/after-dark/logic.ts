import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";
import { DARES, DICE, HOT_SEAT, NEVER, TRUTHS, type Card, type Heat } from "@/content/after-dark";

/**
 * Shared rules for every After Dark game:
 *  - maxHeat and custom cards are assembled by the SERVER from the database (the lower of the
 *    two players' limits; the room's own cards). Whatever a client sends is ignored.
 *  - Either player can skip any card instantly: no penalty, no record of who or why.
 *  - Seeds never reach clients; views only ever contain the current card.
 */
export const SPICY_IDS = ["truth-or-dare", "spicy-dice", "hot-seat", "never-have-i", "fantasy-match"] as const;
export const isSpicy = (id: string) => (SPICY_IDS as readonly string[]).includes(id);

const heat = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const customCardSchema = z.object({ deck: z.enum(["truth", "dare", "hotseat", "never", "dice_action", "dice_where"]), heat, text: z.string().min(2).max(200) });
export type CustomCard = z.infer<typeof customCardSchema>;
export const spicyConfigSchema = z.object({ maxHeat: heat.default(1), custom: z.array(customCardSchema).max(500).default([]) });
export type SpicyConfig = z.input<typeof spicyConfigSchema>;

const withCustom = (base: Card[], custom: CustomCard[], deck: CustomCard["deck"], max: Heat): Card[] =>
  [...base, ...custom.filter((c) => c.deck === deck).map((c) => ({ text: c.text, heat: c.heat }))].filter((c) => c.heat <= max);

/** A shuffled deck plus a cursor. Drawing skips cards hotter than the current setting. */
type Deck = { cards: Card[]; pos: number };
const makeDeck = (cards: Card[], seed: string, salt: string): Deck => ({ cards: shuffle(cards, makeRng(`${seed}:${salt}`)), pos: 0 });
function draw(d: Deck, h: Heat): { card: Card | null; deck: Deck } {
  const n = d.cards.length;
  for (let i = 0; i < n; i++) {
    const idx = (d.pos + i) % n;
    const c = d.cards[idx]!;
    if (c.heat <= h) return { card: c, deck: { ...d, pos: idx + 1 } };
  }
  return { card: null, deck: d };
}

const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);
const common = { minPlayers: 2 as const, maxPlayers: 2 as const, category: "spicy" as const };
const heatMove = z.object({ type: z.literal("heat"), heat });
const simple = (t: string) => z.object({ type: z.literal(t) });

// ---------------------------------------------------------------------------
// Truth or Dare: After Dark
// ---------------------------------------------------------------------------
export type TodState = { players: Players; turn: 0 | 1; maxHeat: Heat; heat: Heat; truths: Deck; dares: Deck; current: { kind: "truth" | "dare"; card: Card } | null; ended: boolean };
export type TodMove = { type: "pick"; kind: "truth" | "dare" } | { type: "done" } | { type: "skip" } | { type: "heat"; heat: Heat } | { type: "end" };
export type TodView = { players: Players; me: PlayerId; turn: PlayerId; maxHeat: Heat; heat: Heat; current: TodState["current"]; ended: boolean };

export const truthOrDare: GameLogic<TodState, TodMove, TodView, SpicyConfig> = {
  ...common,
  id: "truth-or-dare",
  estimatedMinutes: 15,
  moveSchema: z.discriminatedUnion("type", [z.object({ type: z.literal("pick"), kind: z.enum(["truth", "dare"]) }), simple("done"), simple("skip"), heatMove, simple("end")]) as z.ZodType<TodMove>,
  configSchema: spicyConfigSchema as unknown as z.ZodType<SpicyConfig>,
  rules: {
    summary: "Take turns choosing truth or dare. The heat never goes past the lower of your two limits.",
    sections: [
      { title: "Your turn", body: ["Pick truth or dare. Answer honestly, or do the dare, then it's their turn."] },
      { title: "Skip anything", body: ["Either of you can skip any card, instantly, no penalty and no questions."] },
      { title: "Heat", body: ["Warm, Hot or Fire. Either of you can turn it down at any time."] },
    ],
  },
  initialState(seed, players, config) {
    const cfg = spicyConfigSchema.parse(config);
    const max = cfg.maxHeat as Heat;
    return {
      players,
      turn: makeRng(seed).int(2) as 0 | 1,
      maxHeat: max,
      heat: 1,
      truths: makeDeck(withCustom(TRUTHS, cfg.custom, "truth", max), seed, "t"),
      dares: makeDeck(withCustom(DARES, cfg.custom, "dare", max), seed, "d"),
      current: null,
      ended: false,
    };
  },
  validateMove(s, m, by) {
    if (s.ended) return false;
    if (m.type === "pick") return !s.current && s.players[s.turn] === by;
    if (m.type === "done" || m.type === "skip") return !!s.current;
    if (m.type === "heat") return m.heat <= s.maxHeat;
    return true;
  },
  applyMove(s, m) {
    switch (m.type) {
      case "pick":
      case "skip": {
        const kind = m.type === "pick" ? m.kind : s.current!.kind;
        const key = kind === "truth" ? "truths" : "dares";
        const r = draw(s[key], s.heat);
        return { ...s, [key]: r.deck, current: r.card ? { kind, card: r.card } : null };
      }
      case "done":
        return { ...s, current: null, turn: other(s.turn) };
      case "heat":
        return { ...s, heat: m.heat };
      case "end":
        return { ...s, ended: true, current: null };
    }
  },
  isOver: (s): Outcome => (s.ended ? { over: true, complete: true } : { over: false }),
  viewFor: (s, p) => ({ players: s.players, me: p, turn: s.players[s.turn], maxHeat: s.maxHeat, heat: s.heat, current: s.current, ended: s.ended }),
};

// ---------------------------------------------------------------------------
// Spicy Dice
// ---------------------------------------------------------------------------
export type DiceState = { players: Players; seed: string; cursor: number; turn: 0 | 1; maxHeat: Heat; heat: Heat; custom: CustomCard[]; roll: { action: string; where: string; a: number; w: number } | null; rollId: number; ended: boolean };
export type DiceMove = { type: "roll" } | { type: "done" } | { type: "skip" } | { type: "heat"; heat: Heat } | { type: "end" };
export type DiceView = Omit<DiceState, "seed" | "cursor" | "custom"> & { me: PlayerId; turnId: PlayerId; faces: { action: string[]; where: string[] } };

/** Six base faces at the current heat, plus any custom faces for this room at or below it. */
function facesFor(s: Pick<DiceState, "heat" | "custom">) {
  const extra = (deck: CustomCard["deck"]) => s.custom.filter((c) => c.deck === deck && c.heat <= s.heat).map((c) => c.text);
  return { action: [...DICE[s.heat].action, ...extra("dice_action")], where: [...DICE[s.heat].where, ...extra("dice_where")] };
}
function rollDice(s: DiceState): DiceState {
  const rng = makeRng(s.seed, s.cursor);
  const f = facesFor(s);
  const a = rng.int(f.action.length);
  const w = rng.int(f.where.length);
  return { ...s, cursor: rng.cursor(), roll: { action: f.action[a]!, where: f.where[w]!, a, w }, rollId: s.rollId + 1 };
}

export const spicyDice: GameLogic<DiceState, DiceMove, DiceView, SpicyConfig> = {
  ...common,
  id: "spicy-dice",
  estimatedMinutes: 10,
  moveSchema: z.discriminatedUnion("type", [simple("roll"), simple("done"), simple("skip"), heatMove, simple("end")]) as z.ZodType<DiceMove>,
  configSchema: spicyConfigSchema as unknown as z.ZodType<SpicyConfig>,
  rules: {
    summary: "Roll two dice: one says what, the other says where or how. Then it's their turn.",
    sections: [
      { title: "Rolling", body: ["On your turn, roll. Do what the dice say to your partner, then hand over."] },
      { title: "Skip anything", body: ["Not feeling it? Either of you can re-roll, no penalty."] },
    ],
  },
  initialState(seed, players, config) {
    const cfg = spicyConfigSchema.parse(config);
    return { players, seed, cursor: 0, turn: makeRng(seed).int(2) as 0 | 1, maxHeat: cfg.maxHeat as Heat, heat: 1, custom: cfg.custom.filter((c) => c.heat <= cfg.maxHeat), roll: null, rollId: 0, ended: false };
  },
  validateMove(s, m, by) {
    if (s.ended) return false;
    if (m.type === "roll") return !s.roll && s.players[s.turn] === by;
    if (m.type === "done" || m.type === "skip") return !!s.roll;
    if (m.type === "heat") return m.heat <= s.maxHeat;
    return true;
  },
  applyMove(s, m) {
    switch (m.type) {
      case "roll":
      case "skip":
        return rollDice(s);
      case "done":
        return { ...s, roll: null, turn: other(s.turn) };
      case "heat":
        return { ...s, heat: m.heat };
      case "end":
        return { ...s, ended: true, roll: null };
    }
  },
  isOver: (s): Outcome => (s.ended ? { over: true, complete: true } : { over: false }),
  viewFor: (s, p) => {
    const { seed: _s, cursor: _c, custom: _x, ...rest } = s;
    return { ...rest, me: p, turnId: s.players[s.turn], faces: facesFor(s) };
  },
};

// ---------------------------------------------------------------------------
// Hot Seat
// ---------------------------------------------------------------------------
export const RUN = 5;
export type SeatState = { players: Players; seat: 0 | 1; maxHeat: Heat; heat: Heat; deck: Deck; current: Card | null; answered: number; ended: boolean };
export type SeatMove = { type: "next" } | { type: "skip" } | { type: "swap" } | { type: "heat"; heat: Heat } | { type: "end" };
export type SeatView = { players: Players; me: PlayerId; inSeat: PlayerId; maxHeat: Heat; heat: Heat; current: Card | null; answered: number; run: number; ended: boolean };

export const hotSeat: GameLogic<SeatState, SeatMove, SeatView, SpicyConfig> = {
  ...common,
  id: "hot-seat",
  estimatedMinutes: 10,
  moveSchema: z.discriminatedUnion("type", [simple("next"), simple("skip"), simple("swap"), heatMove, simple("end")]) as z.ZodType<SeatMove>,
  configSchema: spicyConfigSchema as unknown as z.ZodType<SpicyConfig>,
  rules: {
    summary: `One of you takes the hot seat for ${RUN} flirty questions. Then swap chairs.`,
    sections: [
      { title: "In the seat", body: ["Answer out loud. Honesty encouraged, theatrics more so."] },
      { title: "Skip anything", body: ["Either of you can skip a question, no explanation needed."] },
    ],
  },
  initialState(seed, players, config) {
    const cfg = spicyConfigSchema.parse(config);
    const max = cfg.maxHeat as Heat;
    const deck = makeDeck(withCustom(HOT_SEAT, cfg.custom, "hotseat", max), seed, "h");
    const first = draw(deck, 1);
    return { players, seat: makeRng(seed).int(2) as 0 | 1, maxHeat: max, heat: 1, deck: first.deck, current: first.card, answered: 0, ended: false };
  },
  validateMove(s, m) {
    if (s.ended) return false;
    if (m.type === "heat") return m.heat <= s.maxHeat;
    return true;
  },
  applyMove(s, m) {
    switch (m.type) {
      case "next": {
        const answered = s.answered + 1;
        const seat = answered >= RUN ? other(s.seat) : s.seat;
        const r = draw(s.deck, s.heat);
        return { ...s, deck: r.deck, current: r.card, seat, answered: answered >= RUN ? 0 : answered };
      }
      case "skip": {
        const r = draw(s.deck, s.heat);
        return { ...s, deck: r.deck, current: r.card };
      }
      case "swap": {
        const r = draw(s.deck, s.heat);
        return { ...s, deck: r.deck, current: r.card, seat: other(s.seat), answered: 0 };
      }
      case "heat":
        return { ...s, heat: m.heat };
      case "end":
        return { ...s, ended: true };
    }
  },
  isOver: (s): Outcome => (s.ended ? { over: true, complete: true } : { over: false }),
  viewFor: (s, p) => ({ players: s.players, me: p, inSeat: s.players[s.seat], maxHeat: s.maxHeat, heat: s.heat, current: s.current, answered: s.answered, run: RUN, ended: s.ended }),
};

// ---------------------------------------------------------------------------
// Never Have I Ever: After Dark
// ---------------------------------------------------------------------------
export type NeverState = { players: Players; maxHeat: Heat; heat: Heat; deck: Deck; current: Card | null; answers: Record<PlayerId, boolean | null>; tally: Record<PlayerId, number>; ended: boolean };
export type NeverMove = { type: "answer"; have: boolean } | { type: "next" } | { type: "skip" } | { type: "heat"; heat: Heat } | { type: "end" };
export type NeverView = { players: Players; me: PlayerId; maxHeat: Heat; heat: Heat; current: Card | null; mine: boolean | null; partnerAnswered: boolean; revealed: Record<PlayerId, boolean> | null; tally: Record<PlayerId, number>; ended: boolean };

export const neverHaveI: GameLogic<NeverState, NeverMove, NeverView, SpicyConfig> = {
  ...common,
  id: "never-have-i",
  estimatedMinutes: 10,
  moveSchema: z.discriminatedUnion("type", [z.object({ type: z.literal("answer"), have: z.boolean() }), simple("next"), simple("skip"), heatMove, simple("end")]) as z.ZodType<NeverMove>,
  configSchema: spicyConfigSchema as unknown as z.ZodType<SpicyConfig>,
  rules: {
    summary: "A statement appears. You each secretly tap 'I have' or 'I haven't'. Then you both find out.",
    sections: [
      { title: "Secret answers", body: ["Neither of you sees the other's answer until you've both tapped."] },
      { title: "Skip anything", body: ["Either of you can skip a card. No one sees why."] },
    ],
  },
  initialState(seed, players, config) {
    const cfg = spicyConfigSchema.parse(config);
    const max = cfg.maxHeat as Heat;
    const deck = makeDeck(withCustom(NEVER, cfg.custom, "never", max), seed, "n");
    const first = draw(deck, 1);
    return { players, maxHeat: max, heat: 1, deck: first.deck, current: first.card, answers: { [players[0]]: null, [players[1]]: null }, tally: { [players[0]]: 0, [players[1]]: 0 }, ended: false };
  },
  validateMove(s, m, by) {
    if (s.ended) return false;
    if (m.type === "answer") return !!s.current && s.answers[by] === null;
    if (m.type === "next") return s.players.every((p) => s.answers[p] !== null);
    if (m.type === "heat") return m.heat <= s.maxHeat;
    return true;
  },
  applyMove(s, m, by) {
    const fresh = { [s.players[0]]: null, [s.players[1]]: null };
    switch (m.type) {
      case "answer": {
        const answers = { ...s.answers, [by]: m.have };
        const tally = m.have ? { ...s.tally, [by]: s.tally[by]! + 1 } : s.tally;
        return { ...s, answers, tally };
      }
      case "next":
      case "skip": {
        const r = draw(s.deck, s.heat);
        return { ...s, deck: r.deck, current: r.card, answers: fresh };
      }
      case "heat":
        return { ...s, heat: m.heat };
      case "end":
        return { ...s, ended: true };
    }
  },
  isOver: (s): Outcome => (s.ended ? { over: true, complete: true } : { over: false }),
  viewFor: (s, p) => {
    const partner = s.players[0] === p ? s.players[1] : s.players[0];
    const both = s.players.every((x) => s.answers[x] !== null);
    return {
      players: s.players,
      me: p,
      maxHeat: s.maxHeat,
      heat: s.heat,
      current: s.current,
      mine: s.answers[p] ?? null,
      partnerAnswered: s.answers[partner] !== null,
      revealed: both ? (s.answers as Record<PlayerId, boolean>) : null,
      // Tallies only include revealed rounds, so a pending answer can't be inferred from the count.
      tally: both ? s.tally : Object.fromEntries(s.players.map((x) => [x, s.tally[x]! - (s.answers[x] ? 1 : 0)])),
      ended: s.ended,
    };
  },
};
