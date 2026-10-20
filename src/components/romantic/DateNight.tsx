"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { z } from "zod";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { makeRng } from "@/games/_engine/rng";
import type { DateIdea } from "@/content/date-ideas";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { addBucketItem } from "@/lib/romantic/actions";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/cn";

type Where = DateIdea["where"] | "any";
const WHERE: { key: Where; label: string }[] = [
  { key: "any", label: "Anywhere" },
  { key: "home", label: "At home" },
  { key: "out", label: "Going out" },
  { key: "distance", label: "Long-distance" },
];
const BUDGET = ["Free", "Under £20", "Treat yourselves"];
const spinEvent = z.object({ seed: z.string().max(40), where: z.enum(["any", "home", "out", "distance"]), budget: z.number().int().min(0).max(2) });

/** `ideas` comes from the server (built-ins plus admin additions), identical on both phones. */
export function DateNight({ ideas }: { ideas: DateIdea[] }) {
  const { bundle, send, on } = useRoom();
  const reduce = useReducedMotion();
  const [where, setWhere] = useState<Where>("any");
  const [budget, setBudget] = useState(2);
  const [reel, setReel] = useState<DateIdea | null>(null);
  const [result, setResult] = useState<DateIdea | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [saving, startSave] = useTransition();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pool = useMemo(() => ideas.filter((d) => (where === "any" || d.where === where) && d.budget <= budget), [ideas, where, budget]);

  // Deterministic from the seed, so both phones run the same spin and land on the same idea.
  const run = useCallback(
    (seed: string, w: Where, b: number, fromPartner: boolean) => {
      const candidates = ideas.filter((d) => (w === "any" || d.where === w) && d.budget <= b);
      if (!candidates.length) return;
      timers.current.forEach(clearTimeout);
      const rng = makeRng(seed);
      const pick = candidates[rng.int(candidates.length)]!;
      setWhere(w);
      setBudget(b);
      setResult(null);
      setSpinning(true);
      if (fromPartner) toast.info(`${bundle.partner?.profile.display_name ?? "Your partner"} is spinning…`);
      const steps = reduce ? 0 : 14;
      for (let i = 0; i < steps; i++) {
        timers.current.push(
          setTimeout(() => {
            setReel(candidates[rng.int(candidates.length)]!);
            if (bundle.me.member.sound_enabled) playSound("tick");
          }, 40 * i + i * i * 5),
        );
      }
      timers.current.push(
        setTimeout(() => {
          setReel(null);
          setResult(pick);
          setSpinning(false);
          if (bundle.me.member.sound_enabled) playSound("win");
        }, steps ? 40 * steps + steps * steps * 5 + 150 : 0),
      );
    },
    [ideas, reduce, bundle.me.member.sound_enabled, bundle.partner?.profile.display_name],
  );

  useEffect(
    () =>
      on("date:spin", (raw) => {
        const p = spinEvent.safeParse(raw);
        if (p.success) run(p.data.seed, p.data.where, p.data.budget, true);
      }),
    [on, run],
  );
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const spin = () => {
    const seed = crypto.randomUUID();
    send("date:spin", { seed, where, budget });
    run(seed, where, budget, false);
  };

  const shown = reel ?? result;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where">
        {WHERE.map((w) => (
          <button key={w.key} type="button" role="radio" aria-checked={where === w.key} onClick={() => setWhere(w.key)} disabled={spinning} className={cn("rounded-full border-[1.5px] px-4 py-2 text-[0.9rem] font-semibold", where === w.key ? "border-line-strong bg-fg text-bg" : "border-line")}>
            {w.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Budget, up to">
        <span className="text-[0.85rem] text-muted">Up to</span>
        {BUDGET.map((label, i) => (
          <button key={label} type="button" role="radio" aria-checked={budget === i} onClick={() => setBudget(i)} disabled={spinning} className={cn("rounded-full border px-3 py-1.5 text-[0.85rem]", budget === i ? "border-line-strong font-bold" : "border-line")}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[0.8rem] text-muted tabular">{pool.length} ideas</span>
      </div>

      <div className="relative flex min-h-[17rem] flex-col justify-center overflow-hidden rounded-[26px] border-[1.5px] border-line-strong bg-raised p-7" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {shown ? (
            <motion.div key={`${shown.title}-${result ? "r" : "s"}`} initial={{ y: reel ? 30 : 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }} transition={reel ? { duration: 0.06 } : { type: "spring", stiffness: 260, damping: 18 }}>
              <p className="eyebrow" style={{ color: "var(--cat-romantic-ink)" }}>
                {shown.where === "home" ? "At home" : shown.where === "out" ? "Going out" : "Long-distance"} · {BUDGET[shown.budget]}
              </p>
              <h2 className={cn("display mt-3 text-[clamp(2rem,7vw,3rem)] leading-tight", reel && "opacity-60")}>{shown.title}</h2>
              {result ? <p className="mt-3 text-[1.05rem] leading-relaxed text-muted">{shown.detail}</p> : null}
            </motion.div>
          ) : (
            <motion.p key="empty" className="display text-center text-[1.8rem] text-muted">
              Tonight&apos;s plan is one spin away.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" variant="accent" icon="refresh" onClick={spin} disabled={spinning || !pool.length}>
          {result ? "Spin again" : "Spin"}
        </Button>
        {result ? (
          <Button
            size="lg"
            variant="outline"
            loading={saving}
            onClick={() =>
              startSave(async () => {
                const r = await addBucketItem({ title: result.title, note: result.detail, category: result.where === "home" ? "home" : "adventure" });
                if (r.ok) toast.success("Added to your bucket list.", "No take-backs.");
                else toast.error(r.error);
              })
            }
          >
            Save to bucket list
          </Button>
        ) : null}
      </div>
    </div>
  );
}