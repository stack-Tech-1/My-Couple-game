"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { GameProps } from "@/games/_engine/types";
import { listNames, Scores, Status } from "@/games/_ui";
import { Button } from "@/design/Button";
import type { DontLaughMove, DontLaughView } from "./logic";

export function DontLaughBoard({ view, me, names, sendMove, pending, sound }: GameProps<DontLaughView, DontLaughMove>) {
  const nameOf = (p: string) => (p === me ? "you" : (names[p] ?? "someone"));
  const Name = (p: string) => (p === me ? "You" : (names[p] ?? "Someone"));
  const two = view.players.length === 2;
  const last = view.history[view.history.length - 1];
  const iPerform = view.performer === me;
  const performerName = view.performer ? Name(view.performer) : "";
  const watchers = view.players.filter((p) => p !== view.performer);
  const stillWatching = watchers.filter((p) => !view.answered.includes(p));

  const lastLine = last
    ? (() => {
        const who = last.performer === me ? "You" : Name(last.performer);
        const cracked = last.laughs.length;
        if (two) return `${who} did “${last.prompt}” and ${cracked ? `${nameOf(last.laughs[0]!)} cracked.` : "got a straight face."}`;
        return `${who} did “${last.prompt}”. ${cracked ? `${listNames(last.laughs, names, me).replace(/^you/, "You")} cracked.` : "Straight faces all round."}`;
      })()
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <Scores players={view.players} me={me} names={names} scores={view.scores} active={view.performer} unit="laughs caused" />

      {lastLine ? (
        <p className="text-center text-[0.9rem] text-muted" role="status">
          Last turn: {lastLine}
        </p>
      ) : null}

      {view.winner ? (
        <Status>
          {view.winner === "tie"
            ? two
              ? "Even. You're both hard to crack."
              : "A tie for funniest."
            : view.winner === me
              ? two
                ? "You're the funnier one. Officially."
                : "You're the funniest. Officially."
              : `${Name(view.winner)} is the ${two ? "funnier" : "funniest"} one. Officially.`}
        </Status>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={`${view.round}-${view.prompt ?? "watch"}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
            <p className="eyebrow tabular" style={{ color: "var(--cat-competitive-ink)" }}>
              Turn {view.round + 1} of {view.rounds}
            </p>
            {iPerform ? (
              <>
                <p className="mt-3 text-muted">Your turn to perform. Make {two ? Name(watchers[0]!) : "them"} laugh:</p>
                <h2 className="display mt-2 text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">{view.prompt}</h2>
                <p className="mt-4 text-[0.9rem] text-muted">
                  {two ? `When you're done, ${Name(watchers[0]!)} says whether they laughed.` : stillWatching.length ? `Waiting on ${listNames(stillWatching, names)} to say if they laughed.` : "Everyone has answered."}
                </p>
                {view.canSwap ? (
                  <Button variant="outline" className="mt-4" disabled={pending} onClick={() => (sound("flip"), void sendMove({ type: "swap" }))}>
                    Swap this prompt
                  </Button>
                ) : null}
              </>
            ) : view.myVerdict !== null ? (
              <>
                <h2 className="display mt-3 text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">{view.myVerdict ? "You cracked. Noted." : "Straight face. Respect."}</h2>
                <p className="mt-2 text-muted">Waiting for {listNames(stillWatching, names)} to answer.</p>
              </>
            ) : (
              <>
                <h2 className="display mt-3 text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">{performerName} is performing. Don&apos;t laugh.</h2>
                <p className="mt-2 text-muted">You&apos;ll see what they were going for afterwards. Be honest when they&apos;re done.</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button variant="accent" disabled={pending} onClick={() => (sound("lose"), void sendMove({ type: "verdict", laughed: true }))}>
                    I laughed
                  </Button>
                  <Button variant="outline" disabled={pending} onClick={() => (sound("win"), void sendMove({ type: "verdict", laughed: false }))}>
                    Straight face
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
