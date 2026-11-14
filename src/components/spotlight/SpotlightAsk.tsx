"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { answerSpotlight } from "@/lib/engage/actions";

export type SpotlightAskItem = { id: string; kind: "couple" | "gang"; roomName: string; grade: string; stats: Record<string, number>; myAnswer: boolean | null };

/**
 * "You're in the running": ask before anyone is ever shown. Couples both have to say yes; in a
 * gang the owner says yes and anyone can say no. No answer counts as no.
 */
export function SpotlightAsk({ asks, names }: { asks: SpotlightAskItem[]; names: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [later, setLater] = useState<string[]>([]);
  const ask = asks.find((a) => a.myAnswer === null && !later.includes(a.id));
  if (!ask) return null;
  const couple = ask.kind === "couple";
  const s = ask.stats;

  const answer = (yes: boolean) =>
    start(async () => {
      const r = await answerSpotlight(ask.id, yes);
      if (!r.ok) return void toast.error(r.error);
      toast.success(yes ? "Thank you. Fingers crossed for Friday." : "Kept private. Nobody will see you.");
      router.refresh();
    });

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[rgba(28,20,22,.45)] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="spot-ask-h">
      <div className="w-full max-w-md rounded-t-[30px] bg-raised px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-20px_40px_-20px_rgba(0,0,0,.4)] sm:rounded-[30px]">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-line" aria-hidden />
        <p className="text-center">
          <span className="inline-block rounded-full bg-[#0d3b2e] px-3 py-1.5 text-[0.75rem] font-extrabold text-[#f6d26a]">YOUR WEEK GOT {ask.grade === "A+" || ask.grade === "A" ? "AN" : "A"} {ask.grade}</span>
        </p>
        <h2 id="spot-ask-h" className="display mt-3 text-center text-[1.8rem] leading-tight">
          {couple ? `${names} are in the running for Couple of the Week` : `${ask.roomName} is in the running for Gang of the Week`}
        </h2>
        <p className="mt-3 text-center text-[0.93rem] text-muted">
          If you win on Friday, can we show you on Amah for the week? Everyone would see {couple ? "your names, avatars" : "your room's name"} and this week&apos;s numbers. Never your chats, photos or answers.
        </p>
        <dl className="mt-4 grid gap-1 rounded-[16px] bg-sunk px-4 py-3 text-[0.88rem]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">This week</dt>
            <dd className="font-bold">{couple ? `${s.days ?? 0} of 7 days, ${s.games ?? 0} games` : `${s.games ?? 0} games, ${s.active ?? 0} of ${s.members ?? 0} playing`}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Needs</dt>
            <dd className="font-bold">{couple ? "Both of you to say yes" : "The owner's yes, and nobody's no"}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" loading={pending} onClick={() => answer(true)}>
            Yes, show us
          </Button>
          <Button size="lg" variant="ghost" disabled={pending} onClick={() => answer(false)}>
            Keep us private
          </Button>
          <button type="button" className="mt-1 text-[0.82rem] font-semibold text-muted underline" onClick={() => setLater((l) => [...l, ask.id])}>
            Decide later
          </button>
        </div>
        <p className="mt-3 text-center text-[0.78rem] text-muted">No answer by Friday morning counts as no, and it goes to the next {couple ? "couple" : "room"}. You can take a yes back any time.</p>
      </div>
    </div>
  );
}
