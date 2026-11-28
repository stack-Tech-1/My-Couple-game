"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { startCheckout, startTrial } from "@/lib/plus/actions";
import { PAYMENTS_PAUSED, PLANS, TRIAL_DAYS, naira, type PlanId, type Period } from "@/lib/plus/plans";
import { goldButton, goldStyle } from "./PlusTag";

type Props = {
  /** None: bought from Solo with no room, so only "Just me". */
  roomId?: string;
  roomKind?: "couple" | "friends";
  /** Couple rooms: the partner's name, if they've joined. */
  partnerName?: string | null;
  trialAvailable: boolean;
  /** Buying a seat for someone else. */
  giftTo?: { id: string; name: string };
};

/** Pick a plan and pay, or start the free trial. Used in the upgrade sheet, Settings and gifting. */
export function PlusPlans({ roomId, roomKind, partnerName, trialAvailable, giftTo }: Props) {
  const router = useRouter();
  const options: PlanId[] = giftTo ? ["gift"] : !roomId ? ["single"] : roomKind === "couple" ? (partnerName ? ["couple", "single"] : ["single"]) : ["single", "group3", "group5", "group8"];
  const [plan, setPlan] = useState<PlanId>(options[0]!);
  const [period, setPeriod] = useState<Period>("month");
  const [busy, setBusy] = useState<"trial" | "card" | "pass" | null>(null);
  const [paused, setPaused] = useState(false);
  const price = PLANS[plan][period];
  const per = period === "month" ? "/mo" : "/yr";

  const hint = (p: PlanId) =>
    p === "couple" ? `You and ${partnerName}, every room you're in` : p === "single" && roomKind === "couple" && partnerName ? `${partnerName} would need their own` : p === "gift" ? `Plus for ${giftTo?.name}, in every room` : PLANS[p].hint;

  async function pay(method: "card" | "pass") {
    setBusy(method);
    setPaused(false);
    const [r] = await Promise.all([
      startCheckout({ plan, period, method, roomId, ...(giftTo ? { giftTo: giftTo.id } : {}), ...(plan.startsWith("group") ? { includeMe: true } : {}) }),
      // Long enough to read "Processing".
      new Promise((done) => setTimeout(done, 1200)),
    ]);
    if (!r.ok && r.error === PAYMENTS_PAUSED) {
      setPaused(true);
      setBusy(null);
      return;
    }
    if (!r.ok) {
      toast.error(r.error);
      setBusy(null);
      return;
    }
    window.location.assign(r.data.url);
  }

  async function trial() {
    setBusy("trial");
    const r = await startTrial();
    setBusy(null);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Your ${TRIAL_DAYS} days of Plus have started.`);
    router.refresh();
  }

  return (
    <div>
      <div role="radiogroup" aria-label="How often" className="flex rounded-full bg-[rgba(28,20,22,.08)] p-1">
        {(["month", "year"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn("flex-1 rounded-full py-2 text-[0.85rem] font-extrabold", period === p ? "bg-raised text-fg shadow-[0_2px_6px_rgba(28,20,22,.15)]" : "text-muted")}
          >
            {p === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Plan" className="mt-3 flex flex-col gap-2.5">
        {options.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={plan === p}
            onClick={() => setPlan(p)}
            className={cn(
              "flex items-center gap-3 rounded-[18px] border-[1.5px] px-4 py-3 text-left transition-colors",
              plan === p ? "border-[#2a1f4e] bg-raised shadow-[0_0_0_3px_rgba(217,164,58,.45)] dark:border-[#f6d26a]" : "border-line hover:border-line-strong",
            )}
          >
            <span aria-hidden className={cn("relative h-5 w-5 shrink-0 rounded-full border-2", plan === p ? "border-[#2a1f4e] dark:border-[#f6d26a]" : "border-muted")}>
              {plan === p ? <span className="absolute inset-[3px] rounded-full bg-[#2a1f4e] dark:bg-[#f6d26a]" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{p === "gift" ? `A seat for ${giftTo?.name}` : PLANS[p].label}</span>
              <span className="block text-[0.8rem] text-muted">{hint(p)}</span>
            </span>
            <span className="display shrink-0 text-[1.2rem]">
              {naira(PLANS[p][period])}
              <span className="font-sans text-[0.75rem] text-muted">{per}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {trialAvailable && !giftTo ? (
          <button type="button" className={goldButton} style={goldStyle} disabled={!!busy} onClick={() => void trial()}>
            {busy === "trial" ? "Starting…" : `Try Plus free for ${TRIAL_DAYS} days`}
          </button>
        ) : null}
        {giftTo ? (
          <Button size="lg" loading={busy === "pass"} disabled={!!busy} onClick={() => void pay("pass")}>
            {busy === "pass" ? "Processing…" : `Pay ${naira(price)}`}
          </Button>
        ) : (
          <>
            <Button size="lg" loading={busy === "card"} disabled={!!busy} onClick={() => void pay("card")}>
              {busy === "card" ? "Processing…" : `Pay ${naira(price)} by card`}
            </Button>
            <Button size="lg" variant="outline" loading={busy === "pass"} disabled={!!busy} onClick={() => void pay("pass")}>
              {busy === "pass" ? "Processing…" : "Pay once: transfer, USSD or card"}
            </Button>
          </>
        )}
      </div>
      {paused ? (
        <div role="status" className="cut-sm mt-3 border border-[#d9a43a] bg-[rgba(246,210,106,.18)] px-4 py-3 text-[0.9rem]">
          <p className="font-bold">Payments are opening very soon</p>
          <p className="mt-1 text-muted">We&apos;re finishing verification with Paystack, our payment provider, so card and transfer payments aren&apos;t open yet. Nothing has been charged. You&apos;ll be able to pay right here as soon as it&apos;s done.</p>
          {trialAvailable && !giftTo ? <p className="mt-1.5 font-semibold">Meanwhile, you can try Plus free for {TRIAL_DAYS} days.</p> : null}
        </div>
      ) : null}
      <p className="mt-3 text-center text-[0.8rem] leading-relaxed text-muted">
        {giftTo
          ? "Paid once by transfer, USSD or card. Nothing renews."
          : `Card: renews ${period === "month" ? "monthly" : "yearly"}, cancel any time. Pay once: no renewal, we'll remind you before it ends.`}
        <br />
        Payments are handled by Paystack. See our <a href="/terms#payments" className="underline">refund policy</a>.
      </p>
    </div>
  );
}
