"use client";

import Link from "next/link";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { PLANS, TRIAL_DAYS, naira } from "@/lib/plus/plans";
import { PlusPanel, PlusTag, goldButton, goldStyle } from "./PlusTag";

/**
 * On a room's home: the way to Amah Plus, with the plans that fit this room. A couple room offers
 * Plus for both of you (or just you); a friend room offers seats for the group (3, 5 or 8) or just
 * you. Hidden until Plus opens, and once everyone here has it.
 */
export function RoomPlusCard() {
  const { bundle } = useRoom();
  const { plus, room, members, me } = bundle;
  if (!plus.live) return null;
  const without = members.filter((m) => !plus.until[m.profile.id]);
  if (!without.length) return null;
  const mine = !!plus.until[me.profile.id];
  const href = `/room/${room.id}/settings/plus`;
  const friends = room.kind === "friends";
  const partner = bundle.partner?.profile.display_name;

  const title = friends ? "Amah Plus for the group" : mine ? `Plus for ${partner ?? "your person"} too` : "Amah Plus for both of you";
  const line = friends
    ? `Seats for the people here: 3 for ${naira(PLANS.group3.month)}, 5 for ${naira(PLANS.group5.month)} or 8 for ${naira(PLANS.group8.month)} a month. Or just you, ${naira(PLANS.single.month)}.`
    : mine
      ? `A seat for ${partner ?? "them"} is ${naira(PLANS.gift.month)} a month, so you can play every game together.`
      : `${naira(PLANS.couple.month)} a month for the two of you, or ${naira(PLANS.single.month)} for just you.`;

  return (
    <PlusPanel className="cut mt-6 p-5">
      <div className="flex items-center justify-between gap-3">
        <PlusTag />
        {plus.seatsToGive ? <span className="text-[0.82rem] font-bold text-[#f6d26a]">{plus.seatsToGive.left} seat{plus.seatsToGive.left === 1 ? "" : "s"} to give</span> : null}
      </div>
      <p className="display mt-2.5 text-[1.45rem] leading-tight">{title}</p>
      <p className="mt-1 text-[0.9rem] opacity-90">Every game, no daily limits, voice notes and stickers. {line}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link prefetch={false} href={href} className={goldButton} style={goldStyle}>
          {plus.seatsToGive ? "Give out seats" : "See plans and pay"}
        </Link>
        {!mine && !plus.trialUsed ? <span className="text-[0.85rem] opacity-85">Or try it free for {TRIAL_DAYS} days.</span> : null}
      </div>
    </PlusPanel>
  );
}
