"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/design/Avatar";
import { IconButton } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { CHAT_PAGE, MAX_CHAT_LENGTH, chatMessageSchema, countUnread, mergeMessages, type ChatMessage, type LocalMessage } from "@/lib/chat/types";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { playSound } from "@/lib/sound";

const COLS = "id, room_id, sender_id, body, created_at";
const TYPING_EVERY = 2500;
const TYPING_SHOWS = 4000;

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b);

/**
 * The room's running conversation. Lives in the header so it's one tap away on the room page and
 * mid-game, without ever covering a board.
 *
 * Delivery: the sender writes straight to Supabase (RLS), then broadcasts the saved row on the
 * room channel so it lands instantly. Postgres Changes and refetches on reconnect catch anything
 * a broadcast missed. Messages are deduped by id, so arriving twice is harmless.
 */
export function Chat() {
  const { bundle } = useRoom();
  return bundle.partner ? <ChatInner /> : null;
}

function ChatInner() {
  const { bundle, on, send: broadcast, myWhere, partnerPresence, connection } = useRoom();
  const roomId = bundle.room.id;
  const me = bundle.me.profile.id;
  const partner = bundle.partner!.profile;
  const soundOn = bundle.me.member.sound_enabled;

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [myReadAt, setMyReadAt] = useState<string | null>(null);
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [preview, setPreview] = useState<ChatMessage | null>(null);

  const openRef = useRef(open);
  openRef.current = open;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const loadedOnce = useRef(false);
  const known = useRef(new Set<string>());
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ---- loading -------------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: rows }, { data: reads }] = await Promise.all([
      sb.from("chat_messages").select(COLS).eq("room_id", roomId).order("created_at", { ascending: false }).limit(CHAT_PAGE),
      sb.from("chat_reads").select("user_id, read_at").eq("room_id", roomId),
    ]);
    if (rows) {
      const latest = rows as ChatMessage[];
      latest.forEach((m) => known.current.add(m.id));
      const newestHeld = messagesRef.current.findLast((m) => !m.status);
      const oldestFetched = latest.at(-1);
      // Away long enough that a full page doesn't reach what we hold? Start over from the
      // fresh page (keeping unsent messages) so "Earlier" can walk back without a hole.
      if (latest.length === CHAT_PAGE && newestHeld && oldestFetched && Date.parse(oldestFetched.created_at) > Date.parse(newestHeld.created_at)) {
        setHasMore(true);
        setMessages((list) => mergeMessages(list.filter((m) => m.status), latest));
      } else {
        setMessages((list) => mergeMessages(list, latest));
      }
      if (!loadedOnce.current) setHasMore(latest.length === CHAT_PAGE);
      loadedOnce.current = true;
      setLoaded(true);
    }
    for (const r of (reads ?? []) as { user_id: string; read_at: string }[]) {
      if (r.user_id === me) setMyReadAt((t) => later(t, r.read_at));
      else setPartnerReadAt((t) => later(t, r.read_at));
    }
  }, [roomId, me]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Back from the background or a dropped connection: catch up.
  const wasLive = useRef(connection === "live");
  useEffect(() => {
    if (connection === "live" && !wasLive.current) void refresh();
    wasLive.current = connection === "live";
  }, [connection, refresh]);
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  async function loadEarlier() {
    const oldest = messages.find((m) => !m.status);
    if (!oldest) return;
    setLoadingEarlier(true);
    const { data } = await supabaseBrowser()
      .from("chat_messages")
      .select(COLS)
      .eq("room_id", roomId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE);
    setLoadingEarlier(false);
    if (!data) return;
    (data as ChatMessage[]).forEach((m) => known.current.add(m.id));
    setHasMore(data.length === CHAT_PAGE);
    setMessages((list) => mergeMessages(list, data as ChatMessage[]));
  }

  // ---- receiving -----------------------------------------------------------------------------
  const receive = useCallback(
    (m: ChatMessage) => {
      if (m.room_id !== roomId) return;
      const fresh = !known.current.has(m.id);
      known.current.add(m.id);
      setMessages((list) => mergeMessages(list, [m]));
      if (!fresh || m.sender_id === me) return;
      setTyping(false);
      if (!openRef.current || document.visibilityState !== "visible") {
        setPreview(m);
        if (soundOn) playSound("flip");
      }
    },
    [roomId, me, soundOn],
  );

  useEffect(() => {
    const offs = [
      on("chat:msg", (p, from) => {
        const parsed = chatMessageSchema.safeParse(p);
        if (parsed.success && parsed.data.sender_id === from) receive(parsed.data);
      }),
      on("chat:read", (p) => {
        const t = (p as { read_at?: unknown } | null)?.read_at;
        if (typeof t === "string" && !Number.isNaN(Date.parse(t))) setPartnerReadAt((cur) => later(cur, t));
      }),
    ];
    let clear: ReturnType<typeof setTimeout> | undefined;
    offs.push(
      on("chat:typing", () => {
        setTyping(true);
        clearTimeout(clear);
        clear = setTimeout(() => setTyping(false), TYPING_SHOWS);
      }),
    );
    return () => {
      offs.forEach((off) => off());
      clearTimeout(clear);
    };
  }, [on, receive]);

  // Durable path: Postgres Changes, in case a broadcast was missed.
  useEffect(() => {
    const sb = supabaseBrowser();
    let ch: ReturnType<typeof sb.channel> | undefined;
    let cancelled = false;
    // Private channels need the user's token first. This effect runs before RoomProvider's (child
    // effects run first), so it can't rely on the room channel having set it already.
    void sb.realtime.setAuth().then(() => {
      if (cancelled) return;
      ch = sb
      .channel(`room:${roomId}:chat`, { config: { private: true } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (p) => {
        const parsed = chatMessageSchema.safeParse(p.new);
        if (parsed.success) receive(parsed.data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reads", filter: `room_id=eq.${roomId}` }, (p) => {
        const r = p.new as { user_id?: string; read_at?: string };
        if (typeof r.read_at !== "string") return;
        if (r.user_id === me) setMyReadAt((t) => later(t, r.read_at!));
        else setPartnerReadAt((t) => later(t, r.read_at!));
      })
      .subscribe();
    });
    return () => {
      cancelled = true;
      if (ch) void sb.removeChannel(ch);
    };
  }, [roomId, me, receive]);

  // ---- reading -------------------------------------------------------------------------------
  const unread = countUnread(messages, me, myReadAt);
  const newestFromPartner = messages.findLast((m) => m.sender_id !== me)?.created_at ?? null;

  useEffect(() => {
    if (!open || !unread || !newestFromPartner) return;
    if (document.visibilityState !== "visible") return;
    setMyReadAt((t) => later(t, newestFromPartner)); // clear the badge now; the server confirms below
    void (async () => {
      const { data } = await supabaseBrowser().rpc("mark_chat_read", { p_room: roomId });
      if (typeof data === "string") {
        setMyReadAt((t) => later(t, data));
        broadcast("chat:read", { read_at: data });
      }
    })();
  }, [open, unread, newestFromPartner, roomId, broadcast]);

  // ---- sending -------------------------------------------------------------------------------
  const persist = useCallback(
    async (msg: LocalMessage) => {
      known.current.add(msg.id);
      const { data, error } = await supabaseBrowser().from("chat_messages").insert({ id: msg.id, room_id: roomId, sender_id: me, body: msg.body }).select(COLS).single();
      if (error || !data) {
        // Already saved on an earlier try (the response got lost): just pick it up.
        if (error?.code === "23505") return void refresh();
        setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, status: "failed" } : m)));
        if (error?.message.includes("rate limited")) toast.info("Slow down a little.", "Messages will send again in a minute.");
        return;
      }
      setMessages((list) => mergeMessages(list, [data as ChatMessage]));
      broadcast("chat:msg", data);
    },
    [roomId, me, broadcast, refresh],
  );

  const submit = useCallback(
    (body: string) => {
      const msg: LocalMessage = { id: crypto.randomUUID(), room_id: roomId, sender_id: me, body, created_at: new Date().toISOString(), status: "sending" };
      setMessages((list) => mergeMessages(list, [msg]));
      void persist(msg);
    },
    [roomId, me, persist],
  );

  const retry = useCallback(
    (msg: LocalMessage) => {
      setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, status: "sending" } : m)));
      void persist(msg);
    },
    [persist],
  );

  const lastTyping = useRef(0);
  const onTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTyping.current < TYPING_EVERY) return;
    lastTyping.current = now;
    broadcast("chat:typing", {});
  }, [broadcast]);

  // ---- preview -------------------------------------------------------------------------------
  useEffect(() => {
    if (!preview) return;
    const t = setTimeout(() => setPreview(null), 5000);
    return () => clearTimeout(t);
  }, [preview]);

  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    setPreview(null);
    if (!next) buttonRef.current?.focus();
  }, []);

  // After Dark keeps things discreet: a message arriving there is announced, never quoted.
  const discreet = myWhere === "afterdark";
  const partnerName = partner.display_name;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => toggle(!open)}
        aria-expanded={open}
        aria-label={unread ? `Chat with ${partnerName}, ${unread} unread` : `Chat with ${partnerName}`}
        className={cn("relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunk", open && "bg-sunk")}
      >
        <Icon name="chat" size={20} />
        {unread ? (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg bg-accent px-1 text-[0.66rem] font-bold leading-none text-on-accent">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <p className="sr-only" aria-live="polite">{preview ? `New message from ${partnerName}` : ""}</p>
      <AnimatePresence>
        {preview && !open ? (
          <motion.button
            key={preview.id}
            type="button"
            onClick={() => toggle(true)}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full z-50 mt-2 flex w-[min(17rem,calc(100vw-2rem))] items-start gap-2.5 rounded-[16px] border-[1.5px] border-line-strong bg-raised p-3 text-left shadow-[0_14px_36px_-16px_rgba(28,20,22,.55)]"
          >
            <Avatar name={partnerName} motif={partner.avatar_key} hue={partner.avatar_hue} size={28} />
            <span className="min-w-0">
              <span className="block text-[0.78rem] font-semibold">{partnerName}</span>
              <span className="line-clamp-2 break-words text-[0.86rem] text-muted">{discreet ? "Sent you a message" : preview.body}</span>
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {open
        ? createPortal(
            <Panel
              me={me}
              partner={partner}
              online={!!partnerPresence}
              typing={typing}
              messages={messages}
              loaded={loaded}
              hasMore={hasMore}
              loadingEarlier={loadingEarlier}
              partnerReadAt={partnerReadAt}
              onEarlier={loadEarlier}
              onSend={submit}
              onRetry={retry}
              onTyping={onTyping}
              onClose={() => toggle(false)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

// ---- panel -------------------------------------------------------------------------------------

const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Panel({
  me,
  partner,
  online,
  typing,
  messages,
  loaded,
  hasMore,
  loadingEarlier,
  partnerReadAt,
  onEarlier,
  onSend,
  onRetry,
  onTyping,
  onClose,
}: {
  me: string;
  partner: { display_name: string; avatar_key: string; avatar_hue: number };
  online: boolean;
  typing: boolean;
  messages: LocalMessage[];
  loaded: boolean;
  hasMore: boolean;
  loadingEarlier: boolean;
  partnerReadAt: string | null;
  onEarlier: () => void;
  onSend: (body: string) => void;
  onRetry: (m: LocalMessage) => void;
  onTyping: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const firstId = useRef<string | undefined>(undefined);

  useEffect(() => inputRef.current?.focus(), []);

  // Stay pinned to the newest message unless the reader has scrolled up; keep position steady
  // when older messages are prepended.
  const prevHeight = useRef(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const prepended = firstId.current !== undefined && messages[0]?.id !== firstId.current;
    if (prepended && !stick.current) el.scrollTop += el.scrollHeight - prevHeight.current;
    else if (stick.current) el.scrollTop = el.scrollHeight;
    firstId.current = messages[0]?.id;
    prevHeight.current = el.scrollHeight;
  }, [messages, typing]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    stick.current = true;
    onSend(body);
    setDraft("");
    inputRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  // The partner has seen everything up to my latest confirmed message?
  const myLast = messages.findLast((m) => m.sender_id === me && !m.status);
  const seen = !!(myLast && partnerReadAt && Date.parse(partnerReadAt) >= Date.parse(myLast.created_at));
  const name = partner.display_name;

  return (
    <motion.div
      role="dialog"
      aria-label={`Chat with ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // Handled here so it doesn't also count towards After Dark's double-Escape exit.
          e.stopPropagation();
          onClose();
        }
      }}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 bottom-0 top-16 z-[86] flex flex-col border-line bg-bg sm:left-auto sm:w-[400px] sm:border-l-[1.5px] sm:shadow-[-24px_0_60px_-40px_rgba(28,20,22,.6)]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Avatar name={name} motif={partner.avatar_key} hue={partner.avatar_hue} size={36} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-semibold leading-tight">{name}</p>
          <p className="text-[0.78rem] leading-tight text-muted">{typing ? "typing…" : online ? "here now" : "away"}</p>
        </div>
        <IconButton icon="close" label="Close chat" onClick={onClose} />
      </div>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {hasMore ? (
          <div className="mb-4 flex justify-center">
            <button type="button" onClick={onEarlier} disabled={loadingEarlier} className="rounded-full border border-line px-3.5 py-1.5 text-[0.8rem] font-semibold text-muted hover:text-fg disabled:opacity-50">
              {loadingEarlier ? "Loading…" : "Earlier messages"}
            </button>
          </div>
        ) : null}

        {loaded && !messages.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Icon name="chat" size={28} className="text-muted" />
            <p className="display text-[1.3rem]">Say something sweet.</p>
            <p className="text-[0.88rem] text-muted">Or trash-talk. This chat follows you into every game.</p>
          </div>
        ) : null}

        <ol className="flex flex-col">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const mine = m.sender_id === me;
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            // Group runs from the same person within a few minutes; show the time at the end of a run.
            const joinsPrev = !newDay && prev?.sender_id === m.sender_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 180_000;
            const endsRun = !next || next.sender_id !== m.sender_id || Date.parse(next.created_at) - Date.parse(m.created_at) >= 180_000 || dayKey(next.created_at) !== dayKey(m.created_at);
            return (
              <Fragment key={m.id}>
                {newDay ? (
                  <li className="my-3 flex justify-center" aria-hidden>
                    <span className="eyebrow text-muted">{dayLabel(m.created_at)}</span>
                  </li>
                ) : null}
                <li className={cn("flex flex-col", mine ? "items-end" : "items-start", joinsPrev ? "mt-1" : "mt-3")}>
                  <p className="sr-only">{mine ? "You" : name}:</p>
                  <div
                    className={cn(
                      "max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2 text-[0.95rem] leading-snug",
                      mine ? "rounded-[18px] rounded-br-[6px] bg-fg text-bg" : "rounded-[18px] rounded-bl-[6px] border-[1.5px] border-line bg-raised",
                      m.status === "sending" && "opacity-60",
                      m.status === "failed" && "opacity-60 ring-2 ring-accent-ink",
                    )}
                  >
                    {m.body}
                  </div>
                  {m.status === "failed" ? (
                    <button type="button" onClick={() => onRetry(m)} className="mt-1 text-[0.75rem] font-semibold text-accent-ink underline underline-offset-2">
                      Didn&apos;t send. Tap to retry.
                    </button>
                  ) : endsRun ? (
                    <p className="mt-1 text-[0.7rem] text-muted">
                      {clockTime(m.created_at)}
                      {mine && m.id === myLast?.id && seen ? " · Seen" : ""}
                    </p>
                  ) : null}
                </li>
              </Fragment>
            );
          })}
        </ol>

        {typing ? (
          <div className="mt-3 flex" aria-hidden>
            <span className="flex gap-1 rounded-[18px] rounded-bl-[6px] border-[1.5px] border-line bg-raised px-3.5 py-3">
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }} />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-line px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <label htmlFor="chat-input" className="sr-only">
          Message {name}
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={draft}
          rows={1}
          maxLength={MAX_CHAT_LENGTH}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim()) onTyping();
            // Grow with the message, up to about five lines.
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
          }}
          onKeyDown={onKey}
          placeholder={`Message ${name}`}
          className="max-h-[132px] min-h-11 flex-1 resize-none rounded-[22px] border-[1.5px] border-line bg-raised px-4 py-2.5 text-[1rem] leading-snug text-fg placeholder:text-muted/70 focus:border-line-strong focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-[inset_0_-2px_0_rgba(0,0,0,.18)] transition-opacity disabled:opacity-40"
        >
          <Icon name="arrowRight" size={20} />
        </button>
      </form>
    </motion.div>
  );
}
