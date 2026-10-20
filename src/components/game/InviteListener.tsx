"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/design/toast";
import { gameMeta } from "@/games/catalog";
import { inviteEvent } from "@/lib/games/types";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { playSound } from "@/lib/sound";

/** Turns a partner's "game:invite" broadcast into a toast with a Join button. */
export function InviteListener() {
  const { on, bundle } = useRoom();
  const router = useRouter();
  const pathname = usePathname();
  const partnerName = bundle.partner?.profile.display_name ?? "Your partner";
  const soundOn = bundle.me.member.sound_enabled;

  useEffect(
    () =>
      on("game:invite", (raw) => {
        const parsed = inviteEvent.safeParse(raw);
        if (!parsed.success) return;
        const { sessionId, gameId, rematch } = parsed.data;
        const href = `/room/${bundle.room.id}/play/${sessionId}`;
        if (pathname === href) return;
        const meta = gameMeta(gameId);
        // After Dark invites never name the game: a toast can be seen over a shoulder.
        const name = meta?.category === "spicy" ? "Tap to join" : (meta?.name ?? "a game");
        if (soundOn) playSound("invite");
        toast.invite(meta?.category === "spicy" ? `${partnerName} sent you an invite` : rematch ? `${partnerName} wants a rematch` : `${partnerName} wants to play`, name, {
          label: "Join",
          onClick: () => router.push(href),
        });
      }),
    [on, bundle.room.id, partnerName, pathname, router, soundOn],
  );

  return null;
}