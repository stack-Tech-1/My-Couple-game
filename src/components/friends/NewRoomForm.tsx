"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Icon, type IconName } from "@/design/icons";
import { cn } from "@/lib/cn";
import { createRoom, joinRoom } from "@/lib/room/actions";
import { track } from "@/lib/analytics";
import { MAX_FRIEND_ROOMS } from "@/lib/room/types";

type Mode = "couple" | "friends" | "join";

/**
 * Start a couple room, start a friend room, or join one with a code. Used at the end of onboarding
 * and from "New room" later. Choices you can't take (a second couple room, a sixth friend room) are
 * shown but switched off, with the reason.
 */
export function NewRoomForm({ name, hasCouple, friendRooms, initialMode, onBack }: { name: string; hasCouple: boolean; friendRooms: number; initialMode?: Mode; onBack?: () => void }) {
  const router = useRouter();
  const friendsFull = friendRooms >= MAX_FRIEND_ROOMS;
  const [mode, setMode] = useState<Mode>(initialMode ?? (hasCouple ? (friendsFull ? "join" : "friends") : "couple"));
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options: [Mode, IconName, string, string, string | null][] = [
    ["couple", "heart", "A couple room", "Just the two of you", hasCouple ? "You already have one" : null],
    ["friends", "user", "A friend room", "Up to 8 people", friendsFull ? `You're in ${MAX_FRIEND_ROOMS} already` : null],
    ["join", "link", "I have a code", "Someone invited me", null],
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const fallback = mode === "couple" ? `${name.trim() || "Our"}'s room` : `${name.trim() || "Our"}'s crew`;
      const res = mode === "join" ? await joinRoom(code) : await createRoom(roomName.trim() || fallback, mode);
      if (!res.ok) return setError(res.error);
      track(mode === "join" ? "room_joined" : "room_created", { kind: mode });
      router.push(`/room/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div role="radiogroup" aria-label="What kind of room" className="grid gap-3 sm:grid-cols-3">
        {options.map(([k, icon, title, sub, off]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            disabled={!!off}
            onClick={() => setMode(k)}
            className={cn(
              "rounded-[16px] border-[1.5px] p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              mode === k ? "border-line-strong bg-raised" : "border-line hover:border-[color-mix(in_srgb,var(--line-strong)_40%,var(--line))]",
            )}
          >
            <Icon name={icon} size={24} className={mode === k ? "text-accent" : "text-muted"} />
            <p className="mt-3 font-bold">{title}</p>
            <p className="text-[0.85rem] text-muted">{off ?? sub}</p>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {mode === "join" ? (
          <TextField
            label="Invite code"
            placeholder="ABC234"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="tabular font-mono text-[1.4rem] tracking-[0.3em]"
          />
        ) : (
          <TextField
            label="Room name"
            placeholder={mode === "couple" ? `${name.trim() || "Our"}'s room` : `${name.trim() || "Our"}'s crew`}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={40}
            hint={mode === "couple" ? "You can change it later. Inside jokes encouraged." : "Your group chat name works well. Only you can change it later."}
          />
        )}
        {mode === "friends" ? (
          <p className="mt-4 text-[0.9rem] text-muted">Friend rooms get the games and a group chat. After Dark and the couple features stay in couple rooms.</p>
        ) : null}
      </div>

      {error ? <p role="alert" className="mt-6 font-medium text-accent-ink">{error}</p> : null}
      <div className="mt-auto flex gap-3 pt-12">
        {onBack ? <Button variant="ghost" size="lg" onClick={onBack} icon="arrowLeft">Back</Button> : null}
        <Button type="submit" size="lg" className="flex-1" loading={pending} disabled={mode === "join" && code.length !== 6}>
          {mode === "join" ? "Join the room" : "Open the room"}
        </Button>
      </div>
    </form>
  );
}
