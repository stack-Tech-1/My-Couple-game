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
import { TIMED_TOURS } from "@/games/tours";
import { GameTour, useTourDue } from "./GameTour";
import { Modal } from "@/design/Modal";
import { FREE_MAX_PLAYERS, PLANS, isPlusGame, naira } from "@/lib/plus/plans";
import { OutOfPlays, PlaysLeft } from "@/components/plus/OutOfPlays";
import { PlusTag } from "@/components/plus/PlusTag";
import { PlusPlans } from "@/components/plus/PlusPlans";

/** `plays`: today's free plays in this room (null when nothing is limited). */
export function StartGame({ gameId, activeSessionId, plays = null }: { gameId: string; activeSessionId: string | null; plays?: { left: number; resetsAt: string } | null }) {
  const router = useRouter();
  const { bundle, send } = useRoom();
  const [busy, setBusy] = useState(false);
  const modes = GAME_MODES[gameId];
  const [mode, setMode] = useState(0);
  // Timed games: the how-to-play tour comes before the game (and its clock) starts.
  const tourFirst = useTourDue(gameId) && TIMED_TOURS.has(gameId);
  const [preTour, setPreTour] = useState(false);
  const roomId = bundle.room.id;
  const friendsRoom = bundle.room.kind === "friends";
  const friends = bundle.members.filter((m) => m.profile.id !== bundle.me.profile.id && !bundle.blocked.includes(m.profile.id));
  // Group games let you pick several friends (up to the game's limit, you included).
  const meta = gameMeta(gameId);
  // A free friend room plays two at a time.
  const fullMax = friendsRoom ? (meta?.maxPlayers ?? 2) : 2;
  const max = plays ? Math.min(fullMax, FREE_MAX_PLAYERS) : fullMax;
  const min = meta?.minPlayers ?? 2;
  const group = max > 2;
  const [picked, setPicked] = useState<string[]>(friends.length === 1 ? [friends[0]!.profile.id] : []);
  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : group ? (cur.length < max - 1 ? [...cur, id] : cur) : [id]));
  const nameOf = (id: string) => friends.find((f) => f.profile.id === id)?.profile.display_name ?? "";
  const enough = picked.length + 1 >= min;
  // Amah Plus: everyone playing a Plus game needs it. Show who doesn't, with a way to buy them a seat.
  const plusGame = bundle.plus.live && isPlusGame(gameId);
  const lacks = (id: string) => plusGame && !bundle.plus.until[id];
  const players = friendsRoom ? picked : bundle.partner ? [bundle.partner.profile.id] : [];
  const waiting = players.filter(lacks);
  const [gift, setGift] = useState<{ id: string; name: string } | null>(null);
  const anyName = (id: string) => bundle.members.find((m) => m.profile.id === id)?.profile.display_name ?? "";
  const inviteLabel = waiting.length
    ? `Waiting on ${waiting.length} seat${waiting.length > 1 ? "s" : ""}`
    : !friendsRoom
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

  // Today's free plays are used up (a game already going can still be finished).
  if (plays && plays.left <= 0 && !activeSessionId) {
    return (
      <OutOfPlays
        gameName={meta?.name ?? "this game"}
        resetsAt={plays.resetsAt}
        plusHref={`/room/${roomId}/settings/plus`}
        onReopen={() => router.refresh()}
        openNow={[
          { label: "Other games", hint: "Each game has its own free plays", href: `/room/${roomId}/games` },
          ...(friendsRoom ? [] : [{ label: "Today's question", hint: "Always free, never limited", href: `/room/${roomId}/games/daily-question` }]),
          { label: "Solo games", hint: "Quick games on your own", href: "/solo" },
          { label: "Back to the room", hint: friendsRoom ? "Chat with everyone" : `Chat with ${bundle.partner?.profile.display_name ?? "your person"}`, href: `/room/${roomId}` },
        ]}
      />
    );
  }

  async function start(afterTour = false) {
    if (friendsRoom && (!picked.length || !enough)) return;
    if (tourFirst && !afterTour) {
      setPreTour(true);
      return;
    }
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
          {plays && fullMax > max ? <p className="-mt-1 mb-3 text-[0.85rem] text-muted">Free games are two at a time. With Amah Plus, up to {fullMax} can play together.</p> : null}
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
                {lacks(f.profile.id) ? <span className="text-[0.72rem] font-bold text-accent-ink">needs Plus</span> : null}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {waiting.length ? (
        <div role="group" aria-label="Who needs Plus" className="mt-6 rounded-[18px] border border-[rgba(217,164,58,.55)] bg-[rgba(217,164,58,.14)] p-3">
          <p className="flex items-center gap-2 text-[0.85rem] font-semibold">
            <PlusTag /> Everyone playing this one needs Amah Plus.
          </p>
          <ul className="mt-2">
            {waiting.map((id) => (
              <li key={id} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
                <span className="min-w-0 truncate font-semibold">
                  {anyName(id)} <span className="text-[0.8rem] font-bold text-accent-ink">needs Plus</span>
                </span>
                <button
                  type="button"
                  onClick={() => setGift({ id, name: anyName(id) })}
                  className="shrink-0 rounded-full bg-[#2a1f4e] px-3 py-1.5 text-[0.8rem] font-extrabold text-[#f6d26a]"
                >
                  Buy {anyName(id)} a seat · {naira(PLANS.gift.month)}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[0.8rem] text-muted">They can also start a free trial from any Plus game.</p>
          {friendsRoom && picked.length - waiting.length >= Math.max(1, min - 1) ? (
            <button type="button" className="mt-2 text-[0.85rem] font-bold underline" onClick={() => setPicked((cur) => cur.filter((p) => !lacks(p)))}>
              Play without them
            </button>
          ) : null}
        </div>
      ) : null}
      <Modal open={!!gift} onClose={() => setGift(null)} title={gift ? `A seat for ${gift.name}` : "A seat"} description="Plus for them in every room they're in, for a month or a year.">
        {gift ? <PlusPlans roomId={roomId} roomKind={bundle.room.kind} trialAvailable={false} giftTo={gift} /> : null}
      </Modal>
      <div className="mt-8 flex flex-wrap gap-3">
        {activeSessionId ? (
          <Button size="lg" variant="accent" iconRight="arrowRight" onClick={() => router.push(`/room/${roomId}/play/${activeSessionId}`)}>
            Resume game
          </Button>
        ) : null}
        <Button size="lg" variant={activeSessionId ? "outline" : "accent"} iconRight={activeSessionId ? undefined : "arrowRight"} loading={busy} disabled={(friendsRoom && (!picked.length || !enough)) || waiting.length > 0} onClick={() => void start()}>
          {activeSessionId ? "Start over" : inviteLabel}
        </Button>
      </div>
      {plays && plays.left > 0 ? <PlaysLeft left={plays.left} /> : null}
      {preTour ? (
        <GameTour
          gameId={gameId}
          onDone={() => {
            setPreTour(false);
            void start(true);
          }}
        />
      ) : null}
    </>
  );
}
