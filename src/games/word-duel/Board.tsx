"use client";

import { motion, useAnimation, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Icon } from "@/design/icons";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { isWord, MAX_GUESSES, WORD_LEN, type Mark, type WordDuelMove, type WordDuelView } from "./logic";

const FILL: Record<Mark, { bg: string; fg: string }> = {
  g: { bg: "#5f7a4f", fg: "#fbf7f1" },
  y: { bg: "#b8893b", fg: "#fbf7f1" },
  x: { bg: "#8f8285", fg: "#fbf7f1" },
};
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const rank: Record<Mark, number> = { g: 3, y: 2, x: 1 };

export function WordDuelBoard({ view, me, names, sendMove, pending, sound }: GameProps<WordDuelView, WordDuelMove>) {
  const reduce = useReducedMotion();
  const shake = useAnimation();
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const nameOf = (p: string) => names[p] ?? "Someone";
  const winnerName = view.winner && view.winner !== "tie" ? nameOf(view.winner) : "";
  const solvers = view.others.filter((o) => o.solved);
  const stillGoing = view.others.filter((o) => !o.solved && o.marks.length < MAX_GUESSES);
  const solved = view.mine.some((g) => g.marks.every((m) => m === "g"));
  const out = solved || view.mine.length >= MAX_GUESSES || !!view.winner;

  const keyState = useMemo(() => {
    const st: Record<string, Mark> = {};
    for (const g of view.mine)
      g.word.split("").forEach((c, i) => {
        const m = g.marks[i]!;
        if (!st[c] || rank[m] > rank[st[c]!]) st[c] = m;
      });
    return st;
  }, [view.mine]);

  const reject = useCallback(
    async (msg: string) => {
      setNote(msg);
      if (!reduce) await shake.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.42 } });
    },
    [shake, reduce],
  );

  const submit = useCallback(async () => {
    if (out || pending) return;
    if (typed.length < WORD_LEN) return void reject("Five letters, please.");
    if (!isWord(typed)) return void reject("That's not in our dictionary.");
    sound("flip");
    try {
      await sendMove({ guess: typed });
      setTyped("");
      setNote(null);
    } catch {
      // the host already toasted
    }
  }, [typed, out, pending, reject, sendMove, sound]);

  const press = useCallback(
    (k: string) => {
      if (out) return;
      setNote(null);
      if (k === "enter") return void submit();
      if (k === "back") return setTyped((t) => t.slice(0, -1));
      if (/^[a-z]$/.test(k)) setTyped((t) => (t.length < WORD_LEN ? t + k : t));
    },
    [out, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Enter") press("enter");
      else if (e.key === "Backspace") press("back");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const status = view.winner
    ? view.winner === "tie"
      ? `Nobody got it. It was ${view.target?.toUpperCase()}.`
      : view.winner === me
        ? "Cracked it first."
        : `${winnerName} got there first.`
    : solved
      ? "Solved!"
      : out
        ? `Out of guesses. Waiting on ${stillGoing.map((o) => nameOf(o.player)).join(", ") || "the others"}…`
        : solvers.length
          ? `${nameOf(solvers[0]!.player)} solved it. Hurry.`
          : "Guess the word.";

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-5">
      {/* Everyone else's progress: colours only */}
      <div className={view.others.length > 1 ? "grid w-full grid-cols-2 gap-2 sm:grid-cols-3" : "w-full"}>
        {view.others.map((o) => (
          <div key={o.player} className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-line bg-raised px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[0.85rem] font-semibold">{nameOf(o.player)}</p>
              <p className="text-[0.78rem] text-muted">{o.solved ? "Solved" : `${o.marks.length}/${MAX_GUESSES} guesses`}</p>
            </div>
            <div className="grid shrink-0 gap-[3px]" aria-label={`${nameOf(o.player)}'s board: ${o.marks.length} guesses, letters hidden`} role="img">
              {Array.from({ length: MAX_GUESSES }, (_, r) => (
                <div key={r} className="flex gap-[3px]">
                  {Array.from({ length: WORD_LEN }, (_, c) => {
                    const m = o.marks[r]?.[c];
                    return <span key={c} className={view.others.length > 1 ? "h-[6px] w-[6px] rounded-[1px]" : "h-[9px] w-[9px] rounded-[2px]"} style={{ background: m ? FILL[m].bg : "var(--bg-sunk)" }} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* My board */}
      <div className="grid gap-1.5" role="grid" aria-label="Your guesses">
        {Array.from({ length: MAX_GUESSES }, (_, r) => {
          const g = view.mine[r];
          const current = r === view.mine.length && !out;
          const letters = g ? g.word : current ? typed.padEnd(WORD_LEN) : "     ";
          return (
            <motion.div key={r} role="row" className="flex gap-1.5" animate={current ? shake : undefined}>
              {letters.split("").map((ch, c) => {
                const m = g?.marks[c];
                return (
                  <motion.div
                    key={`${r}-${c}-${g ? "done" : "live"}`}
                    role="gridcell"
                    aria-label={ch.trim() ? `${ch.toUpperCase()}${m ? `, ${m === "g" ? "correct" : m === "y" ? "wrong spot" : "not in word"}` : ""}` : "empty"}
                    initial={g && !reduce ? { rotateX: 0 } : false}
                    animate={g && !reduce ? { rotateX: [0, 90, 0] } : undefined}
                    transition={{ duration: 0.5, delay: c * 0.12 }}
                    className={cn(
                      "display flex h-[3.4rem] w-[3.4rem] items-center justify-center rounded-[8px] border-[2px] text-[1.9rem] uppercase sm:h-[3.8rem] sm:w-[3.8rem]",
                      !m && (ch.trim() ? "border-line-strong" : "border-line"),
                    )}
                    style={m ? { background: FILL[m].bg, borderColor: FILL[m].bg, color: FILL[m].fg } : undefined}
                  >
                    {ch.trim()}
                  </motion.div>
                );
              })}
            </motion.div>
          );
        })}
      </div>

      <div className="flex min-h-[3.4rem] flex-col items-center">
        <Status>{status}</Status>
        <p className="mt-1 text-[0.88rem] font-semibold text-accent-ink" role="alert">{note}</p>
      </div>

      {/* Keyboard */}
      <div className="flex w-full flex-col gap-1.5" aria-label="Keyboard">
        {ROWS.map((row, i) => (
          <div key={row} className="flex justify-center gap-1.5">
            {i === 2 ? <Key label="Enter" onPress={() => press("enter")} wide disabled={out || pending} /> : null}
            {row.split("").map((k) => (
              <Key key={k} label={k} mark={keyState[k]} onPress={() => press(k)} disabled={out} />
            ))}
            {i === 2 ? <Key label="Delete" icon onPress={() => press("back")} wide disabled={out} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Key({ label, mark, onPress, wide, icon, disabled }: { label: string; mark?: Mark; onPress: () => void; wide?: boolean; icon?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-12 items-center justify-center rounded-[7px] text-[0.95rem] font-bold uppercase transition-transform active:scale-95 disabled:opacity-50",
        wide ? "min-w-[3.6rem] flex-[1.5] px-2 text-[0.75rem]" : "min-w-0 flex-1 sm:max-w-[2.6rem]",
        !mark && "bg-sunk text-fg",
      )}
      style={mark ? { background: FILL[mark].bg, color: FILL[mark].fg } : undefined}
    >
      {icon ? <Icon name="arrowLeft" size={18} /> : label}
    </button>
  );
}
