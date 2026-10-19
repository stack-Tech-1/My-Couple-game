"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Scoreline, Status, TimerBar, useCountdown, useTickAtDeadline } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { CHOOSE_MS, type DrawMove, type DrawView } from "./logic";
import { Sketchpad } from "./Canvas";

const BANDS = ["Easy", "Medium", "Hard"];

export function DrawGuessBoard({ view, me, names, sendMove, broadcast, clock, pending, sound }: GameProps<DrawView, DrawMove>) {
  const [text, setText] = useState("");
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const drawing = view.drawer === me;
  const left = useCountdown(view.winner ? null : view.deadline, clock);
  const total = view.phase === "choosing" ? CHOOSE_MS : view.drawMs;

  useTickAtDeadline(view.winner ? null : view.deadline, clock, useCallback(() => void sendMove({ type: "tick" }, { silent: true }), [sendMove]));

  const guess = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    sound("tap");
    void sendMove({ type: "guess", text: t }).catch(() => {});
  };

  const last = view.history.at(-1);
  const lastLine = last
    ? last.guessed
      ? `Round ${last.round}: “${last.word}”. ${last.drawer === me ? partnerName : "You"} got it (+${last.points}).`
      : last.passed
        ? `Round ${last.round}: “${last.word}”. ${last.drawer === me ? "You" : partnerName} passed.`
        : `Round ${last.round}: “${last.word}”. Time ran out.`
    : null;

  const status = view.winner
    ? view.winner === "tie"
      ? "A tie. Equally talented, or equally terrible."
      : view.winner === me
        ? "You win. Gallery-worthy."
        : `${partnerName} wins.`
    : view.phase === "choosing"
      ? drawing
        ? "Pick something to draw."
        : `${partnerName} is picking a word…`
      : drawing
        ? `Draw: ${view.word}`
        : "What is it?";

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <Scoreline
        left={{ name: names[me] ?? "You", score: view.scores[me], sub: drawing ? "drawing" : "guessing" }}
        right={{ name: partnerName, score: view.scores[partner], sub: drawing ? "guessing" : "drawing" }}
        active={null}
      />
      <div className="flex items-center justify-between text-[0.85rem] text-muted">
        <span>
          Round {view.round} of {view.rounds}
        </span>
        <span className="tabular">{left !== null ? `${Math.ceil(left / 1000)}s` : ""}</span>
      </div>
      <TimerBar left={left} total={total} />

      <Status>{status}</Status>
      {!drawing && view.pattern && view.phase === "drawing" ? (
        <p className="text-center font-mono text-[1.3rem] tracking-[0.2em]" aria-label={`${view.pattern.replace(/ /g, "").length} letters`}>
          {view.pattern}
        </p>
      ) : null}

      {view.phase === "choosing" && drawing && !view.winner ? (
        <div className="grid grid-cols-3 gap-3">
          {view.options!.map((w, i) => (
            <button
              key={w}
              type="button"
              onClick={() => void sendMove({ type: "choose", index: i })}
              disabled={pending}
              className="flex flex-col items-start gap-1 rounded-[16px] border-[1.5px] border-line-strong bg-raised p-4 text-left transition-transform hover:-translate-y-0.5"
            >
              <span className="eyebrow text-muted">{BANDS[i]}</span>
              <span className="display text-[1.3rem] leading-tight">{w}</span>
            </button>
          ))}
        </div>
      ) : (
        <Sketchpad
          round={view.round}
          drawing={drawing && view.phase === "drawing" && !view.winner}
          broadcast={broadcast}
          label={drawing ? `Your canvas. Draw ${view.word ?? ""}` : `${partnerName}'s drawing`}
        />
      )}

      {drawing && view.phase === "drawing" && !view.winner ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.88rem] text-muted">{view.guesses.length ? `${partnerName} has guessed ${view.guesses.length} times.` : `${partnerName} is staring at it.`}</p>
          <Button variant="ghost" size="sm" onClick={() => void sendMove({ type: "pass" })}>
            Pass
          </Button>
        </div>
      ) : null}

      {!drawing && view.phase === "drawing" && !view.winner ? (
        <form onSubmit={guess} className="flex gap-2">
          <label htmlFor="dg-guess" className="sr-only">
            Your guess
          </label>
          <input
            id="dg-guess"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="none"
            placeholder="Your guess"
            className="h-12 flex-1 rounded-full border-[1.5px] border-line bg-raised px-5 text-[1rem] focus:border-line-strong focus:outline-none"
          />
          <Button type="submit" variant="accent">
            Guess
          </Button>
        </form>
      ) : null}

      {view.guesses.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Guesses so far">
          {view.guesses.slice(-12).map((g, i) => (
            <li key={i} className={cn("rounded-full border px-3 py-1 text-[0.85rem]", g.close ? "border-brass bg-[color-mix(in_srgb,var(--brass)_18%,transparent)] font-semibold" : "border-line text-muted line-through")}>
              {g.text}
              {g.close ? " · so close" : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {lastLine ? <p className="text-center text-[0.88rem] text-muted">{lastLine}</p> : null}
    </div>
  );
}
