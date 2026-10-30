"use client";

import { useEffect, useRef, useState } from "react";
import { makeRng } from "@/games/_engine/rng";
import { cn } from "@/lib/cn";
import type { SoloApi } from "../SoloShell";

const ROUNDS = 5;
type Saved = { times: number[] };

/** Five rounds: wait for the circle to turn gold, then tap. Your score is your average time. */
export function ReflexTraining({ api }: { api: SoloApi<Saved> }) {
  const [times, setTimes] = useState<number[]>(api.saved?.times ?? []);
  const [phase, setPhase] = useState<"ready" | "wait" | "go" | "early">("ready");
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const round = times.length;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // Leaving the app mid-wait makes that round start again.
  useEffect(() => {
    if (api.paused && (phase === "wait" || phase === "go")) {
      if (timer.current) clearTimeout(timer.current);
      setPhase("ready");
    }
  }, [api.paused, phase]);

  const begin = () => {
    const rng = makeRng(api.seed, round);
    const wait = 1400 + rng.int(2600);
    setPhase("wait");
    timer.current = setTimeout(() => {
      goAt.current = performance.now();
      setPhase("go");
      api.sound("tick");
    }, wait);
  };

  const tap = () => {
    if (api.paused) return;
    if (phase === "ready" || phase === "early") return begin();
    if (phase === "wait") {
      if (timer.current) clearTimeout(timer.current);
      api.sound("lose");
      return setPhase("early");
    }
    const ms = Math.round(performance.now() - goAt.current);
    const next = [...times, ms];
    setTimes(next);
    api.save({ times: next });
    api.sound("tap");
    setPhase("ready");
    if (next.length >= ROUNDS) api.end(Math.round(next.reduce((a, b) => a + b, 0) / next.length), { best: Math.min(...next) });
  };

  const label =
    phase === "wait" ? "Wait for gold…" : phase === "go" ? "Tap!" : phase === "early" ? "Too early. Tap to try that round again." : round >= ROUNDS ? "Done" : round ? `Round ${round + 1} of ${ROUNDS}. Tap to start.` : "Tap to start. Wait for gold, then tap as fast as you can.";

  return (
    <div className="mx-auto max-w-[420px] select-none text-center">
      <div data-tour="reflex-times" className="flex justify-center gap-2" aria-label="Your times">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span key={i} className={cn("min-w-14 rounded-full px-2 py-1 text-[0.82rem] font-bold tabular", times[i] ? "bg-[#1c1416] text-[#f6efe6]" : "glass text-muted")}>
            {times[i] ? `${times[i]} ms` : "–"}
          </span>
        ))}
      </div>
      <button
        type="button"
        data-tour="reflex-pad"
        onPointerDown={tap}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), tap())}
        aria-live="assertive"
        className={cn(
          "mx-auto mt-8 flex aspect-square w-[min(80vw,320px)] items-center justify-center rounded-full border-[6px] border-[#1c1416] p-6 text-[1.2rem] font-extrabold shadow-[0_24px_40px_-24px_rgba(28,20,22,.8)]",
          phase === "go" ? "bg-[#f6c453]" : phase === "early" ? "bg-[#e8563a] text-[#fbf7f1]" : phase === "wait" ? "bg-[#7a2e1f] text-[#f6efe6]" : "bg-[#fbf7f1]",
        )}
      >
        {label}
      </button>
    </div>
  );
}
