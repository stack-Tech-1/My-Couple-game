"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { GameProps } from "@/games/_engine/types";
import { Scoreline, Status } from "@/games/_ui";
import { Button } from "@/design/Button";
import type { DontLaughMove, DontLaughView } from "./logic";

export function DontLaughBoard({ view, me, names, sendMove, pending, sound }: GameProps<DontLaughView, DontLaughMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const last = view.history[view.history.length - 1];
  const iPerform = view.performer === me;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <Scoreline left={{ name: "You", score: view.scores[me] ?? 0, sub: "laughs caused" }} right={{ name: partnerName, score: view.scores[partner] ?? 0, sub: "laughs caused" }} active={view.performer ? (iPerform ? "left" : "right") : null} />

      {last ? (
        <p className="text-center text-[0.9rem] text-muted" role="status">
          Last turn: {last.performer === me ? "you" : partnerName} did &ldquo;{last.prompt}&rdquo; and {last.laughed ? `${last.performer === me ? partnerName : "you"} cracked.` : "got a straight face."}
        </p>
      ) : null}

      {view.winner ? (
        <Status>{view.winner === "tie" ? "Even. You're both hard to crack." : view.winner === me ? "You're the funnier one. Officially." : `${partnerName} is the funnier one. Officially.`}</Status>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={`${view.round}-${view.prompt ?? "watch"}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, pointerEvents: "none" }} className="rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6">
            <p className="eyebrow tabular" style={{ color: "var(--cat-competitive-ink)" }}>
              Turn {view.round + 1} of {view.rounds}
            </p>
            {iPerform ? (
              <>
                <p className="mt-3 text-muted">Your turn to perform. Make {partnerName} laugh:</p>
                <h2 className="display mt-2 text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">{view.prompt}</h2>
                <p className="mt-4 text-[0.9rem] text-muted">When you&apos;re done, {partnerName} says whether they laughed.</p>
                {view.canSwap ? (
                  <Button variant="outline" className="mt-4" disabled={pending} onClick={() => (sound("flip"), void sendMove({ type: "swap" }))}>
                    Swap this prompt
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <h2 className="display mt-3 text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">{partnerName} is performing. Don&apos;t laugh.</h2>
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
