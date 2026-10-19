"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { answerDaily } from "@/lib/daily/actions";
import type { DailyState } from "@/lib/daily/server";
import { cn } from "@/lib/cn";

/** Today's question. Each answer stays sealed until both of you have answered. */
export function DailyQuestion({ daily, full = false }: { daily: DailyState; full?: boolean }) {
  const { bundle, send, on } = useRoom();
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const partnerName = bundle.partner?.profile.display_name ?? "your partner";

  // The partner's answer is invisible to us until we've both answered, so they ping us instead.
  useEffect(() => on("daily:answered", () => router.refresh()), [on, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await answerDaily(bundle.room.id, text);
      if (!res.ok) return void toast.error(res.error);
      send("daily:answered", {});
      setText("");
      router.refresh();
    });
  };

  const both = !!daily.mine && !!daily.theirs;

  return (
    <section aria-labelledby="daily-h" className={cn("rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6", full && "sm:p-8")}>
      <div className="flex items-center justify-between gap-3">
        <p id="daily-h" className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>
          Today&apos;s question
        </p>
        <p className="flex items-center gap-1.5 text-[0.82rem] font-semibold" aria-label={`${daily.streak} day streak`}>
          <Icon name="flame" size={16} className={daily.streak ? "text-accent" : "text-muted"} />
          <span className="tabular">{daily.streak}</span> day{daily.streak === 1 ? "" : "s"}
        </p>
      </div>
      <h2 className={cn("display mt-3 leading-tight", full ? "text-[clamp(2rem,7vw,3rem)]" : "text-[1.7rem]")}>{daily.question}</h2>

      <AnimatePresence mode="wait">
        {!daily.mine ? (
          <motion.form key="ask" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 flex flex-col gap-3">
            <label htmlFor="daily-answer" className="sr-only">
              Your answer
            </label>
            <textarea
              id="daily-answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={full ? 4 : 2}
              placeholder="Your answer stays sealed until they answer too."
              className="w-full rounded-[14px] border-[1.5px] border-line bg-bg px-4 py-3 focus:border-line-strong focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.85rem] text-muted">{daily.partnerAnswered ? `${partnerName} has answered. Your turn.` : `${partnerName} hasn't answered yet.`}</p>
              <Button type="submit" variant="accent" loading={pending} disabled={!text.trim()}>
                Seal it
              </Button>
            </div>
          </motion.form>
        ) : !both ? (
          <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 flex items-center gap-3 rounded-[14px] bg-sunk px-4 py-3">
            <Icon name="lock" size={18} />
            <p className="text-[0.92rem]">Sealed. You&apos;ll both see each other&apos;s answers when {partnerName} answers.</p>
          </motion.div>
        ) : (
          <motion.div key="both" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["You", daily.mine],
              [partnerName, daily.theirs],
            ].map(([who, a]) => (
              <div key={who} className="rounded-[14px] border border-line bg-bg p-4">
                <p className="eyebrow text-muted">{who}</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{a}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {full && daily.past.length ? (
        <div className="mt-10">
          <p className="eyebrow mb-3 text-muted">Earlier this week</p>
          <ul className="space-y-3">
            {daily.past.map((p) => (
              <li key={p.day} className="border-t border-line pt-3">
                <p className="text-[0.8rem] text-muted">{new Date(p.day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                <p className="font-semibold">{p.question}</p>
                <p className="mt-1 text-[0.92rem]">
                  <span className="text-muted">You:</span> {p.mine}
                </p>
                <p className="text-[0.92rem]">
                  <span className="text-muted">{partnerName}:</span> {p.theirs}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}