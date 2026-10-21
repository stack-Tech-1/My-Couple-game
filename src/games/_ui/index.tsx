"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

/** Two players and their scores, with the active side lit. */
export function Scoreline({
  left,
  right,
  active,
  className,
}: {
  left: { name: string; score?: ReactNode; sub?: ReactNode };
  right: { name: string; score?: ReactNode; sub?: ReactNode };
  active?: "left" | "right" | null;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[1fr_auto_1fr] items-end gap-3", className)}>
      <Side {...left} on={active === "left"} dim={!!active && active !== "left"} />
      <span className="display pb-1 text-[1rem] text-muted">vs</span>
      <Side {...right} on={active === "right"} dim={!!active && active !== "right"} align="right" />
    </div>
  );
}

function Side({ name, score, sub, on, dim, align }: { name: string; score?: ReactNode; sub?: ReactNode; on: boolean; dim: boolean; align?: "right" }) {
  return (
    <div className={cn("min-w-0 transition-colors", align === "right" && "text-right", dim && "text-muted")}>
      <p className={cn("flex items-center gap-1.5 text-[0.85rem] font-semibold", align === "right" && "justify-end")}>
        {on ? <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> : null}
        <span className="truncate">{name}</span>
      </p>
      {score !== undefined ? <p className="display tabular text-[2.2rem] leading-none">{score}</p> : null}
      {sub ? <p className="mt-0.5 text-[0.78rem] text-muted">{sub}</p> : null}
    </div>
  );
}

/** Big status line announced to screen readers. */
export function Status({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p aria-live="polite" className={cn("display text-center text-[clamp(1.4rem,5vw,1.9rem)] leading-tight", className)}>
      {children}
    </p>
  );
}

/** Milliseconds left until `deadline` on the server clock. Null deadline → null. */
export function useCountdown(deadline: number | null | undefined, clock: () => number, stepMs = 200): number | null {
  // Starts null and fills in after mount: a clock-derived value can never match between server and browser.
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, deadline - clock()));
    tick();
    const t = setInterval(tick, stepMs);
    return () => clearInterval(t);
  }, [deadline, clock, stepMs]);
  return left;
}

/**
 * When the deadline passes, send a timeout tick. Both players may do this; the server
 * accepts the first and the second is dropped silently. Jitter spreads them apart.
 */
export function useTickAtDeadline(deadline: number | null | undefined, clock: () => number, send: () => void) {
  const sent = useRef<number | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const jitter = 250 + Math.random() * 500;
    const wait = Math.max(0, deadline - clock()) + jitter;
    const t = setTimeout(() => {
      if (sent.current === deadline) return;
      sent.current = deadline;
      send();
    }, wait);
    return () => clearTimeout(t);
  }, [deadline, clock, send]);
}

/** A thin draining bar for timers. */
export function TimerBar({ left, total, className }: { left: number | null; total: number; className?: string }) {
  if (left === null) return null;
  const pct = Math.max(0, Math.min(1, left / total));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunk", className)} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <div className="h-full rounded-full transition-[width] duration-200 ease-linear" style={{ width: `${pct * 100}%`, backgroundColor: pct < 0.25 ? "var(--accent)" : "var(--fg)" }} />
    </div>
  );
}

/** A transient line of feedback ("Nice!", "So close") keyed so it re-animates. */
export function Flash({ id, children }: { id: string | number | null; children: ReactNode }) {
  return (
    <AnimatePresence mode="popLayout">
      {id !== null ? (
        <motion.p key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center font-semibold" role="status">
          {children}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export const otherOf = <T,>(pair: readonly [T, T], me: T): T => (pair[0] === me ? pair[1] : pair[0]);
/**
 * Scores for 2 or more players. Two players get the classic head-to-head line; groups get a row of
 * chips, highest first, with an optional highlight (whose turn, who's drawing).
 */
export function Scores({
  players,
  me,
  names,
  scores,
  active,
  unit,
  className,
}: {
  players: readonly string[];
  me: string;
  names: Record<string, string>;
  scores: Record<string, number>;
  active?: string | null;
  /** Shown under each score for two players ("laughs caused"). */
  unit?: string;
  className?: string;
}) {
  const nameOf = (p: string) => (p === me ? "You" : (names[p] ?? "Someone"));
  if (players.length === 2) {
    const other = otherOf(players as readonly [string, string], me);
    return (
      <Scoreline
        left={{ name: "You", score: scores[me] ?? 0, sub: unit }}
        right={{ name: nameOf(other), score: scores[other] ?? 0, sub: unit }}
        active={active ? (active === me ? "left" : "right") : null}
        className={className}
      />
    );
  }
  const ranked = [...players].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Scores">
      {ranked.map((p) => (
        <li
          key={p}
          className={cn(
            "flex items-center gap-2 rounded-full border-[1.5px] py-1 pl-3 pr-1 text-[0.88rem] font-semibold",
            p === active ? "border-accent" : "border-line",
            p === me && "bg-sunk",
          )}
        >
          {p === active ? <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> : null}
          <span className="max-w-[8rem] truncate">{nameOf(p)}</span>
          <span className="tabular flex h-7 min-w-7 items-center justify-center rounded-full bg-fg px-2 text-bg">{scores[p] ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Ada", "Ada and Bo", "Ada, Bo and Cy". */
export function listNames(ids: readonly string[], names: Record<string, string>, me?: string): string {
  const n = ids.map((p) => (p === me ? "you" : (names[p] ?? "someone")));
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
}
