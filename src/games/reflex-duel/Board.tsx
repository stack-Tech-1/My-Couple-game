"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Status, useTickAtDeadline } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { ROUND_TIMEOUT_MS, WINS_NEEDED, type ReflexMove, type ReflexView, type RoundResult } from "./logic";

type Phase = "lobby" | "wait" | "go" | "tapped" | "done";

export function ReflexBoard({ view, me, names, sendMove, clock, sound }: GameProps<ReflexView, ReflexMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const myTap = view.taps[me];
  const [fired, setFired] = useState(false);
  const shownAt = useRef<number | null>(null);
  const [mine, setMine] = useState<number | "early" | null>(null);

  // Reset local round state whenever a new round arms.
  useEffect(() => {
    setFired(false);
    shownAt.current = null;
    setMine(null);
  }, [view.round, view.goAt]);

  // Flip to GO on the exact frame the server clock passes goAt, and remember when it was painted.
  useEffect(() => {
    if (view.phase !== "armed" || !view.goAt || myTap) return;
    let raf = 0;
    const loop = () => {
      if (clock() >= view.goAt!) {
        setFired(true);
        requestAnimationFrame(() => {
          shownAt.current = performance.now();
        });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [view.phase, view.goAt, myTap, clock]);

  useTickAtDeadline(
    view.phase === "armed" && view.goAt ? view.goAt + ROUND_TIMEOUT_MS : null,
    clock,
    useCallback(() => void sendMove({ type: "tick" }, { silent: true }), [sendMove]),
  );

  const tap = useCallback(() => {
    if (view.winner) return;
    if (view.phase === "lobby") {
      if (!view.ready[me]) {
        sound("tap");
        void sendMove({ type: "ready" });
      }
      return;
    }
    if (myTap || mine !== null) return;
    if (!fired || shownAt.current === null) {
      setMine("early");
      sound("lose");
      void sendMove({ type: "tap", ms: null }, { silent: true });
      return;
    }
    const ms = Math.round(performance.now() - shownAt.current);
    setMine(ms);
    sound("tap");
    void sendMove({ type: "tap", ms }, { silent: true });
  }, [view.winner, view.phase, view.ready, me, myTap, mine, fired, sendMove, sound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Enter") {
        if ((e.target as HTMLElement)?.tagName === "BUTTON" && e.key === "Enter") return;
        e.preventDefault();
        if (!e.repeat) tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tap]);

  const phase: Phase = view.winner ? "done" : view.phase === "lobby" ? "lobby" : mine !== null || myTap ? "tapped" : fired ? "go" : "wait";
  const last = view.results.at(-1);

  const panel: Record<Phase, { bg: string; fg: string; title: string; sub: string }> = {
    lobby: {
      bg: "var(--bg-raised)",
      fg: "var(--fg)",
      title: view.ready[me] ? "Ready." : "Tap when you're ready",
      sub: view.ready[me] ? `Waiting for ${partnerName}…` : view.ready[partner] ? `${partnerName} is ready and staring at you.` : "Best of seven. Phones down flat helps.",
    },
    wait: { bg: "#5b1a2b", fg: "#f3d9a6", title: "Wait for it…", sub: "Don't you dare." },
    go: { bg: "#e8563a", fg: "#fff8f1", title: "Now!", sub: "" },
    tapped: {
      bg: "var(--bg-raised)",
      fg: "var(--fg)",
      title: mine === "early" || myTap?.kind === "early" ? "Too soon!" : `${typeof mine === "number" ? mine : myTap?.kind === "tap" ? myTap.ms : ""} ms`,
      sub: mine === "early" || myTap?.kind === "early" ? "That's a false start." : `Waiting for ${partnerName}…`,
    },
    done: { bg: "var(--bg-raised)", fg: "var(--fg)", title: view.winner === me ? "Fastest hands in the house." : `${partnerName} takes it.`, sub: "" },
  };
  const p = panel[phase];

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        {[me, partner].map((pid) => (
          <div key={pid} className={cn(pid === partner && "text-right")}>
            <p className="text-[0.85rem] font-semibold">{pid === me ? "You" : partnerName}</p>
            <div className={cn("mt-1.5 flex gap-1.5", pid === partner && "justify-end")} aria-label={`${view.score[pid]} of ${WINS_NEEDED} rounds`} role="img">
              {Array.from({ length: WINS_NEEDED }, (_, i) => (
                <span key={i} className="h-3.5 w-3.5 rounded-full border-[1.5px] border-line-strong transition-colors" style={{ background: i < view.score[pid]! ? "var(--accent)" : "transparent" }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
        onKeyDown={(e) => e.key === "Enter" && tap()}
        aria-label={`${p.title}. ${p.sub}`}
        className="relative flex aspect-[4/5] w-full touch-none select-none flex-col items-center justify-center overflow-hidden rounded-[28px] border-[1.5px] border-line-strong sm:aspect-[5/4]"
        style={{ background: p.bg, color: p.fg, transition: phase === "go" ? "none" : "background-color 300ms" }}
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={`${phase}-${p.title}`}
            initial={phase === "go" ? { scale: 1.3, opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={phase === "go" ? { duration: 0.08 } : { duration: 0.2 }}
            className="display tabular px-6 text-center text-[clamp(2.6rem,12vw,5rem)]"
          >
            {p.title}
          </motion.span>
        </AnimatePresence>
        {p.sub ? <span className="mt-3 px-6 text-center text-[1rem] opacity-80">{p.sub}</span> : null}
        {phase === "wait" && last ? <LastRound r={last} me={me} names={names} /> : null}
      </button>

      <Status className="text-[1.1rem]">
        {view.phase === "lobby" ? "Round 1 of up to 7" : view.winner ? "Match over." : `Round ${view.round}`}
      </Status>
    </div>
  );
}

function LastRound({ r, me, names }: { r: RoundResult; me: string; names: Record<string, string> }) {
  const who = (p: string) => (p === me ? "You" : (names[p] ?? "They"));
  const fmt = (p: string) => {
    const t = r.taps[p];
    return t ? (t.kind === "early" ? "jumped" : `${t.ms} ms`) : "—";
  };
  const ids = Object.keys(r.taps);
  const line =
    r.reason === "replay"
      ? "Last round's a replay."
      : r.reason === "false-start"
        ? `${who(ids.find((p) => p !== r.winner)!)} jumped early. Point to ${who(r.winner!).toLowerCase() === "you" ? "you" : who(r.winner!)}.`
        : r.reason === "no-show"
          ? `${who(r.winner!)} took it by default.`
          : `${who(r.winner!)} won it: ${ids.map((p) => `${who(p)} ${fmt(p)}`).join(" · ")}`;
  return <span className="absolute inset-x-0 bottom-6 px-6 text-center text-[0.9rem] opacity-80">{line}</span>;
}
