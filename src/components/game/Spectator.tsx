"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gameComponent } from "@/games/registry";
import { gameMeta, CATEGORIES } from "@/games/catalog";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { SessionSnapshot } from "@/lib/games/types";
import { GameBackdrop } from "./GameBackdrop";

/**
 * Watching a live friend-room game. The board is the game's own, inert (no taps, no focus), fed with
 * the outsider's view from the server. A session change (any move) triggers a refetch; a slow
 * poll covers anything realtime misses. Draw & Guess strokes arrive over the session broadcast.
 */
export function Spectator({ initial }: { initial: SessionSnapshot }) {
  const { bundle, on } = useRoom();
  const [snap, setSnap] = useState(initial);
  const { session } = snap;
  const sessionId = session.id;
  const me = bundle.me.profile.id;
  const meta = gameMeta(session.game_id);
  const Component = gameComponent(session.game_id);
  const names = useMemo(() => Object.fromEntries(bundle.members.map((m) => [m.profile.id, m.profile.display_name])), [bundle.members]);
  const offset = useRef((initial.serverNow ?? Date.now()) - Date.now());
  const clock = useCallback(() => Date.now() + offset.current, []);
  const live = session.status === "active";

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/watch`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const next = (await res.json()) as SessionSnapshot;
    if (next.serverNow) offset.current = next.serverNow - Date.now();
    setSnap((cur) => (next.version >= cur.version ? next : cur));
  }, [sessionId]);

  useEffect(() => {
    const sb = supabaseBrowser();
    let ch: ReturnType<typeof sb.channel> | undefined;
    let cancelled = false;
    void sb.realtime.setAuth().then(() => {
      if (cancelled) return;
      ch = sb
        .channel(`room:${session.room_id}:watch:${sessionId}`, { config: { private: true } })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, () => void refresh())
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (ch) void sb.removeChannel(ch);
    };
  }, [sessionId, session.room_id, refresh]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [live, refresh]);

  const broadcast = useMemo(
    () => ({ send: () => {}, on: (event: string, handler: (payload: unknown) => void) => on(`s:${sessionId}:${event}`, handler) }),
    [on, sessionId],
  );
  const noop = useCallback(async () => {}, []);
  const silent = useCallback(() => {}, []);

  if (!Component || !meta) return null;
  const cat = CATEGORIES[meta.category];
  const playing = session.players.map((p) => names[p] ?? "Someone");

  return (
    <div className="isolate pb-24 pt-4 sm:pt-6">
      {/* Watching sits on the same pattern as playing. */}
      <GameBackdrop gameId={session.game_id} category={meta.category} />
      <div className="glass mb-4 flex items-center justify-between gap-4 rounded-[22px] px-3 py-2.5 sm:mb-6">
        <Link prefetch={false} href={`/room/${session.room_id}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
          <Icon name="arrowLeft" size={16} /> Room
        </Link>
        <div className="text-center">
          <p className="eyebrow" style={{ color: cat.ink }}>Watching</p>
          <h1 className="display text-[1.6rem]">{meta.name}</h1>
        </div>
        <span className="w-[72px]" />
      </div>
      <p className="glass mb-4 rounded-[18px] px-4 py-3 text-center text-[0.9rem] sm:mb-6" role="status">
        {live ? (
          <>
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle" aria-hidden />
            Live: {playing.join(", ")}. You&apos;re watching, so hands and answers stay hidden.
          </>
        ) : (
          <>That game is over. {session.winner ? `${names[session.winner] ?? "Someone"} won.` : ""}</>
        )}
      </p>
      <div inert className="@container glass pointer-events-none select-none rounded-[28px] px-3 py-5 sm:px-6 sm:py-8">
        <Component view={snap.view} me={me} partner={session.players[0]!} names={names} sendMove={noop} pending={false} broadcast={broadcast} sound={silent} clock={clock} />
      </div>
    </div>
  );
}
