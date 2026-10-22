"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/design/toast";
import { gameMeta } from "@/games/catalog";
import { inviteEvent } from "@/lib/games/types";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { playSound } from "@/lib/sound";
import { TIMED_TOURS } from "@/games/tours";
import { GameTour, isTourDue } from "./GameTour";

/**
 * Turns a "game:invite" broadcast into a toast with a Join button. In a friend room the whole room
 * hears the broadcast, so only the invited person sees it, and never from someone they've blocked.
 */
export function InviteListener() {
  const { on, bundle } = useRoom();
  const router = useRouter();
  const pathname = usePathname();
  const me = bundle.me.profile.id;
  const soundOn = bundle.me.member.sound_enabled;
  const { members, blocked } = bundle;
  const toured = bundle.me.profile.toured_games;
  // Joining a timed game for the first time: how to play first, then into the game.
  const [preTour, setPreTour] = useState<{ gameId: string; sessionId: string; href: string } | null>(null);

  useEffect(
    () =>
      on("game:invite", (raw, from) => {
        const parsed = inviteEvent.safeParse(raw);
        if (!parsed.success) return;
        const { sessionId, gameId, rematch, to } = parsed.data;
        if (to && !to.includes(me)) return;
        if (blocked.includes(from)) return;
        const partnerName = members.find((m) => m.profile.id === from)?.profile.display_name ?? "Your partner";
        const href = `/room/${bundle.room.id}/play/${sessionId}`;
        if (pathname === href) return;
        const meta = gameMeta(gameId);
        // After Dark invites never name the game: a toast can be seen over a shoulder.
        const name = meta?.category === "spicy" ? "Tap to join" : (meta?.name ?? "a game");
        if (soundOn) playSound("invite");
        toast.invite(meta?.category === "spicy" ? `${partnerName} sent you an invite` : rematch ? `${partnerName} wants a rematch` : `${partnerName} wants to play`, name, {
          label: "Join",
          onClick: () => (TIMED_TOURS.has(gameId) && isTourDue(gameId, toured) ? setPreTour({ gameId, sessionId, href }) : router.push(href)),
        });
      }),
    [on, bundle.room.id, me, members, blocked, pathname, router, soundOn, toured],
  );

  if (!preTour) return null;
  return (
    <GameTour
      gameId={preTour.gameId}
      sessionId={preTour.sessionId}
      onDone={() => {
        router.push(preTour.href);
        setPreTour(null);
      }}
    />
  );
}