"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Dice } from "@/design/Dice";
import { Status } from "@/games/_ui";
import { cn } from "@/lib/cn";
import { HEAT_LABEL, type Heat } from "@/content/after-dark";
import type { DiceMove, DiceView, NeverMove, NeverView, SeatMove, SeatView, TodMove, TodView } from "./logic";

/** Warm / Hot / Fire, never above the server-set cap. Either player can turn it down. */
function HeatControl({ heat, maxHeat, onChange }: { heat: Heat; maxHeat: Heat; onChange: (h: Heat) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5" role="radiogroup" aria-label="Heat">
      {([1, 2, 3] as Heat[]).map((h) => (
        <button
          key={h}
          type="button"
          role="radio"
          aria-checked={heat === h}
          disabled={h > maxHeat}
          onClick={() => onChange(h)}
          className={cn("rounded-full border px-3.5 py-1.5 text-[0.82rem] font-semibold transition-colors disabled:opacity-30", heat === h ? "border-accent bg-accent text-on-accent" : "border-line")}
          title={h > maxHeat ? "Above your room's limit" : undefined}
        >
          {HEAT_LABEL[h]}
        </button>
      ))}
    </div>
  );
}

function SpicyCard({ label, children, cardKey }: { label: string; children: ReactNode; cardKey: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={cardKey}
        initial={{ rotateY: -90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ rotateY: 90, opacity: 0, pointerEvents: "none" }}
        transition={{ type: "spring", stiffness: 180, damping: 20 }}
        className="relative flex min-h-[16rem] flex-col justify-between overflow-hidden rounded-[24px] border-[1.5px] border-[#3d2127] bg-[#1b1013] p-7 text-[#f4e4da]"
        style={{ boxShadow: "0 0 60px -20px rgba(232,86,58,.55)" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 60% at 100% 0%, rgba(232,86,58,.22), transparent 70%)" }} />
        <p className="eyebrow relative text-[#ff8a6e]">{label}</p>
        <div className="relative my-5">{children}</div>
      </motion.article>
    </AnimatePresence>
  );
}

const skipLabel = "Skip, no questions";

// ---------------------------------------------------------------------------
export function TruthOrDareBoard({ view, me, names, sendMove, pending, sound }: GameProps<TodView, TodMove>) {
  const myTurn = view.turn === me;
  const partnerName = names[view.players.find((p) => p !== me) ?? ""] ?? "Your partner";
  const who = myTurn ? "You" : partnerName;
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <HeatControl heat={view.heat} maxHeat={view.maxHeat} onChange={(h) => void sendMove({ type: "heat", heat: h })} />
      {view.current ? (
        <>
          <SpicyCard cardKey={view.current.card.text} label={`${view.current.kind === "truth" ? "Truth" : "Dare"} · ${HEAT_LABEL[view.current.card.heat]} · for ${who.toLowerCase() === "you" ? "you" : who}`}>
            <p className="display text-[clamp(1.6rem,6vw,2.2rem)] leading-tight">{view.current.card.text}</p>
          </SpicyCard>
          <div className="flex gap-3">
            <Button size="lg" variant="accent" className="flex-1" disabled={pending} onClick={() => (sound("flip"), void sendMove({ type: "done" }))}>
              Done
            </Button>
            <Button size="lg" variant="ghost" disabled={pending} onClick={() => void sendMove({ type: "skip" })}>
              {skipLabel}
            </Button>
          </div>
        </>
      ) : myTurn ? (
        <>
          <Status>Truth or dare?</Status>
          <div className="grid grid-cols-2 gap-3">
            {(["truth", "dare"] as const).map((k) => (
              <button key={k} type="button" disabled={pending} onClick={() => (sound("flip"), void sendMove({ type: "pick", kind: k }))} className="display flex aspect-[4/5] items-center justify-center rounded-[22px] border-[1.5px] border-[#3d2127] bg-[#1b1013] text-[2.4rem] text-[#f4e4da] transition-transform hover:-translate-y-1" style={{ boxShadow: "0 0 50px -24px rgba(232,86,58,.6)" }}>
                {k === "truth" ? "Truth" : "Dare"}
              </button>
            ))}
          </div>
        </>
      ) : (
        <Status>{partnerName} is choosing…</Status>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function SpicyDiceBoard({ view, me, names, sendMove, pending, sound }: GameProps<DiceView, DiceMove>) {
  const myTurn = view.turnId === me;
  const partnerName = names[view.players.find((p) => p !== me) ?? ""] ?? "Your partner";
  const faceText = (list: string[]) => list.slice(0, 6).map((t) => t);
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6">
      <HeatControl heat={view.heat} maxHeat={view.maxHeat} onChange={(h) => void sendMove({ type: "heat", heat: h })} />
      <div className="flex gap-8">
        <Dice value={view.roll ? (view.roll.a % 6) + 1 : 1} rollId={view.rollId} size={96} tone="wine" faces={faceText(view.faces.action)} label={view.roll ? `What: ${view.roll.action}` : "What die"} />
        <Dice value={view.roll ? (view.roll.w % 6) + 1 : 1} rollId={view.rollId} size={96} tone="ember" faces={faceText(view.faces.where)} label={view.roll ? `Where or how: ${view.roll.where}` : "Where die"} />
      </div>
      <AnimatePresence mode="wait">
        {view.roll ? (
          <motion.p key={view.rollId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="display text-center text-[clamp(1.8rem,7vw,2.6rem)] leading-tight" aria-live="polite">
            {view.roll.action} <span className="text-accent-ink">{view.roll.where}</span>
          </motion.p>
        ) : (
          <Status key="s">{myTurn ? "Your roll." : `${partnerName} is rolling…`}</Status>
        )}
      </AnimatePresence>
      <div className="flex w-full gap-3">
        {view.roll ? (
          <>
            <Button size="lg" variant="accent" className="flex-1" disabled={pending} onClick={() => void sendMove({ type: "done" })}>
              Done, pass the dice
            </Button>
            <Button size="lg" variant="ghost" disabled={pending} onClick={() => (sound("roll"), void sendMove({ type: "skip" }))}>
              Re-roll
            </Button>
          </>
        ) : myTurn ? (
          <Button size="lg" variant="accent" className="flex-1" disabled={pending} onClick={() => (sound("roll"), void sendMove({ type: "roll" }))}>
            Roll
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function HotSeatBoard({ view, me, names, sendMove, pending, sound }: GameProps<SeatView, SeatMove>) {
  const iAmIn = view.inSeat === me;
  const seatName = iAmIn ? "You're" : `${names[view.inSeat] ?? "They"}'s`;
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <HeatControl heat={view.heat} maxHeat={view.maxHeat} onChange={(h) => void sendMove({ type: "heat", heat: h })} />
      <p className="text-center text-[0.9rem] text-muted">
        {seatName} in the hot seat · question {view.answered + 1} of {view.run}
      </p>
      {view.current ? (
        <SpicyCard cardKey={view.current.text} label={`${HEAT_LABEL[view.current.heat]} · ${iAmIn ? "you answer" : "ask them"}`}>
          <p className="display text-[clamp(1.6rem,6vw,2.2rem)] leading-tight">{view.current.text}</p>
        </SpicyCard>
      ) : (
        <Status>That&apos;s every question at this heat. Turn it up, or call it a night.</Status>
      )}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" variant="accent" className="flex-1" disabled={pending || !view.current} onClick={() => (sound("flip"), void sendMove({ type: "next" }))}>
          Next question
        </Button>
        <Button size="lg" variant="ghost" disabled={pending || !view.current} onClick={() => void sendMove({ type: "skip" })}>
          {skipLabel}
        </Button>
      </div>
      <Button variant="ghost" className="self-center" disabled={pending} onClick={() => void sendMove({ type: "swap" })}>
        Swap chairs now
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function NeverHaveIBoard({ view, me, names, sendMove, pending, sound }: GameProps<NeverView, NeverMove>) {
  const partner = view.players.find((p) => p !== me) ?? "";
  const partnerName = names[partner] ?? "Your partner";
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <HeatControl heat={view.heat} maxHeat={view.maxHeat} onChange={(h) => void sendMove({ type: "heat", heat: h })} />
      <p className="text-center text-[0.85rem] text-muted">
        You: {view.tally[me]} · {partnerName}: {view.tally[partner]}
      </p>
      {view.current ? (
        <SpicyCard cardKey={view.current.text} label={HEAT_LABEL[view.current.heat]}>
          <p className="display text-[clamp(1.6rem,6vw,2.2rem)] leading-tight">{view.current.text}</p>
        </SpicyCard>
      ) : (
        <Status>That&apos;s the whole deck at this heat.</Status>
      )}
      {view.revealed ? (
        <div className="grid grid-cols-2 gap-3" aria-live="polite">
          {[me, partner].map((p) => (
            <div key={p} className={cn("rounded-[16px] border-[1.5px] p-4 text-center", view.revealed![p] ? "border-accent" : "border-line")}>
              <p className="eyebrow text-muted">{p === me ? "You" : partnerName}</p>
              <p className="display mt-1 text-[1.5rem]">{view.revealed![p] ? "I have" : "I haven't"}</p>
            </div>
          ))}
        </div>
      ) : view.mine === null && view.current ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="accent" disabled={pending} onClick={() => (sound("tap"), void sendMove({ type: "answer", have: true }))}>
            I have
          </Button>
          <Button size="lg" variant="outline" disabled={pending} onClick={() => (sound("tap"), void sendMove({ type: "answer", have: false }))}>
            I haven&apos;t
          </Button>
        </div>
      ) : view.current ? (
        <Status>Locked in. {view.partnerAnswered ? "Revealing…" : `Waiting for ${partnerName}…`}</Status>
      ) : null}
      <div className="flex gap-3">
        {view.revealed ? (
          <Button size="lg" variant="accent" className="flex-1" disabled={pending} onClick={() => (sound("flip"), void sendMove({ type: "next" }))}>
            Next card
          </Button>
        ) : null}
        {view.current ? (
          <Button size="lg" variant="ghost" className={view.revealed ? "" : "flex-1"} disabled={pending} onClick={() => void sendMove({ type: "skip" })}>
            {skipLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
