"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { RoomBundle } from "@/lib/room/types";
import { applyTheme, resolveTheme, saveThemePref, type ThemeName } from "@/lib/theme/theme";

/** What each person broadcasts about themselves via presence. */
export const presenceSchema = z.object({
  userId: z.uuid(),
  where: z.enum(["home", "game", "afterdark", "settings"]),
  gameId: z.string().max(40).optional(),
  sessionId: z.uuid().optional(),
});
export type PresenceState = z.infer<typeof presenceSchema>;

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

type Handler = (payload: unknown, from: string) => void;

type RoomCtx = {
  bundle: RoomBundle;
  connection: ConnectionState;
  partnerPresence: PresenceState | null;
  /** Update what I'm doing (shown to partner). */
  setWhere: (p: Omit<PresenceState, "userId">) => void;
  /** Low-latency broadcast to the partner. Payloads are validated by the receiver. */
  send: (event: string, payload: unknown) => void;
  on: (event: string, handler: Handler) => () => void;
  /** Temporarily override the theme (After Dark). Pass null to restore the member's preference. */
  setThemeOverride: (t: ThemeName | null) => void;
};

const Ctx = createContext<RoomCtx | null>(null);

export function useRoom(): RoomCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRoom must be used inside <RoomProvider>");
  return c;
}

const envelope = z.object({ from: z.uuid(), payload: z.unknown() });

export function RoomProvider({ bundle, children }: { bundle: RoomBundle; children: ReactNode }) {
  const router = useRouter();
  const roomId = bundle.room.id;
  const myId = bundle.me.profile.id;
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [partnerPresence, setPartnerPresence] = useState<PresenceState | null>(null);
  const [override, setThemeOverride] = useState<ThemeName | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const whereRef = useRef<Omit<PresenceState, "userId">>({ where: "home" });
  const handlers = useRef(new Map<string, Set<Handler>>());

  // Theme: member preference, unless a section (After Dark) overrides it.
  useEffect(() => {
    const pref = bundle.me.member.theme;
    saveThemePref(pref);
    applyTheme(override ?? resolveTheme(pref));
  }, [bundle.me.member.theme, override]);

  useEffect(() => () => applyTheme(resolveTheme(bundle.me.member.theme)), [bundle.me.member.theme]);

  const dispatch = useCallback((event: string, raw: unknown) => {
    const parsed = envelope.safeParse(raw);
    if (!parsed.success || parsed.data.from === myId) return;
    handlers.current.get(event)?.forEach((h) => h(parsed.data.payload, parsed.data.from));
  }, [myId]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const readPresence = (ch: RealtimeChannel) => {
      const state = ch.presenceState<PresenceState>();
      const partnerMetas = Object.entries(state)
        .filter(([key]) => key !== myId)
        .flatMap(([, metas]) => metas);
      const latest = partnerMetas.at(-1);
      const parsed = latest ? presenceSchema.safeParse(latest) : null;
      setPartnerPresence(parsed?.success ? parsed.data : null);
    };

    const connect = async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      const ch = supabase.channel(`room:${roomId}`, {
        config: { private: true, presence: { key: myId }, broadcast: { self: false } },
      });

      ch.on("presence", { event: "sync" }, () => readPresence(ch))
        .on("broadcast", { event: "*" }, ({ event, payload }) => dispatch(event, payload))
        .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, (p) => {
          // My own removal comes from leave/delete flows, which navigate on their own.
          if (p.eventType === "DELETE" && (p.old as { user_id?: string }).user_id === myId) return;
          router.refresh();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => router.refresh())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "moments", filter: `room_id=eq.${roomId}` }, () => router.refresh())
        .subscribe(async (status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setConnection("live");
            await ch.track({ userId: myId, ...whereRef.current });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnection(navigator.onLine ? "reconnecting" : "offline");
            if (status !== "CLOSED") {
              // supabase-js rejoins on its own for transient drops; force a fresh channel if it gives up.
              retry = setTimeout(() => {
                void supabase.removeChannel(ch).then(connect);
              }, 3000);
            }
          }
        });
      channelRef.current = ch;
    };

    void connect();

    const offline = () => setConnection("offline");
    const online = () => setConnection("reconnecting");
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);

    return () => {
      cancelled = true;
      clearTimeout(retry);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [roomId, myId, dispatch, router]);

  const setWhere = useCallback((p: Omit<PresenceState, "userId">) => {
    whereRef.current = p;
    void channelRef.current?.track({ userId: myId, ...p });
  }, [myId]);

  const send = useCallback((event: string, payload: unknown) => {
    void channelRef.current?.send({ type: "broadcast", event, payload: { from: myId, payload } });
  }, [myId]);

  const on = useCallback((event: string, handler: Handler) => {
    const set = handlers.current.get(event) ?? new Set<Handler>();
    set.add(handler);
    handlers.current.set(event, set);
    return () => {
      set.delete(handler);
    };
  }, []);

  const value = useMemo<RoomCtx>(
    () => ({ bundle, connection, partnerPresence, setWhere, send, on, setThemeOverride }),
    [bundle, connection, partnerPresence, setWhere, send, on],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
