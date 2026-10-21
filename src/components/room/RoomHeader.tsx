"use client";

import Link from "next/link";
import { Avatar } from "@/design/Avatar";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { gameMeta } from "@/games/catalog";
import { Chat } from "@/components/chat/Chat";
import { NudgeButton } from "./Nudge";
import { RoomSwitcher } from "./RoomSwitcher";

export function RoomHeader({ feedbackUnread = 0 }: { feedbackUnread?: number }) {
  const { bundle, partnerPresence } = useRoom();
  const { room, me, partner } = bundle;
  const friendsRoom = room.kind === "friends";
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
        <RoomSwitcher />
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {friendsRoom ? <FriendFaces /> : null}
          <div className={friendsRoom ? "hidden" : "hidden text-right sm:block"}>
            <p className="text-[0.82rem] font-semibold leading-tight">{partner?.profile.display_name ?? "Waiting for your person"}</p>
            <p className="text-[0.75rem] leading-tight text-muted" aria-live="polite">{partner ? activity : "invite pending"}</p>
          </div>
          <div className={friendsRoom ? "hidden" : "flex -space-x-2"}>
            <Avatar name={me.profile.display_name} motif={me.profile.avatar_key} hue={me.profile.avatar_hue} size={34} />
            {partner ? (
              <Avatar name={partner.profile.display_name} motif={partner.profile.avatar_key} hue={partner.profile.avatar_hue} size={34} online={partnerOnline} />
            ) : (
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-dashed border-muted text-muted" aria-label="Empty seat">
                <Icon name="plus" size={16} />
              </span>
            )}
          </div>
          {friendsRoom ? null : <NudgeButton />}
          <Chat />
          <Link
            href={feedbackUnread ? `/room/${room.id}/settings#feedback` : `/room/${room.id}/settings`}
            aria-label={feedbackUnread ? "Room settings, new reply from the Amah team" : "Room settings"}
            className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunk"
          >
            <Icon name="settings" size={20} />
            {feedbackUnread ? <span aria-hidden className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" /> : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Friend rooms: up to four faces, then a count. */
function FriendFaces() {
  const { members } = useRoom().bundle;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2" role="img" aria-label={`${members.length} ${members.length === 1 ? "person" : "people"} in this room`}>
        {members.slice(0, 4).map((m) => (
          <Avatar key={m.profile.id} name={m.profile.display_name} motif={m.profile.avatar_key} hue={m.profile.avatar_hue} size={34} />
        ))}
      </div>
      {members.length > 4 ? <span className="text-[0.82rem] font-semibold text-muted">+{members.length - 4}</span> : null}
    </div>
  );
}
