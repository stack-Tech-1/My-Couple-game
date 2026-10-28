"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/design/Button";
import type { GameProps, PlayerId } from "@/games/_engine/types";
import { TimerBar, useCountdown, useTickAtDeadline } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { buildCost, DECIDE_MS, HOODS, naira, OWAMBE, rentFor, ROLL_MS, SPACES, street, type NlMove, type NlView, type Space } from "./logic";

export const SEAT_COLORS = ["#e8563a", "#3f6f8f", "#3f9a5c", "#c9a227"];

/** The 20 spaces sit round the edge of a 6 by 6 grid, starting bottom right and going clockwise. */
function cellOf(i: number): { row: number; col: number } {
  if (i <= 5) return { row: 5, col: 5 - i };
  if (i <= 9) return { row: 5 - (i - 5), col: 0 };
  if (i <= 15) return { row: 0, col: i - 10 };
  return { row: i - 15, col: 5 };
}

const SPECIAL: Record<Exclude<Space["kind"], "street">, { label: string; icon: string }> = {
  payday: { label: "Alaba Payday", icon: "₦" },
  card: { label: "Lagos Life", icon: "?" },
  danfo: { label: "Danfo", icon: "⇄" },
  lastma: { label: "LASTMA", icon: "!" },
  goslow: { label: "Go-slow", icon: "≈" },
  owambe: { label: "Owambe", icon: "♫" },
};

export function NaijaLandlordBoard({ view, me, names, sendMove, pending, sound, clock }: GameProps<NlView, NlMove>) {
  const reduce = useReducedMotion();
  const current = view.players[view.turn]!;
  const myTurn = !view.winner && current === me;
  const name = useCallback((p: PlayerId) => (p === me ? "You" : (names[p] ?? "Someone")), [me, names]);
  const color = (p: PlayerId) => SEAT_COLORS[view.players.indexOf(p)] ?? "#888";
  const left = useCountdown(view.winner ? null : view.deadline, clock);
  const total = view.phase === "roll" ? ROLL_MS : DECIDE_MS;

  useTickAtDeadline(
    view.winner || !view.awake.includes(current) ? null : view.deadline,
    clock,
    useCallback(() => void sendMove({ kind: "tick" }, { silent: true }), [sendMove]),
  );

  // A sound for things that happen to you while you watch.
  const lastId = useRef(view.seq);
  useEffect(() => {
    if (view.seq === lastId.current) return;
    lastId.current = view.seq;
    const e = view.events[view.events.length - 1];
    if (!e) return;
    if (e.text.startsWith("rolled")) sound("roll");
    else if (e.tone === "card") sound("flip");
  }, [view.seq, view.events, sound]);

  const send = (move: NlMove) => {
    sound(move.kind === "roll" ? "roll" : "tap");
    void sendMove(move);
  };

  const fill = (text: string) => text.replace(/@([\w-]+)/g, (_, id: string) => (id === me ? "you" : (names[id] ?? "someone")));
  const latest = view.events[view.events.length - 1];
  const stamp = latest?.text.includes("Na your own now");

  const status = view.winner
    ? view.winner === "tie"
      ? "Dead level. Nobody owns Lagos today."
      : view.winner === me
        ? view.reason === "target"
          ? "You hit the target. Landlord of Lagos!"
          : "You're the richest landlord."
        : `${names[view.winner] ?? "Someone"} wins.`
    : myTurn
      ? view.phase === "decide"
        ? "Your call."
        : view.rolls > 0
          ? "Doubles! Roll again."
          : "Your turn. Roll."
      : `${names[current] ?? "Someone"}'s turn…`;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center">
      <div className="mb-2 flex w-full items-center justify-between text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>
          Round {Math.min(view.round, view.rounds)} of {view.rounds}
        </span>
        <span>First to {naira(view.target)}</span>
      </div>

      <div
        data-tour="nl-board"
        role="grid"
        aria-label={`Naija Landlord board. ${status}`}
        className="relative grid w-full grid-cols-6 grid-rows-6 gap-[3px] rounded-[16px] border-[2px] border-[#2a0b14] bg-[#2a0b14] p-[3px]"
      >
        {SPACES.map((sp, i) => {
          const { row, col } = cellOf(i);
          const owner = view.owner[i] ?? null;
          const here = view.players.filter((p) => !view.out.includes(p) && view.pos[p] === i);
          const buildHere = myTurn && view.canBuild.includes(i);
          return (
            <div
              key={i}
              role="gridcell"
              aria-label={spaceLabel(sp, i, view, name)}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              className={cn(
                "relative flex aspect-square flex-col overflow-hidden rounded-[7px] bg-[#fbf3e6] text-[#1c1416]",
                buildHere && "animate-pulse",
              )}
            >
              {owner ? <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[7px]" style={{ boxShadow: `inset 0 0 0 2.5px ${color(owner)}` }} /> : null}
              {sp.kind === "street" ? (
                <>
                  <span aria-hidden className="h-[18%] w-full shrink-0" style={{ background: HOODS[sp.hood].color }} />
                  <span className="px-[3px] pt-[2px] text-[clamp(0.42rem,1.9vw,0.62rem)] font-bold leading-[1.05]">{sp.name}</span>
                  <span className="mt-auto flex items-end justify-between px-[3px] pb-[2px] text-[clamp(0.42rem,1.8vw,0.6rem)] tabular text-[#6b5a55]">
                    {naira(sp.price)}
                    <Buildings n={view.level[i] ?? 0} />
                  </span>
                </>
              ) : (
                <span className="flex h-full flex-col items-center justify-center text-center">
                  <span aria-hidden className="text-[clamp(0.8rem,4vw,1.2rem)] font-bold leading-none text-[#5b1a2b]">
                    {SPECIAL[sp.kind].icon}
                  </span>
                  <span className="mt-[2px] px-[2px] text-[clamp(0.42rem,1.8vw,0.6rem)] font-bold leading-[1.05]">{SPECIAL[sp.kind].label}</span>
                </span>
              )}
              {here.length ? (
                <span className="absolute right-[3px] top-[24%] flex flex-col gap-[2px]">
                  {here.map((p) => (
                    <motion.span
                      key={p}
                      layoutId={reduce ? undefined : `nl-token-${p}`}
                      transition={{ type: "spring", stiffness: 260, damping: 26 }}
                      aria-hidden
                      className="h-[clamp(9px,3.2vw,15px)] w-[clamp(9px,3.2vw,15px)] rounded-full border-[2px] border-white shadow-[0_1px_2px_rgba(0,0,0,.4)]"
                      style={{ background: color(p) }}
                    />
                  ))}
                </span>
              ) : null}
            </div>
          );
        })}

        {/* The middle of the board: dice, what just happened, the clock. */}
        <div style={{ gridRow: "2 / span 4", gridColumn: "2 / span 4" }} className="relative flex flex-col items-center justify-center gap-2 rounded-[10px] bg-[#5b1a2b] p-2 text-center text-[#fbf3e6]">
          <p className="display text-[clamp(0.95rem,4.2vw,1.35rem)] leading-tight" aria-live="polite">
            {status}
          </p>
          <div className="flex gap-2">
            <Die value={view.dice?.[0] ?? null} spin={view.rollId} reduce={!!reduce} />
            <Die value={view.dice?.[1] ?? null} spin={view.rollId * 7} reduce={!!reduce} />
          </div>
          {latest ? (
            <p className="line-clamp-3 max-w-full text-[clamp(0.62rem,2.6vw,0.8rem)] leading-snug opacity-90">
              <strong>{name(latest.by)}</strong> {fill(latest.text)}
            </p>
          ) : (
            <p className="text-[clamp(0.62rem,2.6vw,0.8rem)] opacity-80">Everyone has ₦1.5M and one free street. Go!</p>
          )}
          {!view.winner ? <TimerBar left={left} total={total} className="max-w-[70%] bg-[rgba(255,255,255,.2)]" /> : null}
          <AnimatePresence>
            {stamp ? (
              <motion.span
                key={latest!.id}
                initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -18 }}
                animate={{ scale: 1, opacity: 1, rotate: -12 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                aria-hidden
                className="pointer-events-none absolute right-[6%] top-[6%] rounded-[6px] border-[3px] border-[#e8563a] px-2 py-[1px] text-[clamp(0.6rem,2.6vw,0.85rem)] font-black uppercase tracking-[0.08em] text-[#e8563a]"
              >
                Sold
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div data-tour="nl-actions" className="mt-4 flex min-h-12 w-full flex-col items-center gap-2">
        {myTurn ? <Actions view={view} send={send} pending={pending} names={names} /> : null}
      </div>

      <ul data-tour="nl-players" className="mt-3 w-full divide-y divide-line rounded-[16px] border border-line bg-raised">
        {view.players.map((p) => {
          const streets = view.owner.filter((o) => o === p).length;
          const out = view.out.includes(p);
          return (
            <li key={p} className={cn("flex items-center gap-3 px-3 py-2", out && "opacity-45", p === current && !view.winner && "bg-sunk")}>
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: color(p) }} />
              <span className="min-w-0 flex-1 truncate text-[0.9rem] font-semibold">
                {names[p] ?? "Player"}
                {p === me ? <span className="text-muted"> (you)</span> : null}
                {out ? <span className="text-muted"> · broke</span> : null}
              </span>
              <span className="text-right text-[0.78rem] leading-tight text-muted">
                <span className="tabular block text-[0.92rem] font-semibold text-fg">{naira(view.cash[p] ?? 0)}</span>
                {streets} {streets === 1 ? "street" : "streets"} · worth {naira(view.worth[p] ?? 0)}
              </span>
            </li>
          );
        })}
      </ul>

      {view.events.length > 1 ? (
        <ol aria-label="What happened" className="mt-3 w-full space-y-1 text-[0.8rem] text-muted">
          {[...view.events]
            .reverse()
            .slice(1, 7)
            .map((e) => (
              <li key={e.id} className={cn(e.tone === "card" && "text-fg")}>
                <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color(e.by) }} />
                <strong className="font-semibold text-fg">{name(e.by)}</strong> {fill(e.text)}
              </li>
            ))}
        </ol>
      ) : null}
    </div>
  );
}

function Actions({ view, send, pending, names }: { view: NlView; send: (m: NlMove) => void; pending: boolean; names: Record<PlayerId, string> }) {
  const q = view.decision;
  if (view.phase === "decide" && q) {
    const yes = () => send({ kind: "answer", yes: true });
    const no = () => send({ kind: "answer", yes: false });
    switch (q.kind) {
      case "buy":
        return (
          <Choice text={`${street(q.sq)!.name} is for sale. Rent ${naira(street(q.sq)!.rent)}, double with ${HOODS[street(q.sq)!.hood].name} complete.`}>
            <Button onClick={yes} disabled={pending}>
              Buy for {naira(q.price)}
            </Button>
            <Button variant="ghost" onClick={no} disabled={pending}>
              Pass
            </Button>
          </Choice>
        );
      case "buyout":
        return (
          <Choice text={`You own the other street in ${HOODS[street(q.sq)!.hood].name}. Buy ${street(q.sq)!.name} from ${names[q.owner] ?? "them"}, or pay the rent.`}>
            <Button onClick={yes} disabled={pending}>
              Buy out for {naira(q.price)}
            </Button>
            <Button variant="ghost" onClick={no} disabled={pending}>
              Pay {naira(q.rent)} rent
            </Button>
          </Choice>
        );
      case "owambe":
        return (
          <Choice text={`Owambe! You're the celebrant. Host big: everyone pays you ${naira(OWAMBE.big.each)}, the party costs ${naira(OWAMBE.big.cost)}. Small chops: everyone pays ${naira(OWAMBE.small.each)}.`}>
            <Button onClick={yes} disabled={pending}>
              Host big
            </Button>
            <Button variant="outline" onClick={no} disabled={pending}>
              Small chops
            </Button>
          </Choice>
        );
      case "onile":
        return (
          <Choice text="Omo onile showed up at your site.">
            <Button onClick={yes} disabled={pending}>
              Pay {naira(50)}
            </Button>
            <Button variant="ghost" onClick={no} disabled={pending}>
              Lose next roll
            </Button>
          </Choice>
        );
    }
  }
  return (
    <>
      <Button size="lg" onClick={() => send({ kind: "roll" })} disabled={pending} className="min-w-40">
        Roll
      </Button>
      {view.canBuild.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {view.canBuild.map((sq) => (
            <Button key={sq} size="sm" variant="outline" onClick={() => send({ kind: "build", sq })} disabled={pending}>
              Build {view.level[sq] === 0 ? "flats" : "an estate"} on {street(sq)!.name} ({naira(buildCost(sq))})
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Choice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="w-full rounded-[16px] border border-line bg-raised p-3 text-center">
      <p className="mb-3 text-[0.9rem]">{text}</p>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

function Buildings({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span aria-hidden className="flex gap-[1px]">
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 10 10" className={n === 2 ? "h-[9px] w-[9px] fill-[#e8563a]" : "h-[9px] w-[9px] fill-[#3f9a5c]"}>
          <path d="M1 9V4.5L5 1l4 3.5V9z" />
        </svg>
      ))}
    </span>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

function Die({ value, spin, reduce }: { value: number | null; spin: number; reduce: boolean }) {
  return (
    <motion.svg
      key={spin}
      viewBox="0 0 100 100"
      initial={reduce || !value ? false : { rotate: -200, scale: 0.6 }}
      animate={{ rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 16 }}
      className="h-[clamp(30px,10vw,46px)] w-[clamp(30px,10vw,46px)]"
      role="img"
      aria-label={value ? `Die: ${value}` : "Die"}
    >
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#fbf3e6" />
      {(value ? PIPS[value]! : []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="#1c1416" />
      ))}
    </motion.svg>
  );
}

function spaceLabel(sp: Space, i: number, view: NlView, name: (p: PlayerId) => string) {
  const here = view.players.filter((p) => !view.out.includes(p) && view.pos[p] === i).map(name);
  const who = here.length ? `. Here: ${here.join(", ")}` : "";
  if (sp.kind !== "street") return `${SPECIAL[sp.kind].label}${who}`;
  const owner = view.owner[i];
  const lv = view.level[i] ?? 0;
  const owned = owner ? `, owned by ${name(owner)}${lv ? `, ${lv === 1 ? "flats" : "estate"}` : ""}, rent ${naira(rentFor(view, i))}` : `, for sale at ${naira(sp.price)}`;
  return `${sp.name}, ${HOODS[sp.hood].name}${owned}${who}`;
}
