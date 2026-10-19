"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Scoreline, Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { TO_WIN, type AyoMove, type AyoView } from "./logic";

const SEED_COLORS = ["#3b2a22", "#5c4636", "#e9dcc4", "#7a5a43", "#2a1d17"];

/**
 * Deterministic resting spots inside a pit: a loose sunflower spiral. Rounded, because
 * Math.cos can differ in the last digit between the server and the browser (hydration).
 */
const r2 = (n: number) => Math.round(n * 100) / 100;
function seedSpot(i: number): [number, number] {
  const a = i * 2.39996;
  const r = 7 * Math.sqrt(i + 0.6);
  return [r2(Math.cos(a) * r), r2(Math.sin(a) * r)];
}

export function AyoBoard({ view, me, names, sendMove, pending, sound }: GameProps<AyoView, AyoMove>) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number[]>(view.pits);
  const [hot, setHot] = useState<number | null>(null);
  const [taking, setTaking] = useState<number[]>([]);
  const prevPits = useRef<number[]>(view.pits);
  const lastKey = useRef<string | null>(view.last ? JSON.stringify(view.last) : null);
  const animating = useRef(false);

  // Replay the latest sowing seed by seed, then the captures.
  useEffect(() => {
    const key = view.last ? JSON.stringify(view.last) : null;
    const target = view.pits;
    if (key === lastKey.current || !view.last || reduce) {
      lastKey.current = key;
      prevPits.current = target;
      setShown(target);
      return;
    }
    lastKey.current = key;
    const { from, sown, captured } = view.last;
    const working = [...prevPits.current];
    prevPits.current = target;
    const timers: ReturnType<typeof setTimeout>[] = [];
    animating.current = true;
    working[from] = 0;
    setShown([...working]);
    setHot(from);
    const step = Math.max(70, Math.min(160, 1600 / Math.max(1, sown.length)));
    sown.forEach((pit, i) => {
      timers.push(
        setTimeout(() => {
          working[pit]!++;
          setShown([...working]);
          setHot(pit);
          sound("tick");
        }, (i + 1) * step),
      );
    });
    const afterSow = (sown.length + 1) * step + 250;
    if (captured.length) {
      timers.push(setTimeout(() => setTaking(captured), afterSow));
      timers.push(setTimeout(() => sound("win"), afterSow));
    }
    timers.push(
      setTimeout(
        () => {
          setTaking([]);
          setHot(null);
          setShown(target);
          animating.current = false;
        },
        afterSow + (captured.length ? 700 : 0),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [view.last, view.pits, reduce, sound]);

  const mySeat = view.mySeat;
  const oppSeat = mySeat === 0 ? 1 : 0;
  const partner = view.players[oppSeat];
  const partnerName = names[partner] ?? "Your partner";
  const myTurn = view.players[view.turn] === me && !view.winner;
  const legal = new Set(view.legal);

  // Bottom row: my pits left→right. Top row: theirs right→left, so sowing reads counter-clockwise.
  const bottom = [0, 1, 2, 3, 4, 5].map((i) => mySeat * 6 + i);
  const top = [5, 4, 3, 2, 1, 0].map((i) => oppSeat * 6 + i);

  const play = (local: number) => {
    if (!myTurn || pending || !legal.has(local)) return;
    sound("tap");
    void sendMove({ pit: local });
  };

  const lastBy = view.last?.by;
  const detail = view.last
    ? view.last.seedsCaptured > 0
      ? `${lastBy === me ? "You" : partnerName} captured ${view.last.seedsCaptured}.`
      : `${lastBy === me ? "You" : partnerName} sowed ${view.last.sown.length}.`
    : "Four seeds in every pit. Your move decides the shape of the game.";

  const status = view.winner
    ? view.winner === "tie"
      ? "Twenty-four apiece. A draw."
      : view.winner === me
        ? `${view.stores[me]} seeds. You win.`
        : `${partnerName} wins with ${view.stores[partner]}.`
    : myTurn
      ? view.legal.length < bottom.filter((i) => view.pits[i]! > 0).length
        ? "Their side is empty. Feed them."
        : "Your move."
      : `${partnerName} is counting…`;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <Scoreline
        left={{ name: names[me] ?? "You", score: view.stores[me], sub: `of ${TO_WIN}` }}
        right={{ name: partnerName, score: view.stores[partner], sub: `of ${TO_WIN}` }}
        active={view.winner ? null : myTurn ? "left" : "right"}
      />

      <div
        className="relative rounded-[48px] border-[2px] border-[#5e3f17] p-3 sm:p-4"
        style={{ background: "linear-gradient(180deg,#c99b52,#b8893b 55%,#a87a30)", boxShadow: "inset 0 2px 0 rgba(255,255,255,.25), inset 0 -6px 0 rgba(0,0,0,.18), 0 24px 40px -30px rgba(28,20,22,.8)" }}
        role="group"
        aria-label={`Ayo board. ${status}`}
      >
        <div className="grid grid-cols-6 gap-2 sm:gap-3">
          {top.map((i) => (
            <Pit key={i} count={shown[i]!} hot={hot === i} taking={taking.includes(i)} label={`${partnerName}'s pit, ${view.pits[i]} seeds`} reduce={!!reduce} />
          ))}
        </div>
        <div className="my-2 h-px bg-[rgba(94,63,23,.45)] sm:my-3" aria-hidden />
        <div className="grid grid-cols-6 gap-2 sm:gap-3">
          {bottom.map((i, local) => (
            <Pit
              key={i}
              count={shown[i]!}
              hot={hot === i}
              taking={taking.includes(i)}
              label={`Your pit ${local + 1}, ${view.pits[i]} seeds${legal.has(local) ? "" : myTurn ? ", can't play" : ""}`}
              onClick={myTurn ? () => play(local) : undefined}
              playable={myTurn && legal.has(local) && !pending}
              reduce={!!reduce}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Status>{status}</Status>
        <p className="text-[0.88rem] text-muted" aria-live="polite">{detail}</p>
      </div>
    </div>
  );
}

function Pit({ count, hot, taking, label, onClick, playable, reduce }: { count: number; hot: boolean; taking: boolean; label: string; onClick?: () => void; playable?: boolean; reduce: boolean }) {
  const visible = Math.min(count, 18);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? !playable : undefined}
      aria-label={label}
      className={cn(
        "relative aspect-square w-full rounded-full transition-[box-shadow,transform] duration-200",
        onClick && playable && "cursor-pointer hover:-translate-y-0.5",
        "disabled:cursor-default",
      )}
      style={{
        background: "radial-gradient(circle at 50% 38%, #6a4419, #8a5d24 70%)",
        boxShadow: hot
          ? "inset 0 4px 8px rgba(0,0,0,.45), 0 0 0 3px #fff3ea"
          : playable
            ? "inset 0 4px 8px rgba(0,0,0,.45), 0 0 0 2.5px var(--accent)"
            : "inset 0 4px 8px rgba(0,0,0,.45)",
      }}
    >
      <svg viewBox="-30 -30 60 60" className="absolute inset-0 h-full w-full" aria-hidden>
        <AnimatePresence initial={false}>
          {Array.from({ length: visible }, (_, k) => {
            const [x, y] = seedSpot(k);
            return (
              <motion.ellipse
                key={k}
                cx={x}
                cy={y}
                rx={4.6}
                ry={3.8}
                transform={`rotate(${(k * 47) % 180} ${x} ${y})`}
                fill={SEED_COLORS[k % SEED_COLORS.length]}
                stroke="rgba(0,0,0,.35)"
                strokeWidth={0.6}
                initial={reduce ? false : { scale: 0, y: -10, opacity: 0 }}
                animate={taking && !reduce ? { y: -40, opacity: 0, scale: 0.6 } : { scale: 1, y: 0, opacity: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={taking ? { duration: 0.5, delay: k * 0.02 } : { type: "spring", stiffness: 500, damping: 22 }}
              />
            );
          })}
        </AnimatePresence>
      </svg>
      <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2a1d17] px-1 text-[0.7rem] font-bold tabular-nums text-[#f3e7dd]">{count}</span>
    </Tag>
  );
}
