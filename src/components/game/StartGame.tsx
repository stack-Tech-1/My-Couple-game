"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { gameApi } from "@/lib/games/client";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { track } from "@/lib/analytics";
import { GAME_MODES } from "@/games/modes";
import { cn } from "@/lib/cn";
import { Avatar } from "@/design/Avatar";
import { gameMeta } from "@/games/catalog";

export function StartGame({ gameId, activeSessionId }: { gameId: string; activeSessionId: string | null }) {
  const router = useRouter();
  const { bundle, send } = useRoom();
  const [busy, setBusy] = useState(false);
  const modes = GAME_MODES[gameId];
  const [mode, setMode] = useState(0);
  const roomId = bundle.room.id;
  const friendsRoom = bundle.room.kind === "friends";
  const friends = bundle.members.filter((m) => m.profile.id !== bundle.me.profile.id && !bundle.blocked.includes(m.profile.id));
  // Group games let you pick several friends (up to the game's limit, you included).
  const meta = gameMeta(gameId);
  const max = friendsRoom ? (meta?.maxPlayers ?? 2) : 2;
  const min = meta?.minPlayers ?? 2;
  const group = max > 2;
  const [picked, setPicked] = useState<string[]>(friends.length === 1 ? [friends[0]!.profile.id] : []);
  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : group ? (cur.length < max - 1 ? [...cur, id] : cur) : [id]));
  const nameOf = (id: string) => friends.find((f) => f.profile.id === id)?.profile.display_name ?? "";
  const enough = picked.length + 1 >= min;
  const inviteLabel = !friendsRoom
    ? `Invite ${bundle.partner?.profile.display_name ?? ""}`
    : !picked.length
      ? group
        ? "Pick friends"
        : "Pick a friend"
      : !enough
        ? `Pick at least ${min - 1} friends`
        : picked.length === 1
          ? `Invite ${nameOf(picked[0]!)}`
          : `Invite ${picked.length} friends`;

  if (friendsRoom ? !friends.length || friends.length + 1 < min : !bundle.partner) {
    return (
      <p className="mt-8 text-muted">
        {friendsRoom
          ? min > 2
            ? `This one needs at least ${min} people in the room. Invite more friends first.`
            : "This one needs two. Invite a friend to the room first."
          : "This one needs two. Invite your person from the room home first."}
      </p>
    );
  }

  async function start() {
    if (friendsRoom && (!picked.length || !enough)) return;
    setBusy(true);
    try {
      const s = await gameApi.create(gameId, {
        ...(modes ? { config: { [modes.key]: modes.options[mode]!.value } } : {}),
        roomId,
        ...(friendsRoom ? { opponents: picked } : {}),
      });
      send("game:invite", { sessionId: s.id, gameId, ...(friendsRoom ? { to: picked } : {}) });
      track("game_started", { game: gameId });
      router.push(`/room/${roomId}/play/${s.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the game.");
      setBusy(false);
    }
  }

  return (
    <>
      {modes ? (
        <fieldset className="mt-8">
          <legend className="eyebrow mb-3 text-muted">Mode</legend>
          <div role="radiogroup" aria-label="Mode" className="grid gap-2.5 sm:grid-cols-2">
            {modes.options.map((o, i) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={mode === i}
                onClick={() => setMode(i)}
                className={cn("rounded-[14px] border-[1.5px] px-4 py-3 text-left transition-colors", mode === i ? "border-fg bg-sunk" : "border-line hover:border-line-strong")}
              >
                <span className="block font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-[0.85rem] text-muted">{o.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {friendsRoom ? (
        <fieldset className="mt-8">
          <legend className="eyebrow mb-3 text-muted">{group ? `Play with (up to ${max - 1})` : "Play with"}</legend>
          <div role={group ? "group" : "radiogroup"} aria-label="Play with" className="flex flex-wrap gap-2.5">
            {friends.map((f) => (
              <button
                key={f.profile.id}
                type="button"
                role={group ? "checkbox" : "radio"}
                aria-checked={picked.includes(f.profile.id)}
                onClick={() => toggle(f.profile.id)}
                className={cn("flex items-center gap-2 rounded-full border-[1.5px] py-1.5 pl-1.5 pr-4 font-semibold transition-colors", picked.includes(f.profile.id) ? "border-fg bg-sunk" : "border-line hover:border-line-strong")}
              >
                <Avatar name={f.profile.display_name} motif={f.profile.avatar_key} hue={f.profile.avatar_hue} size={30} />
                {f.profile.display_name}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        {activeSessionId ? (
          <Button size="lg" variant="accent" iconRight="arrowRight" onClick={() => router.push(`/room/${roomId}/play/${activeSessionId}`)}>
            Resume game
          </Button>
        ) : null}
        <Button size="lg" variant={activeSessionId ? "outline" : "accent"} iconRight={activeSessionId ? undefined : "arrowRight"} loading={busy} disabled={friendsRoom && (!picked.length || !enough)} onClick={start}>
          {activeSessionId ? "Start over" : inviteLabel}
        </Button>
      </div>
    </>
  );
}
