"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { PlayingCard, CardBack } from "@/design/PlayingCard";
import { Modal } from "@/design/Modal";
import { Button } from "@/design/Button";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { SHAPES, type Card, type LogEntry, type Shape, type WhotMove, type WhotView } from "./logic";

const INK = "#5b1a2b";

export function ShapeGlyph({ shape, size = 40, color = INK }: { shape: Shape; size?: number; color?: string }) {
  const common = { fill: color };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      {shape === "circle" && <circle cx="20" cy="20" r="15" {...common} />}
      {shape === "triangle" && <path d="M20 4 37 34H3z" {...common} />}
      {shape === "cross" && <path d="M15 4h10v11h11v10H25v11H15V25H4V15h11z" {...common} />}
      {shape === "square" && <rect x="5" y="5" width="30" height="30" rx="2" {...common} />}
      {shape === "star" && <path d="m20 3 5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" {...common} />}
    </svg>
  );
}

const shapeName = (s: Card["shape"]) => (s === "whot" ? "Whot" : s);
export const cardLabel = (c: Card) => (c.shape === "whot" ? "Whot 20" : `${c.n} ${c.shape}`);

export function WhotFace({ card }: { card: Card }) {
  if (card.shape === "whot") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#5b1a2b] text-[#f3d9a6]">
        <span className="absolute left-1.5 top-1 text-[0.8rem] font-extrabold">20</span>
        <span className="display -rotate-12 text-[1.25rem] font-semibold tracking-tight">Whot</span>
        <span className="absolute bottom-1 right-1.5 rotate-180 text-[0.8rem] font-extrabold">20</span>
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <span className="absolute left-1.5 top-1 flex flex-col items-center text-[0.85rem] font-extrabold leading-none" style={{ color: INK }}>
        {card.n}
        <ShapeGlyph shape={card.shape} size={10} />
      </span>
      <ShapeGlyph shape={card.shape} size={38} />
      <span className="absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center text-[0.85rem] font-extrabold leading-none" style={{ color: INK }}>
        {card.n}
        <ShapeGlyph shape={card.shape} size={10} />
      </span>
    </div>
  );
}

function describe(e: LogEntry, me: string, names: Record<string, string>): string {
  if (e.kind === "reshuffle") return "The market ran out, so the pile was reshuffled.";
  const who = e.by === me ? "You" : (names[e.by] ?? "They");
  if (e.kind === "lastCard") return `${who} called last card.`;
  if (e.kind === "generalAll") return `${who} played General Market. Everyone else picked one.`;
  if (e.kind === "draw") {
    const what = e.count === 1 ? "a card" : `${e.count} cards`;
    if (e.reason === "general") return `General market: ${who.toLowerCase() === "you" ? "you" : who} picked ${what}.`;
    if (e.reason === "penalty") return `${who} forgot to call last card, so ${who === "You" ? "you" : "they"} picked ${what}.`;
    if (e.reason === "pick") return `${who} picked ${what}.`;
    return `${who} went to market.`;
  }
  const c = e.card;
  const special: Record<number, string> = { 1: "Hold on!", 2: "Pick two!", 5: "Pick three!", 8: "Suspension!", 14: "General market!" };
  if (c.shape === "whot") return `${who} played Whot and called ${e.called}.`;
  return `${who} played ${cardLabel(c)}. ${special[c.n] ?? ""}`.trim();
}

export function WhotTable({ view, me, names, sendMove, pending, sound }: GameProps<WhotView, WhotMove>) {
  const reduce = useReducedMotion();
  const [pickFor, setPickFor] = useState<Card | null>(null);
  const [lastCard, setLastCard] = useState(false);
  const myTurn = view.turn === me && !view.winner;
  const others = view.players.filter((p) => p !== me);
  const group = others.length > 1;
  const partner = others[0]!;
  const nameOf = (p: string) => (p === me ? "You" : (names[p] ?? "Someone"));
  const partnerName = nameOf(partner);
  // Seats in play order, starting after me.
  const myIndex = view.players.indexOf(me);
  const around = view.players.map((_, k) => view.players[(myIndex + 1 + k) % view.players.length]!).filter((p) => p !== me);
  const playable = useMemo(() => new Set(view.playable), [view.playable]);
  const lastLog = view.log[view.log.length - 1];
  const needsLastCall = view.rules.announceLastCard && myTurn && view.hand.length === 2;

  const play = (card: Card, shape?: Shape) => {
    if (!myTurn || pending) return;
    sound("flip");
    void sendMove({ type: "play", cardId: card.id, ...(shape ? { shape } : {}), ...(needsLastCall && lastCard ? { lastCard: true } : {}) });
    setLastCard(false);
  };

  const counted = view.endedBy === "count";
  const status = view.winner
    ? view.winner === "tie"
      ? "Market's finished, and it's a draw."
      : counted
        ? view.winner === me
          ? "Market's finished. Your hand is lighter: you win."
          : `Market's finished. ${nameOf(view.winner)}'s hand is the lightest.`
        : view.winner === me
          ? "Check up! You're out."
          : `${nameOf(view.winner)} is out. Check up.`
    : myTurn
      ? view.pendingPick > 0
        ? view.rules.stackPicks && view.playable.length
          ? `Pick ${view.pendingPick}, or defend.`
          : `Pick ${view.pendingPick}. Sorry.`
        : view.requested
          ? `They want ${view.requested}.`
          : "Your turn."
      : `${nameOf(view.turn)}'s turn…`;

  return (
    <LayoutGroup>
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6">
        {/* Everyone else's hands (groups): seats in play order, whoever's turn it is lit up */}
        {group ? (
          <ul className="grid grid-cols-3 gap-2" aria-label="Other players">
            {around.map((p) => {
              const n = view.counts[p] ?? 0;
              const theirTurn = view.turn === p && !view.winner;
              return (
                <li key={p} className={cn("flex flex-col items-center gap-1.5 rounded-[16px] border-[1.5px] px-2 py-3", theirTurn ? "border-accent" : "border-line")}>
                  <div className="flex h-[46px] items-end justify-center" role="img" aria-label={`${nameOf(p)} has ${n} cards`}>
                    {Array.from({ length: Math.min(n, 8) }, (_, i) => (
                      <div key={i} className="-mx-[9px] h-[44px] w-[31px] overflow-hidden rounded-[5px] border-[1.5px] border-ink" style={{ rotate: `${(i - (Math.min(n, 8) - 1) / 2) * -4}deg` }}>
                        <CardBack />
                      </div>
                    ))}
                  </div>
                  <p className="max-w-full truncate text-[0.82rem] font-semibold">{nameOf(p)}</p>
                  <p className="text-[0.75rem] text-muted">{n === 1 ? "1 card. Careful." : `${n} cards`}</p>
                </li>
              );
            })}
          </ul>
        ) : null}

        {/* Partner's hand */}
        <div className={cn("flex flex-col items-center gap-2", group && "hidden")}>
          <div className="flex h-[78px] items-end justify-center" aria-label={`${partnerName} has ${view.opponentCount} cards`} role="img">
            {Array.from({ length: Math.min(view.opponentCount, 14) }, (_, i) => {
              const mid = (Math.min(view.opponentCount, 14) - 1) / 2;
              return (
                <motion.div
                  key={i}
                  layout={!reduce}
                  className="-mx-[13px] h-[74px] w-[52px] overflow-hidden rounded-[7px] border-[1.5px] border-ink"
                  style={{ rotate: (i - mid) * -3, y: Math.abs(i - mid) * 2, transformOrigin: "50% 0%" }}
                >
                  <CardBack />
                </motion.div>
              );
            })}
          </div>
          <p className="text-[0.85rem] text-muted">
            <b className="text-fg">{partnerName}</b> · {view.opponentCount} {view.opponentCount === 1 ? "card. Careful." : "cards"}
          </p>
        </div>

        {/* Table centre */}
        <div data-tour="whot-table" className="relative flex items-center justify-center gap-8 rounded-[24px] border border-line bg-[color-mix(in_srgb,var(--sage)_14%,var(--bg-raised))] px-4 py-7">
          <button
            type="button"
            onClick={() => myTurn && !pending && (sound("flip"), void sendMove({ type: "draw" }))}
            disabled={!myTurn || pending}
            aria-label={view.pendingPick > 0 ? `Pick ${view.pendingPick} from the market` : `Go to market, ${view.marketCount} cards left`}
            data-tour="whot-market"
            className="group relative h-[124px] w-[88px] disabled:cursor-default"
          >
            {[2, 1, 0].map((d) => (
              <span key={d} className="absolute inset-0 overflow-hidden rounded-[10px] border-[1.5px] border-ink" style={{ transform: `translate(${d * 3}px, ${-d * 3}px)` }}>
                <CardBack />
              </span>
            ))}
            {myTurn ? (
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-fg px-2.5 py-1 text-[0.72rem] font-bold text-bg transition-transform group-hover:-translate-y-0.5">
                {view.pendingPick > 0 ? `Pick ${view.pendingPick}` : "Market"}
              </span>
            ) : null}
          </button>

          <div className="relative h-[124px] w-[88px]">
            <AnimatePresence initial={false}>
              <motion.div
                key={view.top.id}
                layoutId={reduce ? undefined : `whot-${view.top.id}`}
                initial={reduce ? false : { rotateY: 90, y: -30 }}
                animate={{ rotateY: 0, y: 0, rotate: ((view.top.id * 37) % 14) - 7 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="absolute inset-0 overflow-hidden rounded-[10px] border-[1.5px] border-ink bg-[#fbf7f1] shadow-[0_2px_0_rgba(28,20,22,.35)]"
                role="img"
                aria-label={`Top card: ${cardLabel(view.top)}`}
              >
                <WhotFace card={view.top} />
              </motion.div>
            </AnimatePresence>
            {view.requested ? (
              <span className="absolute -right-4 -top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink bg-bg" aria-label={`Called shape: ${view.requested}`}>
                <ShapeGlyph shape={view.requested} size={22} color="var(--accent)" />
              </span>
            ) : null}
            {view.pendingPick > 0 ? (
              <span className="absolute -left-4 -top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[0.95rem] font-extrabold text-on-accent">+{view.pendingPick}</span>
            ) : null}
          </div>
        </div>

        {view.finish && !view.winner ? (
          <p
            role={view.finish.warn ? "alert" : undefined}
            className={cn(
              "-mt-2 rounded-full px-4 py-1.5 text-center text-[0.85rem] font-semibold",
              view.finish.warn ? "bg-accent text-on-accent" : "border border-line text-muted",
            )}
          >
            {view.finish.warn
              ? `Last market: ${view.marketCount} ${view.marketCount === 1 ? "card" : "cards"} left. When it runs out, hands are counted and the lowest wins.`
              : view.finish.market === 1
                ? "Market finish · first market"
                : "Market finish · second market, the last one"}
          </p>
        ) : null}

        <div className="flex min-h-[3.6rem] flex-col items-center gap-1">
          <Status>{status}</Status>
          {lastLog ? <p className="text-center text-[0.88rem] text-muted">{describe(lastLog, me, names)}</p> : null}
        </div>

        {view.finalHands && view.tally ? (
          <section aria-label="Final count" className="rounded-[18px] border border-line bg-raised p-4">
            <p className="text-center text-[0.85rem] text-muted">
              {view.finish ? "Counted at face value (Whot is 20)." : "Stars count double, Whot is 20."}
              {view.winner === "tie" ? (group ? " The lowest total was shared. A draw." : " Both hands counted the same. Remarkable, honestly.") : " Lowest total wins."}
            </p>
            {[me, ...others].map((p) => (
              <div key={p} className="mt-3">
                <p className="flex justify-between text-[0.9rem] font-semibold">
                  <span>{nameOf(p)}</span>
                  <span className="tabular">{view.tally![p]} points</span>
                </p>
                <p className="text-[0.85rem] text-muted">{view.finalHands![p]!.map(cardLabel).join(", ") || "No cards"}</p>
              </div>
            ))}
          </section>
        ) : null}

        {/* My hand (watchers have none) */}
        <div className={cn(!view.players.includes(me) && "hidden")}>
          {needsLastCall ? (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                aria-pressed={lastCard}
                onClick={() => setLastCard((v) => !v)}
                className={cn("rounded-full border-[1.5px] px-4 py-1.5 text-[0.88rem] font-bold transition-colors", lastCard ? "border-accent bg-accent text-on-accent" : "border-line-strong")}
              >
                {lastCard ? "Last card! (called)" : "Call last card"}
              </button>
            </div>
          ) : null}
          <ul
            className="-mx-4 flex overflow-x-auto px-6 pb-2 pt-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-x-1.5 sm:gap-y-3 sm:overflow-visible sm:px-0 [&>li+li]:-ml-6 sm:[&>li+li]:ml-0 [&>li:first-child]:ml-auto [&>li:last-child]:mr-auto"
            aria-label="Your hand"
            data-tour="whot-hand"
          >
            <AnimatePresence initial={false}>
              {view.hand.map((card) => {
                const ok = playable.has(card.id);
                return (
                  <motion.li key={card.id} layout={!reduce} layoutId={reduce ? undefined : `whot-${card.id}`} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                    <PlayingCard
                      faceUp
                      width={70}
                      front={<WhotFace card={card} />}
                      label={`${cardLabel(card)}${myTurn ? (ok ? ", playable" : ", can't play this now") : ""}`}
                      onClick={myTurn ? () => (card.shape === "whot" ? setPickFor(card) : play(card)) : undefined}
                      disabled={!ok || pending}
                      className={cn("transition-opacity", myTurn && !ok && "opacity-40")}
                    />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          <p className="mt-3 text-center text-[0.82rem] text-muted">{view.hand.length} cards · market {view.marketCount}</p>
        </div>

      </div>

      <Modal open={!!pickFor} onClose={() => setPickFor(null)} title="Call a shape" description={`${partnerName} has to follow it (or play a Whot).`}>
        <div className="grid grid-cols-5 gap-2">
          {SHAPES.map((s) => (
            <Button
              key={s}
              variant="outline"
              className="h-20 flex-col gap-1 rounded-[14px] px-0"
              onClick={() => {
                if (pickFor) play(pickFor, s);
                setPickFor(null);
              }}
              aria-label={`Call ${shapeName(s)}`}
            >
              <ShapeGlyph shape={s} size={28} color="currentColor" />
              <span className="text-[0.72rem] capitalize">{s}</span>
            </Button>
          ))}
        </div>
      </Modal>
    </LayoutGroup>
  );
}
