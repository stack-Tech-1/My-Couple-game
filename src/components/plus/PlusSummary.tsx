"use client";

import Link from "next/link";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { TRIAL_DAYS } from "@/lib/plus/plans";
import { PlusTag } from "./PlusTag";

export const plusDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

/** One line in Settings: your Plus, and the way to manage it. */
export function PlusSummary() {
  const { bundle } = useRoom();
  const me = bundle.me.profile.id;
  const until = bundle.plus.until[me];
  const trial = bundle.plus.trial.includes(me);
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 text-muted">
        {until ? (
          <>
            <PlusTag label={trial ? "Trial" : "Plus"} />
            <span>
              {trial ? "Your free trial" : "Your Plus"} runs until <b className="text-fg">{plusDate(until)}</b>.
            </span>
          </>
        ) : (
          <span>You&apos;re on the free plan. {bundle.plus.trialUsed ? "Plus opens every game, voice notes and stickers." : `Try Plus free for ${TRIAL_DAYS} days.`}</span>
        )}
      </p>
      <Link prefetch={false} href={`/room/${bundle.room.id}/settings/plus`} className="mt-4 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
        {until ? "Manage Amah Plus" : "See Amah Plus"} <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}
