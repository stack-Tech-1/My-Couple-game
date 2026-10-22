"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Status } from "@/games/_ui";
import { MAX_ROUNDS, type InSyncMove, type InSyncView } from "./logic";

export function InSyncBoard({ view, me, names, sendMove, pending, sound }: GameProps<InSyncView, InSyncMove>) {
  const [word, setWord] = useState("");
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const last = view.history.at(-1);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const w = word.trim();
    if (!w) return;
    sound("tap");
    void sendMove({ word: w }).then(() => setWord(""), () => {});
  };

  const prompt = view.result
    ? view.result === "win"
      ? `In sync, round ${view.round}.`
      : "Not quite the same wavelength. Yet."
    : view.mine
      ? view.partnerLockedIn
        ? "Revealing…"
        : `Locked in. Waiting for ${partnerName}…`
      : last
        ? "One word that connects these two."
        : "Say any word. Anything at all.";

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6">
      <p className="eyebrow tabular" style={{ color: "var(--cat-coop-ink)" }}>
        Round {view.round} of {MAX_ROUNDS}
      </p>

      <div data-tour="is-words" className="grid w-full grid-cols-2 gap-3" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {[
            ["You", last?.mine],
            [partnerName, last?.theirs],
          ].map(([who, w]) => (
            <motion.div
              key={`${view.history.length}-${who}`}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              className="flex min-h-[8.5rem] flex-col items-center justify-center rounded-[20px] border-[1.5px] border-line-strong bg-raised p-4 text-center"
            >
              <span className="eyebrow text-muted">{who}</span>
              <span className="display mt-2 break-words text-[clamp(1.6rem,6vw,2.4rem)] leading-tight">{w ?? "?"}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Status>{prompt}</Status>

      {!view.result && !view.mine ? (
        <form data-tour="is-input" onSubmit={submit} className="flex w-full gap-2">
          <label htmlFor="sync-word" className="sr-only">
            Your word
          </label>
          <input
            id="sync-word"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={30}
            autoComplete="off"
            autoFocus
            placeholder="Your word"
            className="h-14 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-raised px-6 text-[1.1rem] focus:border-line-strong focus:outline-none"
          />
          <Button type="submit" size="lg" variant="accent" loading={pending}>
            Lock in
          </Button>
        </form>
      ) : null}

      {view.history.length > 1 ? (
        <ol className="w-full space-y-1.5 text-[0.9rem]" aria-label="Earlier rounds">
          {view.history.slice(0, -1).map((h, i) => (
            <li key={i} className="flex justify-between gap-4 border-b border-line pb-1.5 text-muted">
              <span className="tabular">{i + 1}</span>
              <span className="flex-1">{h.mine}</span>
              <span className="flex-1 text-right">{h.theirs}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
