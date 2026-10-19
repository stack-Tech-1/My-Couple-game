"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Dice } from "@/design/Dice";
import { Button } from "@/design/Button";
import { Status } from "@/games/_ui";
import { HOME, LAST_TRACK, SAFE, START, YARD, absolute, type LudoMove, type LudoView } from "./logic";

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
const HOME_COL: [Pt[], Pt[]] = [[1, 2, 3, 4, 5].map((c): Pt => [c, 7]), [13, 12, 11, 10, 9].map((c): Pt => [c, 7])];
const HOME_SPOT: [Pt, Pt] = [[6.15, 7], [7.85, 7]];
const YARD_SPOTS: [Pt[], Pt[]] = [
  [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
];

const COLORS = [
  { fill: "#e8563a", rim: "#a8361f", tint: "rgba(232,86,58,.16)", name: "ember" },
  { fill: "#5b1a2b", rim: "#2a0b14", tint: "rgba(91,26,43,.14)", name: "wine" },
] as const;

function cellOf(seat: 0 | 1, rel: number, token: number): Pt {
  if (rel === YARD) return YARD_SPOTS[seat][token]!;
  if (rel === HOME) return HOME_SPOT[seat];
  if (rel > LAST_TRACK) return HOME_COL[seat][rel - LAST_TRACK - 1]!;
  return TRACK[absolute(seat, rel)]!;
}
const center = ([c, r]: Pt): Pt => [(c + 0.5) * S, (r + 0.5) * S];

/** The squares a token passes through, so it hops instead of teleporting. */
function pathBetween(seat: 0 | 1, from: number, to: number, token: number): Pt[] {
  if (to === YARD || from === YARD || to <= from) return [center(cellOf(seat, to, token))];
  const pts: Pt[] = [];
  for (let r = from + 1; r <= to; r++) pts.push(center(cellOf(seat, r, token)));
  return pts;
}

export function LudoBoard({ view, me, names, sendMove, pending, sound }: GameProps<LudoView, LudoMove>) {
  const mySeat: 0 | 1 = view.players[0] === me ? 0 : 1;
  const myTurn = view.players[view.turn] === me && !view.winner;
  const partner = view.players[mySeat === 0 ? 1 : 0];
  const partnerName = names[partner] ?? "Your partner";
  const legal = new Set(view.legal);
  const last = view.last;

  const roll = () => {
    if (!myTurn || view.phase !== "roll" || pending) return;
    sound("roll");
    void sendMove({ type: "roll" });
  };
  const move = (t: number) => {
    if (!legal.has(t) || pending) return;
    sound("tap");
    void sendMove({ type: "move", token: t });
  };

  const whoName = (p: string) => (p === me ? "You" : (names[p] ?? "They"));
  let detail = "";
  if (last?.kind === "roll") {
    detail = last.forfeited
      ? `${whoName(last.by)} rolled a third six. Turn over.`
      : last.noMoves
        ? `${whoName(last.by)} rolled ${last.value}. Nothing could move.`
        : `${whoName(last.by)} rolled ${last.value}.`;
  } else if (last?.kind === "move") {
    detail = last.captured?.length
      ? last.by === me
        ? `Captured! Back to the yard with it.`
        : `${partnerName} sent your token home. Rude.`
      : last.to === HOME
        ? `${whoName(last.by)} got a token home.`
        : `${whoName(last.by)} moved ${last.to - Math.max(last.from, 0)} squares.`;
  }

  const status = view.winner
    ? view.winner === me
      ? "All four home. You win."
      : `${partnerName} got all four home.`
    : myTurn
      ? view.phase === "roll"
        ? "Roll the die."
        : `Pick a token to move ${view.dice}.`
      : `${partnerName}'s turn…`;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between text-[0.88rem]">
        {view.players.map((p, seat) => (
          <span key={p} className="flex items-center gap-2 font-semibold" style={{ opacity: view.players[view.turn] === p ? 1 : 0.55 }}>
            <span className="h-4 w-4 rounded-full" style={{ background: COLORS[seat as 0 | 1].fill, boxShadow: `inset 0 -2px 0 ${COLORS[seat as 0 | 1].rim}` }} aria-hidden />
            {p === me ? "You" : names[p]} · {view.tokens[p]!.filter((r) => r === HOME).length}/4 home
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${15 * S} ${15 * S}`} className="w-full touch-manipulation select-none" role="group" aria-label={`Ludo board. ${status}`}>
        <rect x={0} y={0} width={15 * S} height={15 * S} rx={18} fill="var(--bg-raised)" stroke="var(--line-strong)" strokeWidth={2} />
        {/* yards */}
        {(
          [
            [0, 0, COLORS[0].tint],
            [9, 0, null],
            [0, 9, null],
            [9, 9, COLORS[1].tint],
          ] as const
        ).map(([c, r, tint]) => (
          <g key={`${c}${r}`}>
            <rect x={c * S + 4} y={r * S + 4} width={6 * S - 8} height={6 * S - 8} rx={14} fill={tint ?? "var(--bg-sunk)"} stroke="var(--line)" strokeWidth={1.5} />
            <rect x={c * S + S} y={r * S + S} width={4 * S} height={4 * S} rx={10} fill="var(--bg-raised)" stroke="var(--line)" strokeWidth={1.5} strokeDasharray={tint ? undefined : "4 6"} />
          </g>
        ))}
        {/* track */}
        {TRACK.map(([c, r], i) => {
          const startSeat = i === START[0] ? 0 : i === START[1] ? 1 : null;
          return (
            <g key={i}>
              <rect x={c * S + 1} y={r * S + 1} width={S - 2} height={S - 2} rx={4} fill={startSeat !== null ? COLORS[startSeat].tint : "var(--bg-raised)"} stroke="var(--line)" strokeWidth={1.2} />
              {SAFE.has(i) && startSeat === null ? (
                <path transform={`translate(${c * S + S / 2} ${r * S + S / 2}) scale(.42)`} d="m0-20 5.9 12 13.1 1.9-9.5 9.3 2.2 13.1L0 10.1l-11.7 6.2 2.2-13.1L-19-6.1-5.9-8z" fill="none" stroke="var(--brass)" strokeWidth={3} />
              ) : null}
            </g>
          );
        })}
        {/* home columns */}
        {HOME_COL.map((col, seat) =>
          col.map(([c, r], i) => <rect key={`${seat}-${i}`} x={c * S + 1} y={r * S + 1} width={S - 2} height={S - 2} rx={4} fill={COLORS[seat as 0 | 1].fill} opacity={0.22 + i * 0.1} />),
        )}
        {/* centre */}
        <g>
          <path d={`M${6 * S} ${6 * S}L${7.5 * S} ${7.5 * S}L${6 * S} ${9 * S}Z`} fill={COLORS[0].fill} opacity={0.75} />
          <path d={`M${9 * S} ${6 * S}L${7.5 * S} ${7.5 * S}L${9 * S} ${9 * S}Z`} fill={COLORS[1].fill} opacity={0.75} />
          <path d={`M${6 * S} ${6 * S}L${7.5 * S} ${7.5 * S}L${9 * S} ${6 * S}Z`} fill="var(--bg-sunk)" />
          <path d={`M${6 * S} ${9 * S}L${7.5 * S} ${7.5 * S}L${9 * S} ${9 * S}Z`} fill="var(--bg-sunk)" />
          <rect x={6 * S} y={6 * S} width={3 * S} height={3 * S} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} />
        </g>

        {/* tokens */}
        {view.players.map((p, seat) =>
          view.tokens[p]!.map((rel, t) => (
            <Token
              key={`${p}-${t}`}
              seat={seat as 0 | 1}
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
        <Dice value={view.dice ?? 1} rollId={view.rollId} size={64} tone={view.turn === mySeat ? "ember" : "paper"} label={view.dice ? `Die shows ${view.dice}` : "Die"} />
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

function Token({ seat, token, rel, stackIndex, legal, onPick, label }: { seat: 0 | 1; token: number; rel: number; stackIndex: number; legal: boolean; onPick: () => void; label: string }) {
  const reduce = useReducedMotion();
  const prev = useRef(rel);
  const [cx, cy] = center(cellOf(seat, rel, token));
  const offset = stackIndex * 6;
  const path = reduce ? [[cx, cy] as Pt] : pathBetween(seat, prev.current, rel, token);
  useEffect(() => {
    prev.current = rel;
  }, [rel]);

  const color = COLORS[seat];
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
