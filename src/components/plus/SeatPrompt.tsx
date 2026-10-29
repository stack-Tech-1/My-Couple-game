"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/design/Avatar";
import { IconButton } from "@/design/Button";
import { toast } from "@/design/toast";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { giveSeat } from "@/lib/plus/actions";
import { goldStyle } from "./PlusTag";

const DISMISS_KEY = "amah:seat-prompt-dismissed";

/** Friend rooms: when you have group seats waiting and someone here has no Plus, offer one tap to give it. */
export function SeatPrompt() {
  const router = useRouter();
  const { bundle } = useRoom();
  const [pending, start] = useTransition();
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]);
    } catch {
      // Storage blocked: the prompt just shows.
    }
  }, []);

  const seats = bundle.plus.seatsToGive;
  if (!bundle.plus.live || !seats || seats.left < 1) return null;
  // Newest first: the person who most likely just joined.
  const who = [...bundle.members]
    .reverse()
    .find((m) => m.profile.id !== bundle.me.profile.id && !bundle.plus.until[m.profile.id] && !bundle.blocked.includes(m.profile.id) && !dismissed.includes(m.profile.id));
  if (!who) return null;
  const name = who.profile.display_name;
  const justJoined = Date.now() - Date.parse(who.member.joined_at) < 3 * 864e5;

  const dismiss = () => {
    const next = [...dismissed, who.profile.id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // Fine: it just shows again next time.
    }
  };

  return (
    <div role="status" className="flex items-center gap-3 rounded-[22px] bg-[#2a1f4e] py-2.5 pl-3 pr-2 text-[#f6efe6] shadow-[0_16px_30px_-18px_rgba(42,31,78,.9)]">
      <Avatar name={name} motif={who.profile.avatar_key} hue={who.profile.avatar_hue} size={34} />
      <p className="min-w-0 flex-1 text-[0.88rem]">
        <b>{justJoined ? `${name} just joined.` : `${name} doesn't have Plus.`}</b> Give {name} a seat?
      </p>
      <button
        type="button"
        disabled={pending}
        className="rounded-full px-3.5 py-1.5 text-[0.85rem] font-extrabold text-[#2a1f4e] disabled:opacity-50"
        style={goldStyle}
        onClick={() =>
          start(async () => {
            const r = await giveSeat(seats.purchaseId, who.profile.id);
            if (!r.ok) return void toast.error(r.error);
            toast.success(`${name} has Plus now.`);
            router.refresh();
          })
        }
      >
        Give
      </button>
      <IconButton icon="close" label="Not now" onClick={dismiss} className="text-[#f6efe6]" />
    </div>
  );
}
