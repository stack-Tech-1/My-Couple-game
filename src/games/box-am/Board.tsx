"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { cn } from "@/lib/cn";
import type { BoxMove, BoxView } from "./logic";

/** Pen colours, one per seat. */
const INK = ["#d23a2a", "#2346b8", "#1f7a3a", "#7a2f9a"];
const S = 52; // dot spacing
const PAD = 36;

const initial = (name: string | undefined) => (name?.trim()[0] ?? "?").toUpperCase();
// A hand-drawn line: the middle bows a little, the same way every time.
const wobble = (i: number, dir: string) => (((i * 37 + (dir === "h" ? 11 : 23)) % 7) - 3) * 0.5;

export function BoxAmBoard({ view, me, names, sendMove, pending, sound }: GameProps<BoxView, BoxMove>) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const n = view.n;
  const size = n * S + PAD * 2;
  const myTurn = !view.winner && view.players[view.turn] === me;
  const nameOf = (i: number) => (view.players[i] === me ? "You" : (names[view.players[i]!] ?? "They"));
  const dot = (r: number, c: number) => [PAD + c * S, PAD + r * S] as const;

  const draw = (dir: "h" | "v", i: number) => {
    if (!myTurn || pending) return;
    const lines = dir === "h" ? view.h : view.v;
    if (lines[i] !== -1) return;
    sound("tap");
    void sendMove({ kind: "line", dir, i });
  };

  const status = view.winner
    ? view.winner === "tie"
      ? "A tie. Nobody gets bragging rights."
      : view.winner === me
        ? "You win. Box Am champion."
        : `${names[view.winner] ?? "They"} wins this one.`
    : view.closed.length && view.players[view.turn] === me
      ? "Box! You go again."
      : myTurn
        ? "Your turn."
        : `${nameOf(view.turn)} is thinking…`;

  // Every line, drawn or not.
  const lines: { dir: "h" | "v"; i: number; x1: number; y1: number; x2: number; y2: number; by: number }[] = [];
  for (let r = 0; r <= n; r++)
    for (let c = 0; c < n; c++) {
      const [x1, y1] = dot(r, c);
      lines.push({ dir: "h", i: r * n + c, x1, y1, x2: x1 + S, y2: y1, by: view.h[r * n + c]! });
    }
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= n; c++) {
      const [x1, y1] = dot(r, c);
      lines.push({ dir: "v", i: r * (n + 1) + c, x1, y1, x2: x1, y2: y1 + S, by: view.v[r * (n + 1) + c]! });
    }

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center">
      <div data-tour="box-score" className="glass mb-3 flex w-full items-center justify-around gap-2 rounded-[20px] px-3 py-2.5">
        {view.players.map((p, i) => (
          <div key={p} className={cn("flex items-center gap-2 rounded-[14px] px-2 py-1", view.turn === i && !view.winner && "bg-[rgba(255,255,255,.55)]")}>
            <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--fg)] text-[0.85rem] font-extrabold text-white" style={{ background: INK[i] }}>
              {initial(names[p])}
            </span>
            <div className="leading-tight">
              <p className="text-[0.78rem] font-bold">{p === me ? "You" : names[p]}</p>
              <p className="display text-[1.4rem] leading-none tabular" style={{ color: INK[i] }}>{view.score[i]}</p>
            </div>
          </div>
        ))}
      </div>

      <div data-tour="box-board" className="w-full -rotate-[0.6deg] overflow-hidden rounded-[18px] shadow-[0_14px_28px_-16px_rgba(28,20,22,.55)]">
        <svg viewBox={`0 0 ${size} ${size + 10}`} className="block w-full touch-manipulation" role="group" aria-label={`Box Am board. ${status}`}>
          <defs>
            {INK.map((c, i) => (
              <pattern key={i} id={`box-hatch-${i}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)">
                <line x1="0" y1="0" x2="0" y2="9" stroke={c} strokeWidth="1.2" opacity=".35" />
              </pattern>
            ))}
          </defs>
          {/* An exercise book page: ruled lines and a red margin. */}
          <rect width={size} height={size + 10} fill="#fbf8ef" />
          {Array.from({ length: Math.ceil((size + 10) / 20) }, (_, i) => (
            <line key={i} x1="0" x2={size} y1={14 + i * 20} y2={14 + i * 20} stroke="#9ec3e6" strokeWidth="1" />
          ))}
          <line x1="18" x2="18" y1="0" y2={size + 10} stroke="#e58a8a" strokeWidth="1.5" />
          <line x1="21" x2="21" y1="0" y2={size + 10} stroke="#e58a8a" strokeWidth="1" />

          {/* Boxes that belong to someone. */}
          {view.owner.map((o, b) => {
            if (o < 0) return null;
            const r = Math.floor(b / n), c = b % n;
            const [x, y] = dot(r, c);
            const fresh = view.closed.includes(b);
            return (
              <motion.g key={b} initial={fresh && !reduce ? { scale: 0.4, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 16 }} style={{ transformOrigin: `${x + S / 2}px ${y + S / 2}px` }}>
                <rect x={x + 4} y={y + 4} width={S - 8} height={S - 8} rx="3" fill={INK[o]} opacity=".1" />
                <rect x={x + 4} y={y + 4} width={S - 8} height={S - 8} fill={`url(#box-hatch-${o})`} />
                <text x={x + S / 2} y={y + S / 2 + 9} textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontWeight="700" fontSize="25" fill={INK[o]}>
                  {initial(names[view.players[o]!])}
                </text>
              </motion.g>
            );
          })}

          {/* Lines: drawn ones in ink, open ones as tap targets. */}
          {lines.map((l) => {
            const k = `${l.dir}${l.i}`;
            const mx = (l.x1 + l.x2) / 2 + (l.dir === "v" ? wobble(l.i, l.dir) : 0);
            const my = (l.y1 + l.y2) / 2 + (l.dir === "h" ? wobble(l.i, l.dir) : 0);
            const isLast = view.last?.dir === l.dir && view.last.i === l.i;
            if (l.by >= 0)
              return (
                <g key={k}>
                  {isLast ? <path d={`M${l.x1} ${l.y1} L${l.x2} ${l.y2}`} stroke={INK[l.by]} strokeWidth="10" strokeLinecap="round" opacity=".18" /> : null}
                  <motion.path
                    d={`M${l.x1} ${l.y1} Q${mx} ${my} ${l.x2} ${l.y2}`}
                    stroke={INK[l.by]}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    fill="none"
                    initial={isLast && !reduce ? { pathLength: 0 } : false}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  />
                </g>
              );
            const hot = hover === k && myTurn;
            const label = `${l.dir === "h" ? "Line across" : "Line down"}, row ${l.dir === "h" ? Math.floor(l.i / n) + 1 : Math.floor(l.i / (n + 1)) + 1}, column ${l.dir === "h" ? (l.i % n) + 1 : (l.i % (n + 1)) + 1}`;
            return (
              <g key={k} role="button" aria-label={label} tabIndex={myTurn ? 0 : -1} onClick={() => draw(l.dir, l.i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && draw(l.dir, l.i)} onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(null)} style={{ cursor: myTurn ? "pointer" : "default", outline: "none" }}>
                <rect x={Math.min(l.x1, l.x2) - (l.dir === "v" ? 16 : -6)} y={Math.min(l.y1, l.y2) - (l.dir === "h" ? 16 : -6)} width={l.dir === "h" ? S - 12 : 32} height={l.dir === "h" ? 32 : S - 12} fill="transparent" />
                {hot ? <path d={`M${l.x1} ${l.y1} L${l.x2} ${l.y2}`} stroke={INK[view.you]} strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" opacity=".55" /> : null}
              </g>
            );
          })}

          {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => {
            const [x, y] = dot(Math.floor(k / (n + 1)), k % (n + 1));
            return <circle key={k} cx={x} cy={y} r="4.4" fill="#1c1416" />;
          })}
        </svg>
      </div>

      <p className="display mt-4 text-center text-[1.4rem]" aria-live="polite">
        {status}
      </p>
      <p className="mt-1 text-center text-[0.82rem] text-muted">Tap between two dots to draw a line. Close a box and you go again.</p>
    </div>
  );
}
