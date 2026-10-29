"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { Avatar } from "@/design/Avatar";
import { toast } from "@/design/toast";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { cancelRenewal, changeCardLink, startCheckout } from "@/lib/plus/actions";
import { PLANS, naira, type Period, type PlanId } from "@/lib/plus/plans";
import { PlusPlans } from "./PlusPlans";

type Props = {
  roomId: string;
  roomKind: "couple" | "friends";
  partnerName: string | null;
  renewing: { plan: PlanId; period: Period; cardLast4: string | null; endsOn: string | null } | null;
  hasPlus: boolean;
};

/** The list of things you can do with your Plus: extend, gift, change card, cancel. */
export function PlusManage({ roomId, roomKind, partnerName, renewing, hasPlus }: Props) {
  const router = useRouter();
  const { bundle } = useRoom();
  const [open, setOpen] = useState<"extend" | "gift" | "cancel" | "yearly" | null>(null);
  const [giftTo, setGiftTo] = useState<{ id: string; name: string } | null>(null);
  const [pending, start] = useTransition();
  const me = bundle.me.profile.id;
  const needSeats = bundle.members.filter((m) => m.profile.id !== me && !bundle.plus.until[m.profile.id] && !bundle.blocked.includes(m.profile.id));

  const close = () => {
    setOpen(null);
    setGiftTo(null);
  };

  const rows: { label: string; detail: string; onClick: () => void; danger?: boolean }[] = [];
  if (hasPlus && !renewing) rows.push({ label: "Add more time", detail: "Starts when your Plus ends", onClick: () => setOpen("extend") });
  if (bundle.members.length > 1) rows.push({ label: "Buy a seat for a friend", detail: naira(PLANS.gift.month), onClick: () => setOpen("gift") });
  // Groups share one end date, so they switch by cancelling and buying again when it runs out.
  if (renewing && renewing.period === "month" && !renewing.plan.startsWith("group")) rows.push({ label: "Switch to yearly", detail: `${naira(PLANS[renewing.plan].year)}/yr`, onClick: () => setOpen("yearly") });
  if (renewing) {
    rows.push({
      label: "Change card",
      detail: renewing.cardLast4 ? `Card ending ${renewing.cardLast4}` : "On Paystack",
      onClick: () =>
        start(async () => {
          const r = await changeCardLink();
          if (!r.ok) return void toast.error(r.error);
          window.location.assign(r.data.url);
        }),
    });
    rows.push({ label: "Cancel renewal", detail: renewing.endsOn ? `Plus stays until ${renewing.endsOn}` : "Plus stays until the period ends", onClick: () => setOpen("cancel"), danger: true });
  }
  if (!rows.length) return null;

  return (
    <>
      <ul className="glass mt-4 rounded-[22px] px-4">
        {rows.map((r) => (
          <li key={r.label} className="border-t border-line first:border-t-0">
            <button type="button" onClick={r.onClick} disabled={pending} className="flex w-full items-center gap-3 py-3.5 text-left">
              <span className={`flex-1 font-semibold ${r.danger ? "text-accent-ink" : ""}`}>{r.label}</span>
              <span className="text-[0.82rem] text-muted">{r.detail}</span>
            </button>
          </li>
        ))}
      </ul>

      <Modal open={open === "extend"} onClose={close} title="Add more time" description="It starts when your current Plus ends, so you never pay twice for the same days.">
        <PlusPlans roomId={roomId} roomKind={roomKind} partnerName={partnerName} trialAvailable={false} />
      </Modal>

      <Modal open={open === "gift"} onClose={close} title={giftTo ? `A seat for ${giftTo.name}` : "Buy a seat for a friend"} description={giftTo ? "Plus for them in every room they're in." : "Pick who it's for."}>
        {giftTo ? (
          <PlusPlans roomId={roomId} roomKind={roomKind} trialAvailable={false} giftTo={giftTo} />
        ) : needSeats.length ? (
          <ul className="flex flex-col gap-2">
            {needSeats.map((m) => (
              <li key={m.profile.id}>
                <button type="button" onClick={() => setGiftTo({ id: m.profile.id, name: m.profile.display_name })} className="flex w-full items-center gap-3 rounded-[14px] border-[1.5px] border-line px-3 py-2.5 text-left font-semibold hover:border-line-strong">
                  <Avatar name={m.profile.display_name} motif={m.profile.avatar_key} hue={m.profile.avatar_hue} size={32} />
                  {m.profile.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Everyone in this room already has Plus.</p>
        )}
      </Modal>

      <Modal open={open === "yearly"} onClose={close} title="Switch to yearly?" description={renewing ? `Your monthly renewal stops. The yearly plan, ${naira(PLANS[renewing.plan].year)}, starts when this month ends${renewing.endsOn ? ` (${renewing.endsOn})` : ""}, so nothing overlaps.` : ""}>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={close}>Not now</Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                if (!renewing) return;
                const c = await cancelRenewal();
                if (!c.ok) return void toast.error(c.error);
                const r = await startCheckout({ plan: renewing.plan, period: "year", method: "card", roomId });
                if (!r.ok) return void toast.error(r.error);
                window.location.assign(r.data.url);
              })
            }
          >
            Switch and pay
          </Button>
        </div>
      </Modal>

      <Modal open={open === "cancel"} onClose={close} title="Cancel renewal?" description={`Your card won't be charged again. Plus stays on${renewing?.endsOn ? ` until ${renewing.endsOn}` : " until the end of what you've paid for"}, then the Plus games lock. Nothing you've made is deleted.`}>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={close}>Keep it</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await cancelRenewal();
                if (!r.ok) return void toast.error(r.error);
                toast.success("Renewal cancelled.", "You keep Plus until the end of what you've paid for.");
                close();
                router.refresh();
              })
            }
          >
            Cancel renewal
          </Button>
        </div>
      </Modal>
    </>
  );
}
