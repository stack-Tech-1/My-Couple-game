"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { gameApi } from "@/lib/games/client";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { track } from "@/lib/analytics";

export function StartGame({ gameId, activeSessionId }: { gameId: string; activeSessionId: string | null }) {
  const router = useRouter();
  const { bundle, send } = useRoom();
  const [busy, setBusy] = useState(false);
  const roomId = bundle.room.id;

  if (!bundle.partner) {
    return <p className="mt-8 text-muted">This one needs two. Invite your person from the room home first.</p>;
  }

  async function start() {
    setBusy(true);
    try {
      const s = await gameApi.create(gameId);
      send("game:invite", { sessionId: s.id, gameId });
      track("game_started", { game: gameId });
      router.push(`/room/${roomId}/play/${s.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the game.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {activeSessionId ? (
        <Button size="lg" variant="accent" iconRight="arrowRight" onClick={() => router.push(`/room/${roomId}/play/${activeSessionId}`)}>
          Resume game
        </Button>
      ) : null}
      <Button size="lg" variant={activeSessionId ? "outline" : "accent"} iconRight={activeSessionId ? undefined : "arrowRight"} loading={busy} onClick={start}>
        {activeSessionId ? "Start over" : `Invite ${bundle.partner.profile.display_name}`}
      </Button>
    </div>
  );
}