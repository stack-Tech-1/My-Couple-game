"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/design/Avatar";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { CHAT_PAGE, chatMessageSchema, countUnread, describe, isDeleted, mergeMessages, type ChatMessage, type LocalMessage, type StickerMedia } from "@/lib/chat/types";
import { extFor, PRIVATE_BUCKET, type Recording } from "@/lib/chat/media";
import { ChatPanel } from "./ChatPanel";
import { notifyChatMessage } from "@/lib/push/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { playSound } from "@/lib/sound";

const COLS = "id, room_id, sender_id, kind, body, media, created_at, reply_to, mentions, poll, edited_at, deleted_at";
type ByUser<T> = Record<string, Record<string, T>>;
/** Set (or with null, clear) one person's reaction or vote on one message. */
function setOne<T>(set: React.Dispatch<React.SetStateAction<ByUser<T>>>, msg: string, user: string, value: T | null) {
  set((all) => {
    const mine = { ...(all[msg] ?? {}) };
    if (value === null) delete mine[user];
    else mine[user] = value;
    return { ...all, [msg]: mine };
  });
}

/** Rows from the database, keeping only well-formed ones (an unknown kind from a newer version is skipped). */
const parseRows = (rows: unknown[] | null): ChatMessage[] =>
  (rows ?? []).flatMap((r) => {
    const p = chatMessageSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
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
  // Couple rooms: once paired. Friend rooms: always (it's how the group talks).
  return bundle.partner || bundle.room.kind === "friends" ? <ChatInner /> : null;
}

function ChatInner() {
  const { bundle, on, send: broadcast, myWhere, partnerPresence, connection } = useRoom();
  const roomId = bundle.room.id;
  const me = bundle.me.profile.id;
  const group = bundle.room.kind === "friends";
  const people = useMemo(() => Object.fromEntries(bundle.members.map((m) => [m.profile.id, m.profile])), [bundle.members]);
  const blocked = bundle.blocked;
  // In a friend room the "other side" of the chat is the room itself.
  const partner = group ? { display_name: bundle.room.name, avatar_key: "fig", avatar_hue: 200 } : bundle.partner!.profile;
  const soundOn = bundle.me.member.sound_enabled;

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [myReadAt, setMyReadAt] = useState<string | null>(null);
  // When everyone else last read the chat (one entry in a couple room).
  const [readers, setReaders] = useState<Record<string, string>>({});
  const markRead = useCallback((uid: string, t: string) => setReaders((r) => ({ ...r, [uid]: later(r[uid] ?? null, t)! })), []);
  const [open, setOpen] = useState(false);
  // Who is typing (null: nobody).
  const [typing, setTyping] = useState<string | null>(null);
  const [preview, setPreview] = useState<ChatMessage | null>(null);
  const [reactions, setReactions] = useState<ByUser<string>>({});
  const [votes, setVotes] = useState<ByUser<number>>({});

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
    const [{ data: rows }, { data: reads }, { data: reacts }, { data: polls }] = await Promise.all([
      sb.from("chat_messages").select(COLS).eq("room_id", roomId).order("created_at", { ascending: false }).limit(CHAT_PAGE),
      sb.from("chat_reads").select("user_id, read_at").eq("room_id", roomId),
      sb.from("chat_reactions").select("message_id, user_id, emoji").eq("room_id", roomId).order("created_at", { ascending: false }).limit(2000),
      sb.from("chat_poll_votes").select("message_id, user_id, option").eq("room_id", roomId).limit(2000),
    ]);
    if (reacts) {
      const next: ByUser<string> = {};
      for (const r of reacts as { message_id: string; user_id: string; emoji: string }[]) (next[r.message_id] ??= {})[r.user_id] = r.emoji;
      setReactions(next);
    }
    if (polls) {
      const next: ByUser<number> = {};
      for (const v of polls as { message_id: string; user_id: string; option: number }[]) (next[v.message_id] ??= {})[v.user_id] = v.option;
      setVotes(next);
    }
    if (rows) {
      const latest = parseRows(rows);
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
      else markRead(r.user_id, r.read_at);
    }
  }, [roomId, me, markRead]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Opened from a message notification (?chat=1): show the chat, then tidy the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("chat") !== "1") return;
    setOpen(true);
    url.searchParams.delete("chat");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  // Opened from elsewhere on the page (the Getting started list).
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("amah:open-chat", openChat);
    return () => window.removeEventListener("amah:open-chat", openChat);
  }, []);

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
    const earlier = parseRows(data);
    earlier.forEach((m) => known.current.add(m.id));
    setHasMore(data.length === CHAT_PAGE);
    setMessages((list) => mergeMessages(list, earlier));
  }

  // ---- receiving -----------------------------------------------------------------------------
  const receive = useCallback(
    (m: ChatMessage) => {
      if (m.room_id !== roomId) return;
      const fresh = !known.current.has(m.id);
      known.current.add(m.id);
      setMessages((list) => mergeMessages(list, [m]));
      if (!fresh || m.sender_id === me || blocked.includes(m.sender_id)) return;
      setTyping(null);
      if (!openRef.current || document.visibilityState !== "visible") {
        setPreview(m);
        if (soundOn) playSound("flip");
      }
    },
    [roomId, me, soundOn, blocked],
  );

  useEffect(() => {
    const offs = [
      on("chat:msg", (p, from) => {
        const parsed = chatMessageSchema.safeParse(p);
        if (parsed.success && parsed.data.sender_id === from) receive(parsed.data);
      }),
      on("chat:read", (p, from) => {
        const t = (p as { read_at?: unknown } | null)?.read_at;
        if (typeof t === "string" && !Number.isNaN(Date.parse(t))) markRead(from, t);
      }),
    ];
    let clear: ReturnType<typeof setTimeout> | undefined;
    offs.push(
      on("chat:typing", (_p, from) => {
        if (blocked.includes(from)) return;
        setTyping(from);
        clearTimeout(clear);
        clear = setTimeout(() => setTyping(null), TYPING_SHOWS);
      }),
    );
    return () => {
      offs.forEach((off) => off());
      clearTimeout(clear);
    };
  }, [on, receive, markRead, blocked]);

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
      // Edited or deleted for everyone: replace our copy (never a new-message preview).
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (p) => {
        const parsed = chatMessageSchema.safeParse(p.new);
        if (parsed.success) setMessages((list) => mergeMessages(list, [parsed.data]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions", filter: `room_id=eq.${roomId}` }, (p) => {
        if (p.eventType === "DELETE") {
          const o = p.old as { message_id?: string; user_id?: string };
          if (o.message_id && o.user_id) setOne(setReactions, o.message_id, o.user_id, null);
        } else {
          const n = p.new as { message_id: string; user_id: string; emoji: string };
          setOne(setReactions, n.message_id, n.user_id, n.emoji);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_poll_votes", filter: `room_id=eq.${roomId}` }, (p) => {
        const n = p.new as { message_id?: string; user_id?: string; option?: number };
        if (n.message_id && n.user_id && typeof n.option === "number") setOne(setVotes, n.message_id, n.user_id, n.option);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reads", filter: `room_id=eq.${roomId}` }, (p) => {
        const r = p.new as { user_id?: string; read_at?: string };
        if (typeof r.read_at !== "string") return;
        if (r.user_id === me) setMyReadAt((t) => later(t, r.read_at!));
        else if (r.user_id) markRead(r.user_id, r.read_at);
      })
      .subscribe();
    });
    return () => {
      cancelled = true;
      if (ch) void sb.removeChannel(ch);
    };
  }, [roomId, me, receive, markRead]);

  // ---- reading -------------------------------------------------------------------------------
  // Blocked people's messages are never shown (or counted).
  const visible = useMemo(() => (blocked.length ? messages.filter((m) => !blocked.includes(m.sender_id)) : messages), [messages, blocked]);
  const unread = countUnread(visible, me, myReadAt);
  // The phone tab bar shows the same count on its Chat tab.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("amah:chat-unread", { detail: unread }));
  }, [unread]);
  const newestFromPartner = visible.findLast((m) => m.sender_id !== me)?.created_at ?? null;

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
  // Voice notes upload before the row is written; the recording stays here for a retry.
  const pendingAudio = useRef(new Map<string, Blob>());

  const persist = useCallback(
    async (msg: LocalMessage) => {
      known.current.add(msg.id);
      const sb = supabaseBrowser();
      const fail = (rateLimited = false) => {
        setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, status: "failed" } : m)));
        if (rateLimited) toast.info("Slow down a little.", "Messages will send again in a minute.");
      };
      if (msg.kind === "voice" && !isDeleted(msg)) {
        const audio = pendingAudio.current.get(msg.id);
        if (audio) {
          const { error: up } = await sb.storage.from(PRIVATE_BUCKET).upload(msg.media.path, audio, { contentType: msg.media.mime, upsert: false });
          // "Already exists" means an earlier try got it there.
          if (up && !/exists|duplicate/i.test(up.message)) return fail();
          pendingAudio.current.delete(msg.id);
        }
      }
      const row = {
        id: msg.id,
        room_id: roomId,
        sender_id: me,
        kind: msg.kind,
        body: msg.kind === "text" || msg.kind === "poll" ? msg.body : null,
        media: msg.kind === "text" || msg.kind === "poll" ? null : msg.media,
        ...(msg.kind === "poll" && !isDeleted(msg) ? { poll: msg.poll } : {}),
        ...(msg.reply_to ? { reply_to: msg.reply_to } : {}),
        ...(msg.mentions?.length ? { mentions: msg.mentions } : {}),
      };
      const { data, error } = await sb.from("chat_messages").insert(row).select(COLS).single();
      if (error || !data) {
        // Already saved on an earlier try (the response got lost): just pick it up.
        if (error?.code === "23505") return void refresh();
        if (error?.message.includes("plus required")) toast.info("Voice notes and stickers are on Amah Plus.", "Start a free trial or pick a plan from any Plus game.");
        return fail(!!error?.message.includes("rate limited"));
      }
      const saved = chatMessageSchema.safeParse(data);
      if (!saved.success) return void refresh();
      setMessages((list) => mergeMessages(list, [saved.data]));
      broadcast("chat:msg", saved.data);
      // A notification for the partner if they're away (the server checks).
      void notifyChatMessage(saved.data.id);
    },
    [roomId, me, broadcast, refresh],
  );

  const draft = useCallback(
    (m: Omit<ChatMessage, "id" | "room_id" | "sender_id" | "created_at"> & { localUrl?: string }, id: string = crypto.randomUUID()) => {
      const msg = { ...m, id, room_id: roomId, sender_id: me, created_at: new Date().toISOString(), status: "sending" } as LocalMessage;
      setMessages((list) => mergeMessages(list, [msg]));
      void persist(msg);
    },
    [roomId, me, persist],
  );

  const sendText = useCallback(
    (body: string, opts?: { replyTo?: string | null; mentions?: string[] }) => draft({ kind: "text", body, reply_to: opts?.replyTo ?? null, mentions: opts?.mentions ?? [] } as Omit<ChatMessage, "id" | "room_id" | "sender_id" | "created_at">),
    [draft],
  );
  const sendPoll = useCallback((question: string, options: string[]) => draft({ kind: "poll", body: question, poll: { options } } as Omit<ChatMessage, "id" | "room_id" | "sender_id" | "created_at">), [draft]);

  // ---- reacting, editing, deleting, pinning, saving, voting -----------------------------------
  // Each changes the database through its own function (0033_chat_more.sql); our copy updates
  // straight away and Postgres Changes bring everyone else's.
  const rpc = useCallback(async (fn: string, args: Record<string, unknown>, failMsg: string) => {
    const { error } = await supabaseBrowser().rpc(fn, args);
    if (error) toast.error(error.message.includes("too late") ? "It's been more than 15 minutes, so it can't be edited now." : failMsg);
    return !error;
  }, []);
  const react = useCallback(
    (id: string, emoji: string | null) => {
      setOne(setReactions, id, me, emoji);
      void rpc("chat_react", { p_message: id, p_emoji: emoji }, "That reaction didn't go through.");
    },
    [me, rpc],
  );
  const edit = useCallback(
    (id: string, body: string) => {
      setMessages((list) => list.map((m) => (m.id === id && m.kind === "text" && !isDeleted(m) ? { ...m, body, edited_at: new Date().toISOString() } : m)));
      void rpc("chat_edit", { p_message: id, p_body: body }, "Couldn't save that edit.").then((ok) => !ok && void refresh());
    },
    [rpc, refresh],
  );
  const del = useCallback(
    (id: string) => {
      setMessages((list) => list.map((m) => (m.id === id ? ({ ...m, body: null, media: null, deleted_at: new Date().toISOString() } as LocalMessage) : m)));
      void rpc("chat_delete_for_all", { p_message: id }, "Couldn't delete that.").then((ok) => !ok && void refresh());
    },
    [rpc, refresh],
  );
  // Pinning shows straight away here and is told to everyone else on the room channel (the room
  // row changing would only reach them on their next page refresh).
  const [pinnedId, setPinnedId] = useState<string | null>(bundle.room.pinned_message_id ?? null);
  useEffect(() => setPinnedId(bundle.room.pinned_message_id ?? null), [bundle.room.pinned_message_id]);
  useEffect(
    () =>
      on("chat:pin", (p) => {
        const id = (p as { id?: unknown } | null)?.id;
        if (id === null || typeof id === "string") setPinnedId(id);
      }),
    [on],
  );
  const pinMessage = useCallback(
    (id: string | null) => {
      setPinnedId(id);
      void rpc("chat_pin", { p_room: roomId, p_message: id }, "Couldn't pin that.").then((ok) => ok && broadcast("chat:pin", { id }));
    },
    [rpc, roomId, broadcast],
  );
  const saveMoment = useCallback(
    (id: string) => void rpc("chat_save_moment", { p_message: id }, "Couldn't save that.").then((ok) => ok && toast.success("Saved to your moments.")),
    [rpc],
  );
  const vote = useCallback(
    (id: string, option: number) => {
      setOne(setVotes, id, me, option);
      void rpc("chat_vote", { p_message: id, p_option: option }, "That vote didn't go through.");
    },
    [me, rpc],
  );
  const search = useCallback(
    async (q: string): Promise<LocalMessage[]> => {
      const { data } = await supabaseBrowser().from("chat_messages").select(COLS).eq("room_id", roomId).is("deleted_at", null).ilike("body", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`).order("created_at", { ascending: false }).limit(30);
      return parseRows(data);
    },
    [roomId],
  );
  // The pinned message: from what's loaded, or fetched on its own.
  const [pinnedFetched, setPinnedFetched] = useState<ChatMessage | null>(null);
  const pinnedLoaded = pinnedId ? messages.find((m) => m.id === pinnedId) : undefined;
  useEffect(() => {
    if (!pinnedId || pinnedLoaded) return;
    void supabaseBrowser().from("chat_messages").select(COLS).eq("id", pinnedId).maybeSingle().then(({ data }) => setPinnedFetched(data ? (parseRows([data])[0] ?? null) : null));
  }, [pinnedId, pinnedLoaded]);
  const pinned = pinnedId ? (pinnedLoaded ?? (pinnedFetched?.id === pinnedId ? pinnedFetched : null)) : null;
  const sendSticker = useCallback((media: StickerMedia) => draft({ kind: "sticker", media }), [draft]);
  const sendVoice = useCallback(
    (r: Recording) => {
      const id = crypto.randomUUID();
      pendingAudio.current.set(id, r.blob);
      const path = `${roomId}/voice/${id}.${extFor(r.mime)}`;
      draft({ kind: "voice", media: { path, duration: Math.round(r.duration * 10) / 10, mime: r.mime, peaks: r.peaks }, localUrl: URL.createObjectURL(r.blob) }, id);
    },
    [roomId, draft],
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
  const sender = preview ? (people[preview.sender_id] ?? partner) : partner;

  return (
    <div className="relative" data-tour="chat">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => toggle(!open)}
        aria-expanded={open}
        aria-label={unread ? `${group ? "Group chat" : `Chat with ${partnerName}`}, ${unread} unread` : group ? "Group chat" : `Chat with ${partnerName}`}
        className={cn("relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunk", open && "bg-sunk")}
      >
        <Icon name="chat" size={20} />
        {unread ? (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg bg-accent px-1 text-[0.66rem] font-bold leading-none text-on-accent">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <p className="sr-only" aria-live="polite">{preview ? `New message from ${sender.display_name}` : ""}</p>
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
            <Avatar name={sender.display_name} motif={sender.avatar_key} hue={sender.avatar_hue} size={28} />
            <span className="min-w-0">
              <span className="block text-[0.78rem] font-semibold">{sender.display_name}</span>
              <span className="line-clamp-2 break-words text-[0.86rem] text-muted">{discreet ? "Sent you a message" : describe(preview)}</span>
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {open
        ? createPortal(
            <ChatPanel
              roomId={roomId}
              me={me}
              partner={partner}
              online={!group && !!partnerPresence}
              typing={!!typing}
              typingName={typing ? people[typing]?.display_name : undefined}
              group={group ? { people, members: bundle.members.length } : undefined}
              messages={visible}
              loaded={loaded}
              hasMore={hasMore}
              loadingEarlier={loadingEarlier}
              readers={readers}
              onEarlier={loadEarlier}
              onSendText={sendText}
              onSendPoll={sendPoll}
              reactions={reactions}
              votes={votes}
              pinned={pinned}
              onReact={react}
              onEdit={edit}
              onDelete={del}
              onPin={pinMessage}
              onSaveMoment={saveMoment}
              onVote={vote}
              onSearch={search}
              onSendSticker={sendSticker}
              onSendVoice={sendVoice}
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
