"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { gameMeta, CATEGORIES } from "@/games/catalog";
import { gameComponent } from "@/games/registry";
import type { SoundName } from "@/games/_engine/types";
import { createGameStore, gameApi, GameApiError } from "@/lib/games/client";
import type { SessionSnapshot } from "@/lib/games/types";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { playSound } from "@/lib/sound";
import { ResultSheet } from "./ResultSheet";

export function GameHost({ initial }: { initial: SessionSnapshot }) {
  const { bundle, send, on, setWhere, connection } = useRoom();
  const sessionId = initial.session.id;
  const store = useMemo(() => createGameStore(initial), [initial]);
  const { session, view, pending } = useStore(store);
  const meta = gameMeta(session.game_id);
  const Component = gameComponent(session.game_id);
  const me = bundle.me.profile.id;
  const partner = session.players.find((p) => p !== me) ?? "";
  const [resignOpen, setResignOpen] = useState(false);
  const soundOn = bundle.me.member.sound_enabled;
  const lastStatus = useRef(session.status);

  const names = useMemo(
    () => Object.fromEntries(bundle.members.map((m) => [m.profile.id, m.profile.display_name])),
    [bundle.members],
  );

  const sound = useCallback((n: SoundName) => soundOn && playSound(n), [soundOn]);

  // Clock offset to the server, from the lowest-latency sample seen so far.
  const clockRef = useRef({ offset: 0, rtt: Infinity });
  const sample = useCallback((t0: number, serverNow: number | undefined) => {
    if (typeof serverNow !== "number") return;
    const t1 = Date.now();
    const rtt = t1 - t0;
    if (rtt <= clockRef.current.rtt) clockRef.current = { offset: serverNow - (t0 + t1) / 2, rtt };
  }, []);
  const clock = useCallback(() => Date.now() + clockRef.current.offset, []);

  // Coalesced: realtime events, pings and polls can all ask at once; at most one request is in
  // flight, and anything that arrives meanwhile triggers exactly one follow-up.
  const sync = useRef({ inFlight: false, again: false });
  const resync = useCallback(async () => {
    if (sync.current.inFlight) {
      sync.current.again = true;
      return;
    }
    sync.current.inFlight = true;
    try {
      do {
        sync.current.again = false;
        const t0 = Date.now();
        try {
          const snap = await gameApi.snapshot(sessionId);
          sample(t0, snap.serverNow);
          store.getState().accept(snap);
          setClosing(!!snap.closing);
        } catch {
          // stay on what we have; the banner already explains connectivity issues
        }
      } while (sync.current.again);
    } finally {
      sync.current.inFlight = false;
    }
  }, [sessionId, store, sample]);

  useEffect(() => {
    void resync(); // also takes a first clock sample
  }, [resync]);

  // Presence: tell the partner what we're playing.
  // After Dark never names the game in presence: the partner's header just says "in the room".
  const spicy = meta?.category === "spicy";
  useEffect(() => {
    setWhere(spicy ? { where: "afterdark" } : { where: "game", gameId: session.game_id, sessionId });
    return () => setWhere({ where: "home" });
  }, [setWhere, session.game_id, sessionId, spicy]);

  // A partner opted out of After Dark: this card finishes, then the session ends. No reason shown.
  const [closing, setClosing] = useState(!!initial.closing);

  // Realtime: my projection and the session row. RLS means I only ever receive my own view.
  useEffect(() => {
    const supabase = supabaseBrowser();
    let ch: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    // Private channels need the user's token first. This effect runs before RoomProvider's (child
    // effects run first), so on a fresh page load the room channel hasn't set it yet.
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      ch = supabase
      .channel(`room:${session.room_id}:game:${sessionId}`, { config: { private: true } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_views", filter: `session_id=eq.${sessionId}` }, (p) => {
        // Realtime payloads can omit columns (large or array values), so only trust a complete one.
        const row = p.new as { user_id?: string; version?: number; view?: unknown };
        if (row.user_id !== me) return;
        if (typeof row.version === "number" && row.view !== undefined && row.view !== null) store.getState().accept({ version: row.version, view: row.view });
        else void resync();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, () => {
        // Treat it as a signal and refetch: the payload isn't guaranteed to carry every column (e.g. players).
        void resync();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void resync(); // catch anything missed while connecting
      });
    });
    return () => {
      cancelled = true;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [sessionId, session.room_id, me, store, resync]);

  // Reconnect: refetch when the tab returns or the network comes back.
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && void resync();
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [resync]);

  // Fallback polling while realtime is down and the game is live.
  useEffect(() => {
    if (connection === "live" || session.status !== "active") return;
    const t = setInterval(resync, 4000);
    return () => clearInterval(t);
  }, [connection, session.status, resync]);

  // Win/lose sounds once, on the transition to finished.
  useEffect(() => {
    if (lastStatus.current === "active" && session.status === "finished") {
      if (session.winner === me) sound("win");
      else if (session.winner) sound("lose");
    }
    lastStatus.current = session.status;
  }, [session.status, session.winner, me, sound]);

  const sendMove = useCallback(
    async (move: unknown, opts?: { silent?: boolean }) => {
      const s = store.getState();
      if (s.session.status !== "active") return;
      s.setPending(true);
      try {
        const t0 = Date.now();
        const snap = await gameApi.move(sessionId, move, s.version);
        sample(t0, snap.serverNow);
        s.accept(snap);
        send(`s:${sessionId}:moved`, { version: snap.version });
      } catch (e) {
        if (opts?.silent) {
          void resync();
          return;
        }
        if (e instanceof GameApiError && e.status === 409) {
          await resync();
          if (e.message === "stale") toast.info("They beat you to it.", "The board just changed. Take another look.");
          else toast.info(e.message);
        } else {
          toast.error(e instanceof Error ? e.message : "Something went sideways.");
        }
        throw e;
      } finally {
        store.getState().setPending(false);
      }
    },
    [sessionId, store, resync, send, sample],
  );

  // Belt and braces: the partner's "moved" ping triggers a refetch if Postgres Changes lagged.
  useEffect(
    () =>
      on(`s:${sessionId}:moved`, (p) => {
        const v = (p as { version?: unknown } | null)?.version;
        if (typeof v === "number" && v > store.getState().version) void resync();
      }),
    [on, sessionId, store, resync],
  );

  // Slow safety poll while the game is live, in case both realtime paths dropped a beat.
  useEffect(() => {
    if (session.status !== "active") return;
    const t = setInterval(() => document.visibilityState === "visible" && void resync(), 15000);
    return () => clearInterval(t);
  }, [session.status, resync]);

  const broadcast = useMemo(
    () => ({
      send: (event: string, payload: unknown) => send(`s:${sessionId}:${event}`, payload),
      on: (event: string, handler: (payload: unknown) => void) => on(`s:${sessionId}:${event}`, (p) => handler(p)),
    }),
    [send, on, sessionId],
  );

  async function doResign() {
    setResignOpen(false);
    try {
      const s = await gameApi.resign(sessionId);
      store.getState().setSession(s);
      send(`s:${sessionId}:moved`, { version: s.version });
      void resync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't end the game.");
    }
  }

  if (!meta || !Component) {
    return <p className="pt-16 text-center text-muted">This game isn&apos;t available on this version of the app. Try refreshing.</p>;
  }
  const cat = CATEGORIES[meta.category];

  return (
    <div className={session.status === "active" ? "pt-6" : "pb-56 pt-6"}>
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href={`/room/${session.room_id}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
          <Icon name="arrowLeft" size={16} /> Room
        </Link>
        <div className="text-center">
          <p className="eyebrow" style={{ color: cat.ink }}>{cat.label}</p>
          <h1 className="display text-[1.6rem]">{meta.name}</h1>
        </div>
        {session.status === "active" ? (
          <Button variant="ghost" size="sm" onClick={() => setResignOpen(true)}>
            {meta.category === "competitive" ? "Resign" : "End"}
          </Button>
        ) : (
          <span className="w-[72px]" />
        )}
      </div>

      {closing && session.status === "active" ? (
        <p role="status" className="mb-5 rounded-[14px] border border-line bg-sunk px-4 py-3 text-center text-[0.9rem]">
          This session will end after this card.
        </p>
      ) : null}
      <div className="@container">
      <Component view={view} me={me} partner={partner} names={names} sendMove={sendMove} pending={pending} broadcast={broadcast} sound={sound} clock={clock} />
      </div>

      {session.status !== "active" ? <ResultSheet session={session} me={me} names={names} /> : null}

      <Modal
        open={resignOpen}
        onClose={() => setResignOpen(false)}
        title={meta.category === "competitive" ? "Throw in the towel?" : "End this game?"}
        description={meta.category === "competitive" ? `${names[partner] ?? "Your partner"} gets the win. It goes on the record.` : "The game ends for both of you."}
      >
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setResignOpen(false)}>Keep playing</Button>
          <Button variant="danger" onClick={doResign}>{meta.category === "competitive" ? "Resign" : "End game"}</Button>
        </div>
      </Modal>
    </div>
  );
}
