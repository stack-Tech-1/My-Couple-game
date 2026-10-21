import { z } from "zod";
import type { GameLogic, Outcome, PlayerId, Players } from "@/games/_engine/types";
import { makeRng, shuffle } from "@/games/_engine/rng";

export const SHAPES = ["circle", "triangle", "cross", "square", "star"] as const;
export type Shape = (typeof SHAPES)[number];
export type Card = { id: number; shape: Shape | "whot"; n: number };

/** Standard 54-card Nigerian Whot deck. */
const NUMBERS: Record<Shape, number[]> = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
};

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const shape of SHAPES) for (const n of NUMBERS[shape]) deck.push({ id: id++, shape, n });
  for (let i = 0; i < 5; i++) deck.push({ id: id++, shape: "whot", n: 20 });
  return deck;
}

export const SPECIAL = { holdOn: 1, pickTwo: 2, pickThree: 5, suspension: 8, generalMarket: 14, whot: 20 } as const;
const isSpecial = (c: Card) => [1, 2, 5, 8, 14, 20].includes(c.n);

export const whotRulesSchema = z.object({
  /** A Pick Two can be defended with another 2 (and Pick Three with a 5), passing the total on. */
  stackPicks: z.boolean().default(false),
  /** After General Market (14) the player who played it goes again. */
  generalMarketHold: z.boolean().default(true),
  /** Going down to one card without tapping "Last card" costs two cards. */
  announceLastCard: z.boolean().default(false),
  handSize: z.number().int().min(4).max(8).default(5),
});
export type WhotRules = z.infer<typeof whotRulesSchema>;

const configSchema = whotRulesSchema.extend({
  firstPlayer: z.union([z.literal(0), z.literal(1)]).optional(),
  /** Market finish mode: the market is reshuffled once; when it runs out again, hands are counted. */
  marketFinish: z.boolean().default(false),
});
export type WhotConfig = z.input<typeof configSchema>;

export type LogEntry =
  | { by: PlayerId; kind: "play"; card: Card; called?: Shape }
  | { by: PlayerId; kind: "draw"; count: number; reason: "market" | "pick" | "general" | "penalty" }
  | { by: PlayerId; kind: "lastCard" }
  | { by: null; kind: "reshuffle" };

export type WhotState = {
  players: Players;
  seed: string;
  rngCursor: number;
  rules: WhotRules;
  hands: Record<PlayerId, Card[]>;
  market: Card[];
  pile: Card[];
  turn: 0 | 1;
  pendingPick: number;
  pendingKind: 2 | 5 | null;
  requested: Shape | null;
  log: LogEntry[];
  /** Set when the market can't cover a draw: the game ends on a card count. */
  marketDry: boolean;
  /** Market finish mode (absent on older sessions = classic). `reshuffles` counts market refills. */
  finish?: { on: boolean; reshuffles: number };
  winner: PlayerId | "tie" | null;
  firstTurn: 0 | 1;
};

export type WhotMove = { type: "play"; cardId: number; shape?: Shape; lastCard?: boolean } | { type: "draw" };

export type WhotView = {
  players: Players;
  me: PlayerId;
  hand: Card[];
  playable: number[];
  opponentCount: number;
  top: Card;
  marketCount: number;
  turn: PlayerId;
  pendingPick: number;
  pendingKind: 2 | 5 | null;
  requested: Shape | null;
  log: LogEntry[];
  rules: WhotRules;
  winner: PlayerId | "tie" | null;
  /** Revealed only when the game is over (for the final tally). */
  finalHands: Record<PlayerId, Card[]> | null;
  /** How it ended: someone ran out of cards, or the hands were counted. */
  endedBy: "out" | "count" | null;
  /** Hand totals when the game ended on a count. */
  tally: Record<PlayerId, number> | null;
  /** Market finish mode: which market this is, and whether it's nearly gone. */
  finish: { market: 1 | 2; warn: boolean } | null;
};

/** In market finish mode, the warning shows when this many cards or fewer are left in the second market. */
export const FINISH_WARN_AT = 6;

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play"), cardId: z.number().int().min(0).max(53), shape: z.enum(SHAPES).optional(), lastCard: z.boolean().optional() }),
  z.object({ type: z.literal("draw") }),
]);

const top = (s: WhotState) => s.pile[s.pile.length - 1]!;
const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);

export function canPlay(s: Pick<WhotState, "pile" | "pendingPick" | "pendingKind" | "requested" | "rules">, card: Card): boolean {
  if (s.pendingPick > 0) return s.rules.stackPicks && s.pendingKind !== null && card.n === s.pendingKind;
  if (card.shape === "whot") return true;
  if (s.requested) return card.shape === s.requested;
  const t = s.pile[s.pile.length - 1]!;
  return card.shape === t.shape || card.n === t.n;
}

/**
 * Points left in a hand, for the end-of-market tally. Classic: stars count double, Whot is 20.
 * Market finish mode counts face value only (Whot is still 20).
 */
export function handValue(hand: Card[], faceValue = false): number {
  return hand.reduce((sum, c) => sum + (c.shape === "star" && !faceValue ? c.n * 2 : c.n), 0);
}
const finishOn = (s: Pick<WhotState, "finish">) => s.finish?.on === true;

/** Draws up to n cards, reshuffling the pile under the top card if the market runs out. */
function draw(s: WhotState, who: PlayerId, n: number): { s: WhotState; drawn: number } {
  let market = [...s.market];
  let pile = [...s.pile];
  let cursor = s.rngCursor;
  const log = [...s.log];
  const hand = [...s.hands[who]!];
  let drawn = 0;
  let reshuffles = s.finish?.reshuffles ?? 0;
  for (let i = 0; i < n; i++) {
    // Market finish mode refills the market only once.
    if (market.length === 0 && pile.length > 1 && !(finishOn(s) && reshuffles >= 1)) {
      const rng = makeRng(s.seed, cursor);
      market = shuffle(pile.slice(0, -1), rng);
      cursor = rng.cursor();
      pile = pile.slice(-1);
      log.push({ by: null, kind: "reshuffle" });
      reshuffles++;
    }
    const card = market.pop();
    if (!card) break;
    hand.push(card);
    drawn++;
  }
  return {
    s: { ...s, market, pile, rngCursor: cursor, log, hands: { ...s.hands, [who]: hand }, marketDry: drawn < n, ...(s.finish ? { finish: { ...s.finish, reshuffles } } : {}) },
    drawn,
  };
}

/** Ends the game on a count: the market couldn't cover a draw, or (market finish) the second market ran out. */
function settleDry(s: WhotState): WhotState {
  if (s.winner) return s;
  const finished = finishOn(s) && s.finish!.reshuffles >= 1 && s.market.length === 0;
  if (!s.marketDry && !finished) return s;
  const [a, b] = s.players;
  const va = handValue(s.hands[a]!, finishOn(s));
  const vb = handValue(s.hands[b]!, finishOn(s));
  return { ...s, winner: va === vb ? "tie" : va < vb ? a : b };
}

const trimLog = (log: LogEntry[]) => log.slice(-12);

export const whot: GameLogic<WhotState, WhotMove, WhotView, WhotConfig> = {
  id: "whot",
  category: "competitive",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 12,
  moveSchema,
  configSchema: configSchema as unknown as z.ZodType<WhotConfig>,
  rematchKeeps: ["marketFinish"],
  rules: {
    summary: "Match the card on top by shape or by number. First to empty their hand wins.",
    sections: [
      { title: "Your turn", body: ["Play one card that matches the top card's shape or number.", "Can't (or won't)? Go to market and draw one. Your turn ends."] },
      {
        title: "Special cards",
        body: [
          "1, Hold On: play again.",
          "2, Pick Two: your partner draws two.",
          "5, Pick Three: your partner draws three.",
          "8, Suspension: your partner misses a turn, so you play again.",
          "14, General Market: your partner draws one from the market.",
          "20, Whot: wild. Play it on anything and call the shape your partner must follow.",
        ],
      },
      { title: "House rules", body: ["Stacking picks, who moves after General Market, calling 'Last card' and hand size can all be changed in room settings."] },
      { title: "If the market runs dry", body: ["Hands are counted. Lowest total wins: stars count double, Whot counts 20."] },
      {
        title: "Market finish mode",
        body: [
          "Choose it when you start. The first time the market runs out, the played cards are shuffled into a new market.",
          "When the second market is nearly gone you'll get a warning. When it runs out, the game ends: both hands are counted at face value (Whot is 20) and the lowest total wins. Equal totals are a draw.",
        ],
      },
    ],
  },

  initialState(seed, players, config) {
    const rules = whotRulesSchema.parse(config);
    const marketFinish = config.marketFinish === true;
    const rng = makeRng(seed);
    const deck = shuffle(buildDeck(), rng);
    const hands: Record<PlayerId, Card[]> = { [players[0]]: [], [players[1]]: [] };
    for (let i = 0; i < rules.handSize; i++) for (const p of players) hands[p]!.push(deck.pop()!);
    // Opening card must be a plain number; specials go back under the market.
    let opener = deck.pop()!;
    while (isSpecial(opener)) {
      deck.unshift(opener);
      opener = deck.pop()!;
    }
    const first = config.firstPlayer ?? (rng.int(2) as 0 | 1);
    return {
      players,
      seed,
      rngCursor: rng.cursor(),
      rules,
      hands,
      market: deck,
      pile: [opener],
      turn: first,
      firstTurn: first,
      pendingPick: 0,
      pendingKind: null,
      requested: null,
      log: [],
      marketDry: false,
      finish: { on: marketFinish, reshuffles: 0 },
      winner: null,
    };
  },

  validateMove(s, move, by) {
    if (s.winner || s.players[s.turn] !== by) return false;
    if (move.type === "draw") return true;
    const card = s.hands[by]!.find((c) => c.id === move.cardId);
    if (!card || !canPlay(s, card)) return false;
    if (card.shape === "whot" && !move.shape) return false;
    return true;
  },

  applyMove(s, move, by) {
    const me = s.turn;
    const opp = s.players[other(me)];

    if (move.type === "draw") {
      const owed = s.pendingPick > 0 ? s.pendingPick : 1;
      const { s: next, drawn } = draw(s, by, owed);
      return settleDry({
        ...next,
        pendingPick: 0,
        pendingKind: null,
        turn: other(me),
        log: trimLog([...next.log, { by, kind: "draw", count: drawn, reason: s.pendingPick > 0 ? "pick" : "market" }]),
      });
    }

    const card = s.hands[by]!.find((c) => c.id === move.cardId)!;
    const hand = s.hands[by]!.filter((c) => c.id !== card.id);
    let next: WhotState = {
      ...s,
      hands: { ...s.hands, [by]: hand },
      pile: [...s.pile, card],
      requested: card.shape === "whot" ? move.shape! : null,
      log: [...s.log, { by, kind: "play", card, ...(card.shape === "whot" ? { called: move.shape } : {}) }],
    };

    if (hand.length === 0) return { ...next, winner: by, log: trimLog(next.log) };

    if (s.rules.announceLastCard && hand.length === 1) {
      if (move.lastCard) next = { ...next, log: [...next.log, { by, kind: "lastCard" }] };
      else {
        const r = draw(next, by, 2);
        next = { ...r.s, log: [...r.s.log, { by, kind: "draw", count: r.drawn, reason: "penalty" }] };
      }
    }

    let turn: 0 | 1 = other(me);
    switch (card.n) {
      case SPECIAL.holdOn:
      case SPECIAL.suspension:
        turn = me;
        break;
      case SPECIAL.pickTwo:
        next = { ...next, pendingPick: s.pendingPick + 2, pendingKind: 2 };
        break;
      case SPECIAL.pickThree:
        next = { ...next, pendingPick: s.pendingPick + 3, pendingKind: 5 };
        break;
      case SPECIAL.generalMarket: {
        const r = draw(next, opp, 1);
        next = { ...r.s, log: [...r.s.log, { by: opp, kind: "draw", count: r.drawn, reason: "general" }] };
        if (s.rules.generalMarketHold) turn = me;
        break;
      }
    }
    if (card.n !== SPECIAL.pickTwo && card.n !== SPECIAL.pickThree) next = { ...next, pendingPick: 0, pendingKind: null };

    return settleDry({ ...next, turn, log: trimLog(next.log) });
  },

  isOver(s): Outcome {
    return s.winner ? { over: true, winner: s.winner } : { over: false };
  },

  viewFor(s, player) {
    const opp = s.players[0] === player ? s.players[1] : s.players[0];
    const hand = s.hands[player] ?? [];
    const myTurn = s.players[s.turn] === player && !s.winner;
    return {
      players: s.players,
      me: player,
      hand,
      playable: myTurn ? hand.filter((c) => canPlay(s, c)).map((c) => c.id) : [],
      opponentCount: s.hands[opp]?.length ?? 0,
      top: top(s),
      marketCount: s.market.length,
      turn: s.players[s.turn],
      pendingPick: s.pendingPick,
      pendingKind: s.pendingKind,
      requested: s.requested,
      log: s.log,
      rules: s.rules,
      winner: s.winner,
      finalHands: s.winner ? s.hands : null,
      endedBy: !s.winner ? null : s.winner !== "tie" && s.hands[s.winner]!.length === 0 ? "out" : "count",
      tally: s.winner && (s.winner === "tie" || s.hands[s.winner]!.length > 0) ? Object.fromEntries(s.players.map((p) => [p, handValue(s.hands[p]!, finishOn(s))])) : null,
      finish: finishOn(s)
        ? { market: s.finish!.reshuffles >= 1 ? 2 : 1, warn: !s.winner && s.finish!.reshuffles >= 1 && s.market.length <= FINISH_WARN_AT }
        : null,
    };
  },
};
