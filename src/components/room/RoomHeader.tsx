"use client";

import Link from "next/link";
import { Avatar } from "@/design/Avatar";
import { LogoMark } from "@/design/Logo";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { gameMeta } from "@/games/catalog";

export function RoomHeader() {
  const { bundle, partnerPresence } = useRoom();
  const { room, me, partner } = bundle;
  const partnerOnline = !!partnerPresence;
  const activity = partnerPresence
    ? partnerPresence.where === "game" && partnerPresence.gameId
      ? `playing ${gameMeta(partnerPresence.gameId)?.name ?? "a game"}`
      : partnerPresence.where === "afterdark"
        ? "in the room"
        : "in the room"
    : "away";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-8">
        <Link href={`/room/${room.id}`} className="flex min-w-0 items-center gap-2.5 rounded-md" aria-label="Room home">
          <LogoMark size={26} />
          <span className="display truncate text-[1.25rem]">{room.name}</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[0.82rem] font-semibold leading-tight">{partner?.profile.display_name ?? "Waiting for your person"}</p>
            <p className="text-[0.75rem] leading-tight text-muted" aria-live="polite">{partner ? activity : "invite pending"}</p>
          </div>
          <div className="flex -space-x-2">
            <Avatar name={me.profile.display_name} motif={me.profile.avatar_key} hue={me.profile.avatar_hue} size={34} />
            {partner ? (
              <Avatar name={partner.profile.display_name} motif={partner.profile.avatar_key} hue={partner.profile.avatar_hue} size={34} online={partnerOnline} />
            ) : (
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-dashed border-muted text-muted" aria-label="Empty seat">
                <Icon name="plus" size={16} />
              </span>
            )}
          </div>
          <Link href={`/room/${room.id}/settings`} aria-label="Room settings" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunk">
            <Icon name="settings" size={20} />
          </Link>
        </div>
      </div>
    </header>
  );
}