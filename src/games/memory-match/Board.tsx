"use client";

import { useCallback } from "react";
import type { GameProps } from "@/games/_engine/types";
import { PlayingCard } from "@/design/PlayingCard";
import { Icon } from "@/design/icons";
import { Status, TimerBar, useCountdown, useTickAtDeadline } from "@/games/_ui";
import { cn } from "@/lib/cn";
import type { MemoryMove, MemoryView } from "./logic";

export function MemoryMatchBoard({ view, me, names, sendMove, pending, clock, sound }: GameProps<MemoryView, MemoryMove>) {
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const myTurn = view.turn === me && !view.result;
  const left = useCountdown(view.result ? null : view.deadline, clock);
  const pairs = view.matched.filter(Boolean).length / 2;

  useTickAtDeadline(view.result ? null : view.deadline, clock, useCallback(() => void sendMove({ type: "tick" }, { silent: true }), [sendMove]));

  const status = view.result
    ? view.result === "win"
      ? `Cleared with ${Math.ceil((left ?? 0) / 1000)}s to spare.`
      : `Time's up at ${pairs} of 8 pairs.`
    : view.deadline === null
      ? myTurn
        ? "Flip a card to start the clock."
        : `${partnerName} goes first.`
      : myTurn
        ? view.up.length === 1
          ? "Now find its pair."
          : "Your turn."
        : `${partnerName}'s turn. Help them remember.`;

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="display tabular text-[2.4rem] leading-none">{pairs}/8</p>
          <p className="text-[0.82rem] text-muted">pairs together · {view.misses} misses</p>
        </div>
        <p className="display tabular text-[2rem]" aria-label={left === null ? "Clock not started" : `${Math.ceil(left / 1000)} seconds left`}>
          {left === null ? `${view.targetMs / 1000}s` : `${Math.ceil(left / 1000)}s`}
        </p>
      </div>
      <TimerBar left={left} total={view.targetMs} />
      <Status>{status}</Status>

      <div className="grid grid-cols-4 gap-2.5 sm:gap-3" role="grid" aria-label="Cards">
        {view.cards.map((c, i) => {
          const faceUp = c !== null;
          const canFlip = myTurn && !view.matched[i] && !(view.up.length === 1 && view.up[0] === i) && !pending;
          return (
            <PlayingCard
              key={i}
              faceUp={faceUp}
              width={0}
              ratio={1}
              className={cn("!h-auto !w-full aspect-square", view.matched[i] && "opacity-70")}
              label={faceUp ? `Card ${i + 1}: ${c}${view.matched[i] ? ", matched" : ""}` : `Card ${i + 1}, face down`}
              onClick={
                canFlip
                  ? () => {
                      sound("flip");
                      void sendMove({ type: "flip", index: i });
                    }
                  : undefined
              }
              front={
                <span className={cn("flex h-full w-full items-center justify-center", view.matched[i] ? "bg-[color-mix(in_srgb,var(--sage)_25%,#fbf7f1)]" : "")} style={{ color: view.matched[i] ? "#4f5e43" : "#5b1a2b" }}>
                  {c ? <Icon name={c} size={34} strokeWidth={2} /> : null}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
