"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Dice } from "@/design/Dice";
import { Button } from "@/design/Button";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { HOME, LAST_TRACK, SAFE, YARD, absoluteFor, colourOf, colourStart, type DieUse, type LudoMove, type LudoView } from "./logic";

const S = 40; // cell size in the 15x15 SVG
type Pt = [number, number];

/** The 52-square loop as [col,row], starting at seat 0's start square and running clockwise. */
const TRACK: Pt[] = [
  ...[1, 2, 3, 4, 5].map((c): Pt => [c, 6]),
  ...[5, 4, 3, 2, 1, 0].map((r): Pt => [6, r]),
  [7, 0],
  ...[0, 1, 2, 3, 4, 5].map((r): Pt => [8, r]),
  ...[9, 10, 11, 12, 13, 14].map((c): Pt => [c, 6]),
  [14, 7],
  ...[14, 13, 12, 11, 10, 9].map((c): Pt => [c, 8]),
  ...[9, 10, 11, 12, 13, 14].map((r): Pt => [8, r]),
  [7, 14],
  ...[14, 13, 12, 11, 10, 9].map((r): Pt => [6, r]),
  ...[5, 4, 3, 2, 1, 0].map((c): Pt => [c, 8]),
  [0, 7],
  [0, 6],
];
/** Per colour, clockwise from the top-left corner: home column, home spot, yard spots, yard corner. */
const HOME_COL: Pt[][] = [
  [1, 2, 3, 4, 5].map((c): Pt => [c, 7]),
  [1, 2, 3, 4, 5].map((r): Pt => [7, r]),
  [13, 12, 11, 10, 9].map((c): Pt => [c, 7]),
  [13, 12, 11, 10, 9].map((r): Pt => [7, r]),
];
const HOME_SPOT: Pt[] = [[6.15, 7], [7, 6.15], [7.85, 7], [7, 7.85]];
const YARD_AT: Pt[] = [[0, 0], [9, 0], [9, 9], [0, 9]];
const YARD_SPOTS: Pt[][] = YARD_AT.map(([c, r]) => [[c + 1.5, r + 1.5], [c + 3.5, r + 1.5], [c + 1.5, r + 3.5], [c + 3.5, r + 3.5]]);

/** Colour 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left. Two players use 0 and 2. */
const COLORS = [
  { fill: "#e8563a", rim: "#a8361f", tint: "rgba(232,86,58,.16)", name: "ember" },
  { fill: "#3f7a5e", rim: "#234a38", tint: "rgba(63,122,94,.16)", name: "sage" },
  { fill: "#5b1a2b", rim: "#2a0b14", tint: "rgba(91,26,43,.14)", name: "wine" },
  { fill: "#c98d1f", rim: "#8a5f12", tint: "rgba(201,141,31,.18)", name: "brass" },
] as const;

function cellOf(colour: number, rel: number, token: number): Pt {
  if (rel === YARD) return YARD_SPOTS[colour]![token]!;
  if (rel === HOME) return HOME_SPOT[colour]!;
  if (rel > LAST_TRACK) return HOME_COL[colour]![rel - LAST_TRACK - 1]!;
  return TRACK[absoluteFor(colour, rel)]!;
}
const center = ([c, r]: Pt): Pt => [(c + 0.5) * S, (r + 0.5) * S];

/** The squares a token passes through, so it hops instead of teleporting. */
function pathBetween(colour: number, from: number, to: number, token: number): Pt[] {
  if (to === YARD || from === YARD || to <= from) return [center(cellOf(colour, to, token))];
  const pts: Pt[] = [];
  for (let r = from + 1; r <= to; r++) pts.push(center(cellOf(colour, r, token)));
  return pts;
}

export function LudoBoard({ view, me, names, sendMove, pending, sound }: GameProps<LudoView, LudoMove>) {
  const mySeat = view.players.indexOf(me);
  const myTurn = view.players[view.turn] === me && !view.winner;
  const nameOf = (p: string) => names[p] ?? "Someone";
  // Colours in play, by seat; the board only lights up the corners in use.
  const colours = view.players.map((_, seat) => colourOf(view, seat));
  const inPlay = new Set(colours);
  const last = view.last;

  // Two dice: pick a die (or both), then a token. Defaults to the first choice that can move.
  const two = !!view.rules.twoDice;
  const options = view.options ?? [];
  const left = view.left ?? [];
  const [pick, setPick] = useState<DieUse | null>(null);
  const usable = (u: DieUse) => options.some((o) => o.use === u);
  const chosen: DieUse | null = two ? (pick !== null && usable(pick) ? pick : (options[0]?.use ?? null)) : null;
  const amount = (u: DieUse | null) => (u === null ? null : u === "both" ? left[0]! + left[1]! : left[u]);
  const legal = new Set(two ? options.filter((o) => o.use === chosen).map((o) => o.token) : view.legal);

  const roll = () => {
    if (!myTurn || view.phase !== "roll" || pending) return;
    sound("roll");
    void sendMove({ type: "roll" });
  };
  const move = (t: number) => {
    if (!legal.has(t) || pending) return;
    sound("tap");
    setPick(null);
    void sendMove(two && chosen !== null ? { type: "move", token: t, use: chosen } : { type: "move", token: t });
  };

  const whoName = (p: string) => (p === me ? "You" : (names[p] ?? "They"));
  let detail = "";
  if (last?.kind === "roll") {
    const rolled = last.pair ? `${last.pair[0]} and ${last.pair[1]}` : `${last.value}`;
    detail = last.forfeited
      ? `${whoName(last.by)} rolled a third ${last.pair ? "double " : ""}six. Turn over.`
      : last.noMoves
        ? `${whoName(last.by)} rolled ${rolled}. Nothing could move.`
        : `${whoName(last.by)} rolled ${rolled}.`;
  } else if (last?.kind === "move") {
    detail = last.captured?.length
      ? last.by === me
        ? `Captured! Back to the yard with it.`
        : last.captured.some((c) => c.owner === me)
          ? `${nameOf(last.by)} sent your token home. Rude.`
          : `${nameOf(last.by)} captured ${last.captured.map((c) => nameOf(c.owner)).join(" and ")}.`
      : last.to === HOME
        ? `${whoName(last.by)} got a token home.`
        : `${whoName(last.by)} moved ${last.to - Math.max(last.from, 0)} squares.`;
  }

  const status = view.winner
    ? view.winner === me
      ? "All four home. You win."
      : `${nameOf(view.winner)} got all four home.`
    : myTurn
      ? view.phase === "roll"
        ? two
          ? "Roll the dice."
          : "Roll the die."
        : `Pick a token to move ${two ? amount(chosen) : view.dice}.`
      : `${nameOf(view.players[view.turn]!)}'s turn…`;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-5">
      <div className={cn("flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.88rem]", view.players.length === 2 && "justify-between")}>
        {view.players.map((p, seat) => (
          <span key={p} className={cn("flex items-center gap-2 font-semibold transition-colors", view.players[view.turn] !== p && "text-muted")}>
            <span className="h-4 w-4 rounded-full" style={{ background: COLORS[colours[seat]!]!.fill, boxShadow: `inset 0 -2px 0 ${COLORS[colours[seat]!]!.rim}` }} aria-hidden />
            {p === me ? "You" : names[p]} · {view.tokens[p]!.filter((r) => r === HOME).length}/4 home
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${15 * S} ${15 * S}`} className="w-full touch-manipulation select-none" role="group" aria-label={`Ludo board. ${status}`}>
        <rect x={0} y={0} width={15 * S} height={15 * S} rx={18} fill="var(--bg-raised)" stroke="var(--line-strong)" strokeWidth={2} />
        {/* yards */}
        {YARD_AT.map(([c, r], colour) => {
          const tint = inPlay.has(colour) ? COLORS[colour]!.tint : null;
          return (
          <g key={`${c}${r}`}>
            <rect x={c * S + 4} y={r * S + 4} width={6 * S - 8} height={6 * S - 8} rx={14} fill={tint ?? "var(--bg-sunk)"} stroke="var(--line)" strokeWidth={1.5} />
            <rect x={c * S + S} y={r * S + S} width={4 * S} height={4 * S} rx={10} fill="var(--bg-raised)" stroke="var(--line)" strokeWidth={1.5} strokeDasharray={tint ? undefined : "4 6"} />
          </g>
          );
        })}
        {/* track */}
        {TRACK.map(([c, r], i) => {
          const startColour = [0, 1, 2, 3].find((k) => inPlay.has(k) && colourStart(k) === i) ?? null;
          return (
            <g key={i}>
              <rect x={c * S + 1} y={r * S + 1} width={S - 2} height={S - 2} rx={4} fill={startColour !== null ? COLORS[startColour]!.tint : "var(--bg-raised)"} stroke="var(--line)" strokeWidth={1.2} />
              {SAFE.has(i) && startColour === null ? (
                <path transform={`translate(${c * S + S / 2} ${r * S + S / 2}) scale(.42)`} d="m0-20 5.9 12 13.1 1.9-9.5 9.3 2.2 13.1L0 10.1l-11.7 6.2 2.2-13.1L-19-6.1-5.9-8z" fill="none" stroke="var(--brass)" strokeWidth={3} />
              ) : null}
            </g>
          );
        })}
        {/* home columns */}
        {HOME_COL.map((col, colour) =>
          inPlay.has(colour) ? col.map(([c, r], i) => <rect key={`${colour}-${i}`} x={c * S + 1} y={r * S + 1} width={S - 2} height={S - 2} rx={4} fill={COLORS[colour]!.fill} opacity={0.22 + i * 0.1} />) : null,
        )}
        {/* centre */}
        <g>
          {[
            `M${6 * S} ${6 * S}L${7.5 * S} ${7.5 * S}L${6 * S} ${9 * S}Z`,
            `M${6 * S} ${6 * S}L${7.5 * S} ${7.5 * S}L${9 * S} ${6 * S}Z`,
            `M${9 * S} ${6 * S}L${7.5 * S} ${7.5 * S}L${9 * S} ${9 * S}Z`,
            `M${6 * S} ${9 * S}L${7.5 * S} ${7.5 * S}L${9 * S} ${9 * S}Z`,
          ].map((d, colour) => (
            <path key={colour} d={d} fill={inPlay.has(colour) ? COLORS[colour]!.fill : "var(--bg-sunk)"} opacity={inPlay.has(colour) ? 0.75 : 1} />
          ))}
          <rect x={6 * S} y={6 * S} width={3 * S} height={3 * S} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} />
        </g>

        {/* tokens */}
        {view.players.map((p, seat) =>
          view.tokens[p]!.map((rel, t) => (
            <Token
              key={`${p}-${t}`}
              colour={colours[seat]!}
              token={t}
              rel={rel}
              stackIndex={view.tokens[p]!.slice(0, t).filter((r) => r === rel && r !== YARD).length}
              legal={p === me && legal.has(t)}
              onPick={() => move(t)}
              label={`${p === me ? "Your" : `${names[p]}'s`} token ${t + 1}, ${rel === YARD ? "in the yard" : rel === HOME ? "home" : `${rel} squares along`}`}
            />
          )),
        )}
      </svg>

      <div className="flex w-full items-center justify-center gap-6">
        {two ? (
          <TwoDice view={view} choosing={myTurn && view.phase === "move" && !pending} chosen={chosen} usable={usable} onChoose={setPick} tone={view.turn === mySeat ? "ember" : "paper"} />
        ) : (
          <Dice value={view.dice ?? 1} rollId={view.rollId} size={64} tone={view.turn === mySeat ? "ember" : "paper"} label={view.dice ? `Die shows ${view.dice}` : "Die"} />
        )}
        <div className="min-w-0 flex-1">
          <Status className="text-left">{status}</Status>
          <p className="mt-1 text-[0.88rem] text-muted" aria-live="polite">{detail}</p>
        </div>
        <Button size="lg" variant="accent" onClick={roll} disabled={!myTurn || view.phase !== "roll" || pending}>
          Roll
        </Button>
      </div>
    </div>
  );
}

/** The pair of dice. On your move, tap a die (or "Both") to choose what to move by; spent dice fade. */
function TwoDice({ view, choosing, chosen, usable, onChoose, tone }: { view: LudoView; choosing: boolean; chosen: DieUse | null; usable: (u: DieUse) => boolean; onChoose: (u: DieUse) => void; tone: "ember" | "paper" }) {
  const pair = view.pair ?? [1, 1];
  const left = view.left ?? [];
  // Which entry of `left` each rolled die is (null once spent). Equal dice: the first one stays.
  const leftIndex = (i: 0 | 1): 0 | 1 | null => {
    if (view.phase !== "move" || left.length === 2) return i;
    if (left.length === 1) return i === (pair[0] === left[0] ? 0 : 1) ? 0 : null;
    return null;
  };
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div className="flex gap-3">
        {([0, 1] as const).map((i) => {
          const li = leftIndex(i);
          const can = choosing && li !== null && usable(li);
          return (
            <button
              key={i}
              type="button"
              disabled={!can}
              aria-pressed={can ? chosen === li : undefined}
              aria-label={`Die ${i + 1} shows ${pair[i]}${li === null ? ", used" : ""}`}
              onClick={() => li !== null && onChoose(li)}
              className={cn("rounded-[14px] p-1 transition-opacity", li === null ? "opacity-30" : choosing && !can && "opacity-60", can && chosen === li && "bg-sunk ring-2 ring-fg")}
            >
              <Dice value={pair[i]} rollId={view.rollId} size={46} tone={tone} />
            </button>
          );
        })}
      </div>
      {choosing && usable("both") ? (
        <button
          type="button"
          aria-pressed={chosen === "both"}
          onClick={() => onChoose("both")}
          className={cn("rounded-full border-[1.5px] px-3 py-0.5 text-[0.8rem] font-semibold", chosen === "both" ? "border-fg bg-sunk" : "border-line text-muted hover:border-line-strong")}
        >
          Both · {left[0]! + left[1]!}
        </button>
      ) : null}
    </div>
  );
}

function Token({ colour, token, rel, stackIndex, legal, onPick, label }: { colour: number; token: number; rel: number; stackIndex: number; legal: boolean; onPick: () => void; label: string }) {
  const reduce = useReducedMotion();
  const prev = useRef(rel);
  const [cx, cy] = center(cellOf(colour, rel, token));
  const offset = stackIndex * 6;
  const path = reduce ? [[cx, cy] as Pt] : pathBetween(colour, prev.current, rel, token);
  useEffect(() => {
    prev.current = rel;
  }, [rel]);

  const color = COLORS[colour]!;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick();
    }
  };

  return (
    <motion.g
      initial={false}
      animate={{ x: path.map(([x]) => x + offset), y: path.map(([, y]) => y - offset) }}
      transition={{ duration: Math.min(0.12 * path.length, 1.2), ease: "linear" }}
      role={legal ? "button" : "img"}
      aria-label={label}
      tabIndex={legal ? 0 : undefined}
      onClick={legal ? onPick : undefined}
      onKeyDown={legal ? onKey : undefined}
      style={{ cursor: legal ? "pointer" : "default", outline: "none" }}
      className="ludo-token"
    >
      {legal ? (
        <motion.circle r={19} fill="none" stroke={color.fill} strokeWidth={3} animate={reduce ? undefined : { r: [16, 20, 16], opacity: [0.9, 0.3, 0.9] }} transition={{ repeat: Infinity, duration: 1.2 }} />
      ) : null}
      <circle r={13} fill={color.fill} stroke={color.rim} strokeWidth={2.5} />
      <circle r={5.5} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={2} />
      {legal ? <circle r={22} fill="transparent" /> : null}
    </motion.g>
  );
}
