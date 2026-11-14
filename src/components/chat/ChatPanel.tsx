"use client";

import { motion } from "framer-motion";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/design/Avatar";
import { IconButton } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { canRecord, startRecording, type Recorder, type Recording } from "@/lib/chat/media";
import { canEdit, describe, formatDuration, isDeleted, MAX_CHAT_LENGTH, mentionsIn, type LocalMessage, type StickerMedia } from "@/lib/chat/types";
import { MentionText, MessageMenu, PollBubble, PollMaker, ReactionChips, ReplyQuote, type MenuAction } from "./extras";
import { StickerImage, VoiceNote } from "./Bubbles";
import { StickerTray } from "./StickerTray";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { useDataSaver, voiceBitrate } from "@/lib/dataSaver";
import { AdireFill } from "@/design/adire";
import { PAGE_LOOKS } from "@/games/look";
import { Modal } from "@/design/Modal";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { hasPlus } from "@/lib/plus/plans";
import { PlusPlans } from "@/components/plus/PlusPlans";

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

type Person = { display_name: string; avatar_key: string; avatar_hue: number };
type Props = {
  roomId: string;
  me: string;
  /** Couple rooms: your partner. Friend rooms: the room (its name). */
  partner: Person;
  /** Friend rooms: everyone by id, and how many are in the room. */
  group?: { people: Record<string, Person>; members: number };
  online: boolean;
  typing: boolean;
  typingName?: string;
  messages: LocalMessage[];
  loaded: boolean;
  hasMore: boolean;
  loadingEarlier: boolean;
  /** When each other person last read the chat. */
  readers: Record<string, string>;
  onEarlier: () => void;
  onSendText: (body: string, opts?: { replyTo?: string | null; mentions?: string[] }) => void;
  onSendPoll: (question: string, options: string[]) => void;
  /** Reactions by message, then by person. */
  reactions: Record<string, Record<string, string>>;
  /** Poll votes by message, then by person. */
  votes: Record<string, Record<string, number>>;
  pinned: LocalMessage | null;
  onReact: (id: string, emoji: string | null) => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string | null) => void;
  onSaveMoment: (id: string) => void;
  onVote: (id: string, option: number) => void;
  onSearch: (q: string) => Promise<LocalMessage[]>;
  onSendSticker: (m: StickerMedia) => void;
  onSendVoice: (r: Recording) => void;
  onRetry: (m: LocalMessage) => void;
  onTyping: () => void;
  onClose: () => void;
};

export function ChatPanel(props: Props) {
  const { roomId, me, partner, group, online, typing, typingName, messages, loaded, hasMore, loadingEarlier, readers, onEarlier, onRetry, onClose } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const firstId = useRef<string | undefined>(undefined);
  const prevHeight = useRef(0);

  // Stay pinned to the newest message unless the reader has scrolled up; keep position steady
  // when older messages are prepended.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const prepended = firstId.current !== undefined && messages[0]?.id !== firstId.current;
    if (prepended && !stick.current) el.scrollTop += el.scrollHeight - prevHeight.current;
    else if (stick.current) el.scrollTop = el.scrollHeight;
    firstId.current = messages[0]?.id;
    prevHeight.current = el.scrollHeight;
  }, [messages, typing]);

  const pin = () => {
    stick.current = true;
  };

  // The keyboard opening (or the window resizing) shrinks the list: keep the newest message in
  // view when you were already at the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const keep = () => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    };
    const ro = new ResizeObserver(keep);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Phones: size the panel to what's visible above the keyboard. iPhones don't shrink the page
  // for the keyboard, so without this the input and the newest messages sit underneath it.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = panelRef.current;
    if (!vv || !el) return;
    const fit = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      el.style.bottom = hidden > 40 ? `${hidden}px` : "";
      if (stick.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    fit();
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);

  // Who has seen everything up to my latest confirmed message?
  const myLast = messages.findLast((m) => m.sender_id === me && !m.status);
  const seenBy = myLast ? Object.entries(readers).filter(([id, t]) => id !== me && Date.parse(t) >= Date.parse(myLast.created_at)).length : 0;
  const others = group ? group.members - 1 : 1;
  const seenLabel = !seenBy ? "" : !group ? " · Seen" : seenBy >= others ? " · Seen by everyone" : ` · Seen by ${seenBy}`;
  const name = partner.display_name;
  const nameOf = (id: string) => group?.people[id]?.display_name ?? name;
  const { active: saver } = useDataSaver();
  const [reporting, setReporting] = useState<{ id: string; preview: string; sender: string } | null>(null);
  const report = (m: LocalMessage) => setReporting({ id: m.id, preview: describe(m), sender: m.sender_id });
  const [menuFor, setMenuFor] = useState<LocalMessage | null>(null);
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [editing, setEditing] = useState<LocalMessage | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const names = group ? Object.values(group.people).map((p) => p.display_name) : [];

  // Jump to a message (a reply's original, a search result, the pinned one) and flash it.
  const jump = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return toast.info("That one is further back.", "Tap Earlier messages to load it.");
    stick.current = false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(id);
    setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1600);
  };

  // Press and hold (touch) or right-click (mouse) any message for its options; swipe right to reply.
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipe = useRef<{ x: number; y: number; id: string } | null>(null);
  const holdProps = (m: LocalMessage) => ({
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setMenuFor(m);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      swipe.current = { x: e.clientX, y: e.clientY, id: m.id };
      hold.current = setTimeout(() => setMenuFor(m), 550);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = swipe.current;
      if (!s || s.id !== m.id) return;
      const dx = e.clientX - s.x;
      if ((Math.abs(e.clientY - s.y) > 24 || Math.abs(dx) > 10) && hold.current) clearTimeout(hold.current);
      if (dx > 64 && !m.deleted_at) {
        swipe.current = null;
        setEditing(null);
        setReplyTo(m);
        navigator.vibrate?.(12);
      }
    },
    onPointerUp: () => {
      swipe.current = null;
      if (hold.current) clearTimeout(hold.current);
    },
    onPointerLeave: () => hold.current && clearTimeout(hold.current),
    onPointerCancel: () => hold.current && clearTimeout(hold.current),
  });

  // New messages while you've scrolled up: a button to jump down, with how many.
  const [unseen, setUnseen] = useState(0);
  const lastCount = useRef(messages.length);
  useEffect(() => {
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    if (added > 0 && !stick.current && messages.at(-1)?.sender_id !== me) setUnseen((n) => n + added);
  }, [messages, me]);
  const toBottom = () => {
    stick.current = true;
    setUnseen(0);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  };

  const menuActions = (m: LocalMessage): MenuAction[] => {
    const mine = m.sender_id === me;
    const live = !m.deleted_at && !m.status;
    const list: MenuAction[] = [];
    if (live) list.push({ icon: "reply", label: "Reply", onClick: () => (setEditing(null), setReplyTo(m)) });
    const text = !isDeleted(m) && m.kind === "text" ? m.body : null;
    if (live && text)
      list.push({
        icon: "copy",
        label: "Copy",
        onClick: () => void navigator.clipboard?.writeText(text).then(() => toast.success("Copied.")),
      });
    if (live && canEdit(m, me)) list.push({ icon: "pen", label: "Edit", onClick: () => (setReplyTo(null), setEditing(m)) });
    if (live) list.push(props.pinned?.id === m.id ? { icon: "pin", label: "Unpin", onClick: () => props.onPin(null) } : { icon: "pin", label: group ? "Pin for everyone" : "Pin for both of you", onClick: () => props.onPin(m.id) });
    if (live && !group && m.kind === "text") list.push({ icon: "star", label: "Save to our moments", onClick: () => props.onSaveMoment(m.id) });
    if (!m.status)
      list.push({
        icon: "info",
        label: "Info",
        onClick: () => {
          const seen = Object.entries(readers).filter(([id, t]) => id !== m.sender_id && Date.parse(t) >= Date.parse(m.created_at)).map(([id]) => (id === me ? "you" : nameOf(id)));
          toast.info(`Sent ${dayLabel(m.created_at).toLowerCase() === "today" ? "today" : dayLabel(m.created_at)} at ${clockTime(m.created_at)}${m.edited_at ? ", edited" : ""}.`, mine ? (seen.length ? `Seen by ${seen.join(", ")}.` : "Not seen yet.") : undefined);
        },
      });
    if (live && mine) list.push({ icon: "trash", label: "Delete for everyone", danger: true, onClick: () => props.onDelete(m.id) });
    if (!mine && !m.deleted_at) list.push({ icon: "flag", label: "Report", danger: true, onClick: () => report(m) });
    return list;
  };

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label={group ? `${name} group chat` : `Chat with ${name}`}
      onKeyDown={(e) => {
        // Escape inside the report dialog closes only the dialog.
        if ((e.target as HTMLElement).closest("dialog")) return;
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
      {/* Plum with isan waves: the conversation keeps going. */}
      <div className="relative isolate flex items-center gap-3 overflow-hidden px-4 py-3 text-[#f6efe6]">
        <div aria-hidden className="absolute inset-0 -z-10">
          <AdireFill motif={PAGE_LOOKS.chat.motif} bg={PAGE_LOOKS.chat.bg} ink={PAGE_LOOKS.chat.ink} />
          <div className="absolute inset-0" style={{ background: PAGE_LOOKS.chat.glow }} />
        </div>
        <Avatar name={name} motif={partner.avatar_key} hue={partner.avatar_hue} size={36} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-semibold leading-tight">{name}</p>
          <p className="text-[0.78rem] leading-tight text-[#f6efe6]/75">
            {group ? (typing ? `${typingName ?? "Someone"} is typing…` : `${group.members} ${group.members === 1 ? "person" : "people"}`) : typing ? "typing…" : online ? "here now" : "away"}
          </p>
        </div>
        <span className="flex [&_button:hover]:bg-white/10 [&_button]:text-[#f6efe6]">
          <IconButton icon="search" label="Search the chat" onClick={() => setSearching((s) => !s)} />
          <IconButton icon="close" label="Close chat" onClick={onClose} />
        </span>
      </div>
      {searching ? <SearchBar messages={messages} onSearch={props.onSearch} nameOf={(id) => (id === me ? "You" : nameOf(id))} onPick={(id) => (setSearching(false), jump(id))} onClose={() => setSearching(false)} /> : null}
      {props.pinned && !props.pinned.deleted_at ? (
        <div className="flex items-center gap-2 border-b border-line bg-raised px-4 py-2 text-[0.85rem]">
          <button type="button" onClick={() => jump(props.pinned!.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`Pinned: ${describe(props.pinned)}. Go to it`}>
            <span className="shrink-0 text-[0.72rem] font-extrabold text-accent-ink">PINNED</span>
            <span className="truncate">{describe(props.pinned)}</span>
          </button>
          <button type="button" onClick={() => props.onPin(null)} aria-label="Unpin" className="shrink-0 rounded-full p-1 text-muted hover:bg-sunk">
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        style={{ background: "radial-gradient(80% 40% at 100% 0%, color-mix(in srgb, #4a1f3d 9%, transparent), transparent 70%), radial-gradient(70% 40% at 0% 100%, color-mix(in srgb, #e8563a 7%, transparent), transparent 70%)" }}
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
            <p className="display text-[1.3rem]">{group ? "Say hi to everyone." : "Say something sweet."}</p>
            <p className="text-[0.88rem] text-muted">
              {group ? "Everyone in the room sees this chat. Voice notes and stickers work too, and it follows you into every game." : "Or trash-talk. Voice notes and stickers work too, and this chat follows you into every game."}
            </p>
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
                <li id={`msg-${m.id}`} className={cn("flex scroll-mt-24 flex-col rounded-[14px] transition-colors duration-500", mine ? "items-end" : "items-start", joinsPrev ? "mt-1" : "mt-3", highlight === m.id && "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]")}>
                  {group && !mine && !joinsPrev ? (
                    <p aria-hidden className="mb-1 ml-1 text-[0.75rem] font-semibold text-muted">{nameOf(m.sender_id)}</p>
                  ) : null}
                  <p className="sr-only">
                    {mine ? "You" : nameOf(m.sender_id)}: {m.kind === "text" && !m.deleted_at ? "" : describe(m)}
                  </p>
                  <div className={cn("group relative flex max-w-full select-none flex-col [-webkit-touch-callout:none]", mine ? "items-end" : "items-start")} {...(m.status ? {} : holdProps(m))}>
                    {m.reply_to && !m.deleted_at ? (
                      <ReplyQuote
                        target={byId.get(m.reply_to)}
                        name={byId.get(m.reply_to) ? (byId.get(m.reply_to)!.sender_id === me ? "You" : nameOf(byId.get(m.reply_to)!.sender_id)) : "Earlier"}
                        mine={mine}
                        onJump={() => jump(m.reply_to!)}
                      />
                    ) : null}
                    {!isDeleted(m) && m.kind === "poll" ? (
                      <PollBubble m={m} votes={props.votes[m.id]} me={me} members={group?.members ?? 2} onVote={(o) => props.onVote(m.id, o)} />
                    ) : (
                      <Body m={m} mine={mine} saver={mine || m.status ? false : saver} names={names} />
                    )}
                    <ReactionChips byUser={props.reactions[m.id]} me={me} mine={mine} nameOf={nameOf} onToggle={(e) => props.onReact(m.id, props.reactions[m.id]?.[me] === e ? null : e)} />
                    {m.status ? null : (
                      <button
                        type="button"
                        onClick={() => setMenuFor(m)}
                        className="sr-only rounded-full border border-line bg-raised px-2.5 py-1 text-[0.75rem] font-semibold focus:not-sr-only focus:absolute focus:top-1/2 focus:-translate-y-1/2 focus:whitespace-nowrap"
                        style={mine ? { right: "100%", marginRight: 8 } : { left: "100%", marginLeft: 8 }}
                      >
                        Message options
                      </button>
                    )}
                  </div>
                  {m.status === "failed" ? (
                    <button type="button" onClick={() => onRetry(m)} className="mt-1 text-[0.75rem] font-semibold text-accent-ink underline underline-offset-2">
                      Didn&apos;t send. Tap to retry.
                    </button>
                  ) : endsRun ? (
                    <p className="mt-1 text-[0.7rem] text-muted">
                      {m.status === "sending" && m.kind === "voice" ? "Sending…" : clockTime(m.created_at)}
                      {m.edited_at && !m.deleted_at ? " · Edited" : ""}
                      {mine && m.id === myLast?.id ? seenLabel : ""}
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

      {unseen > 0 ? (
        <div className="pointer-events-none relative">
          <button type="button" onClick={toBottom} className="pointer-events-auto absolute bottom-3 right-4 rounded-full border-[1.5px] border-line bg-raised px-3.5 py-1.5 text-[0.82rem] font-extrabold shadow-[0_8px_20px_-10px_rgba(0,0,0,.5)]">
            ↓ {unseen} new
          </button>
        </div>
      ) : null}

      <Composer {...props} onBeforeSend={pin} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} editing={editing} onCancelEdit={() => setEditing(null)} replyName={replyTo ? (replyTo.sender_id === me ? "yourself" : nameOf(replyTo.sender_id)) : ""} />
      <MessageMenu
        m={menuFor}
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        myReaction={menuFor ? props.reactions[menuFor.id]?.[me] : undefined}
        onReact={(e) => {
          if (menuFor) props.onReact(menuFor.id, e);
          setMenuFor(null);
        }}
        actions={menuFor ? menuActions(menuFor) : []}
        preview={menuFor ? <span className="line-clamp-3">{describe(menuFor)}</span> : null}
      />
      <ReportDialog
        open={!!reporting}
        onClose={() => setReporting(null)}
        partnerName={reporting ? nameOf(reporting.sender) : name}
        message={reporting}
        target={group && reporting ? { roomId, userId: reporting.sender } : undefined}
      />
    </motion.div>
  );
}

function Body({ m, mine, saver, names }: { m: LocalMessage; mine: boolean; saver: boolean; names: string[] }) {
  const pending = m.status === "sending" && "opacity-60";
  const failed = m.status === "failed" && "opacity-60 ring-2 ring-accent-ink";
  if (isDeleted(m)) {
    return (
      <div className={cn("flex items-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-line px-3.5 py-2 text-[0.88rem] italic text-muted")}>
        <Icon name="trash" size={14} /> This message was deleted
      </div>
    );
  }
  if (m.kind === "poll") return null;
  if (m.kind === "sticker") {
    return (
      <div className={cn("rounded-[14px]", pending, failed)}>
        <StickerImage media={m.media} deferred={saver} />
      </div>
    );
  }
  const bubble = mine ? "rounded-[18px] rounded-br-[6px] bg-fg text-bg" : "rounded-[18px] rounded-bl-[6px] border-[1.5px] border-line bg-raised";
  if (m.kind === "voice") {
    return (
      <div className={cn("px-3 py-2", bubble, failed)}>
        <VoiceNote media={m.media} mine={mine} localUrl={m.localUrl} />
      </div>
    );
  }
  return (
    <div className={cn("max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2 text-[0.95rem] leading-snug", bubble, pending, failed)}>
      <MentionText text={m.body} names={names} mine={mine} />
    </div>
  );
}

/** Search this chat: what's loaded right away, older messages from the server. */
function SearchBar({ messages, onSearch, nameOf, onPick, onClose }: { messages: LocalMessage[]; onSearch: (q: string) => Promise<LocalMessage[]>; nameOf: (id: string) => string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [older, setOlder] = useState<LocalMessage[]>([]);
  const term = q.trim().toLowerCase();
  const here = term.length >= 2 ? messages.filter((m) => !isDeleted(m) && (m.kind === "text" || m.kind === "poll") && m.body.toLowerCase().includes(term)) : [];
  useEffect(() => {
    if (term.length < 2) return setOlder([]);
    const t = setTimeout(() => void onSearch(term).then(setOlder), 350);
    return () => clearTimeout(t);
  }, [term, onSearch]);
  const ids = new Set(here.map((m) => m.id));
  const results = [...here, ...older.filter((m) => !ids.has(m.id))].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 30);
  return (
    <div className="border-b border-line bg-raised px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon name="search" size={16} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onClose())} placeholder="Search messages" aria-label="Search messages" className="h-9 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none" />
        <button type="button" onClick={onClose} className="text-[0.85rem] font-semibold text-muted">
          Done
        </button>
      </div>
      {term.length >= 2 ? (
        <ul className="mt-1 max-h-60 overflow-y-auto" aria-label="Search results">
          {results.length ? (
            results.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onPick(m.id)} className="w-full rounded-[10px] px-2 py-1.5 text-left hover:bg-sunk">
                  <span className="block text-[0.72rem] font-bold text-muted">
                    {nameOf(m.sender_id)}, {dayLabel(m.created_at)}
                  </span>
                  <span className="line-clamp-1 text-[0.88rem]">{describe(m)}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-2 text-[0.85rem] text-muted">Nothing matches that.</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

// ---- composer ------------------------------------------------------------------------------------

function Composer({
  roomId,
  me,
  partner,
  group,
  onSendText,
  onSendSticker,
  onSendVoice,
  onSendPoll,
  onEdit,
  onTyping,
  onBeforeSend,
  replyTo,
  onCancelReply,
  replyName,
  editing,
  onCancelEdit,
}: Props & { onBeforeSend: () => void; replyTo: LocalMessage | null; onCancelReply: () => void; replyName: string; editing: LocalMessage | null; onCancelEdit: () => void }) {
  const [draft, setDraft] = useState("");
  const [polling, setPolling] = useState(false);
  // Editing: the message's text in the box. Replying: the box is ready to type.
  useEffect(() => {
    if (editing && !isDeleted(editing) && editing.kind === "text") {
      setDraft(editing.body);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);
  useEffect(() => {
    if (replyTo) requestAnimationFrame(() => inputRef.current?.focus());
  }, [replyTo]);
  // @tags in friend rooms: the word being typed after an @, and who it could be.
  const people = group ? Object.entries(group.people).filter(([id]) => id !== me).map(([id, p]) => ({ id, name: p.display_name })) : [];
  const tagging = group ? /(?:^|\s)@([^\s@]*)$/.exec(draft)?.[1] : undefined;
  const suggestions = tagging !== undefined ? people.filter((p) => p.name.toLowerCase().startsWith(tagging.toLowerCase())).slice(0, 5) : [];
  const tag = (name: string) => {
    setDraft((d) => d.replace(/@([^\s@]*)$/, `@${name} `));
    inputRef.current?.focus();
  };
  const [tray, setTray] = useState(false);
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [starting, setStarting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const name = partner.display_name;
  const mic = canRecord();
  const { active: saver } = useDataSaver();
  // Amah Plus: sending voice notes and stickers needs it (receiving never does).
  const { bundle } = useRoom();
  const locked = !hasPlus(bundle.plus, me);
  const [upsell, setUpsell] = useState(false);

  // Ready to type on a computer. On a phone, opening the chat shows the messages first: the
  // keyboard waits until you tap the box, so it never opens over what you came to read.
  useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  function send(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (editing) {
      if (body !== (!isDeleted(editing) && editing.kind === "text" ? editing.body : "")) onEdit(editing.id, body);
      onCancelEdit();
    } else {
      onBeforeSend();
      onSendText(body, { replyTo: replyTo?.id ?? null, mentions: mentionsIn(body, people) });
      onCancelReply();
    }
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    inputRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  // Recording ---------------------------------------------------------------------------------
  const stopRef = useRef<() => void>(() => {});
  async function startRec() {
    setStarting(true);
    setTray(false);
    try {
      const r = await startRecording(() => stopRef.current(), voiceBitrate(saver));
      setRecorder(r);
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      toast.error(denied ? "Amah needs your microphone for voice notes." : "Couldn't start recording.", denied ? "Allow it in your browser's site settings, then try again." : undefined);
    } finally {
      setStarting(false);
    }
  }
  async function finishRec() {
    const r = recorder;
    setRecorder(null);
    if (!r) return;
    const rec = await r.stop();
    if (!rec) return toast.info("That was too short to send.");
    onBeforeSend();
    onSendVoice(rec);
  }
  stopRef.current = () => void finishRec();
  function cancelRec() {
    recorder?.cancel();
    setRecorder(null);
  }
  // Closing the chat mid-recording discards it (and releases the microphone).
  const live = useRef<Recorder | null>(null);
  live.current = recorder;
  useEffect(() => () => live.current?.cancel(), []);

  if (recorder) return <RecordingBar recorder={recorder} onCancel={cancelRec} onSend={() => void finishRec()} />;

  return (
    <div>
      {suggestions.length ? (
        <ul className="mx-2.5 overflow-hidden rounded-t-[16px] border border-b-0 border-line bg-raised" aria-label="Tag someone">
          {suggestions.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => tag(p.name)} className="flex w-full items-center gap-2.5 px-4 py-2 text-left font-semibold hover:bg-sunk">
                <Avatar name={p.name} motif={group!.people[p.id]!.avatar_key} hue={group!.people[p.id]!.avatar_hue} size={26} />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {replyTo || editing ? (
        <div className="flex items-center gap-2 border-t border-line bg-sunk px-3.5 py-2">
          <div className="min-w-0 flex-1 border-l-[3px] border-accent pl-2.5 text-[0.82rem]">
            <p className="font-bold text-accent-ink">{editing ? "Editing your message" : `Replying to ${replyName}`}</p>
            <p className="truncate text-muted">{describe((editing ?? replyTo)!)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                onCancelEdit();
                setDraft("");
              } else onCancelReply();
            }}
            aria-label={editing ? "Stop editing" : "Cancel reply"}
            className="rounded-full p-1.5 text-muted hover:bg-raised"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}
      <form onSubmit={send} className="glass flex items-end gap-1.5 rounded-t-[22px] border-x-0 border-b-0 px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {group ? (
          <button type="button" onClick={() => setPolling(true)} aria-label="Make a poll" className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-fg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M5 19V11M12 19V5M19 19v-5" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => (locked ? setUpsell(true) : setTray((t) => !t))}
          aria-label={locked ? "Stickers (Amah Plus)" : tray ? "Close stickers" : "Stickers"}
          aria-expanded={tray}
          className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-fg", tray && "bg-sunk text-fg")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20.6 12.8V7.4a4 4 0 0 0-4-4H7.4a4 4 0 0 0-4 4v9.2a4 4 0 0 0 4 4h5.4l7.8-7.8Z" />
            <path d="M12.8 20.6v-3.8a4 4 0 0 1 4-4h3.8M8.6 9.4h.01M14.4 9.4h.01M8.8 13.6c.7.8 1.7 1.2 2.6 1.2" />
          </svg>
        </button>
        <label htmlFor="chat-input" className="sr-only">
          Message {name}
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={draft}
          rows={1}
          maxLength={MAX_CHAT_LENGTH}
          onFocus={() => setTray(false)}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim()) onTyping();
            // Grow with the message, up to about five lines.
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
          }}
          onKeyDown={onKey}
          placeholder={`Message ${name}`}
          className="max-h-[132px] min-h-11 min-w-0 flex-1 resize-none rounded-[22px] border-[1.5px] border-line bg-raised px-4 py-2.5 text-[1rem] leading-snug text-fg placeholder:text-muted/70 focus:border-line-strong focus:outline-none"
        />
        {draft.trim() || !mic ? (
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-[inset_0_-2px_0_rgba(0,0,0,.18)] transition-opacity disabled:opacity-40"
          >
            <Icon name="arrowRight" size={20} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (locked ? setUpsell(true) : void startRec())}
            disabled={starting}
            aria-label={locked ? "Record a voice message (Amah Plus)" : "Record a voice message"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-[inset_0_-2px_0_rgba(0,0,0,.18)] disabled:opacity-60"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3.4a2.9 2.9 0 0 0-2.9 2.9v5.4a2.9 2.9 0 0 0 5.8 0V6.3A2.9 2.9 0 0 0 12 3.4Z" />
              <path d="M18.4 11.4a6.4 6.4 0 0 1-12.8 0M12 17.8v3" />
            </svg>
          </button>
        )}
      </form>
      {tray ? (
        <StickerTray
          roomId={roomId}
          me={me}
          onPick={(m) => {
            onBeforeSend();
            onSendSticker(m);
          }}
        />
      ) : null}
      {group ? <PollMaker open={polling} onClose={() => setPolling(false)} onSend={(q, o) => (onBeforeSend(), onSendPoll(q, o))} /> : null}
      <Modal open={upsell} onClose={() => setUpsell(false)} title="Voice notes and stickers" description="Sending them is part of Amah Plus. You can always hear and see the ones sent to you.">
        <PlusPlans roomId={roomId} roomKind={bundle.room.kind} partnerName={bundle.partner?.profile.display_name ?? null} trialAvailable={!bundle.plus.trialUsed} />
      </Modal>
    </div>
  );
}

function RecordingBar({ recorder, onCancel, onSend }: { recorder: Recorder; onCancel: () => void; onSend: () => void }) {
  const [t, setT] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  useEffect(() => {
    const id = setInterval(() => {
      setT(recorder.elapsed());
      setLevels((l) => [...l.slice(-31), recorder.level()]);
    }, 90);
    return () => clearInterval(id);
  }, [recorder]);

  return (
    <div className="glass flex items-center gap-2 rounded-t-[22px] border-x-0 border-b-0 px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3" role="group" aria-label="Recording a voice message">
      <button type="button" onClick={onCancel} aria-label="Discard recording" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent-ink hover:bg-sunk">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4.6 6.6h14.8M9.4 6.6V4.8c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1v1.8M6.8 6.6l.8 12.2c0 .8.7 1.4 1.5 1.4h5.8c.8 0 1.5-.6 1.5-1.4l.8-12.2" />
        </svg>
      </button>
      <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[22px] border-[1.5px] border-line bg-raised px-4">
        <motion.span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-ink" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.2, repeat: Infinity }} aria-hidden />
        <span className="w-10 shrink-0 text-[0.9rem] font-semibold tabular-nums" aria-live="off">
          {formatDuration(t)}
        </span>
        <span className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden>
          {levels.map((v, i) => (
            <span key={i} className="w-[3px] shrink-0 rounded-full bg-fg/70" style={{ height: `${Math.max(12, v * 100)}%` }} />
          ))}
        </span>
      </div>
      <button
        type="button"
        onClick={onSend}
        aria-label="Send voice message"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
      >
        <Icon name="arrowRight" size={20} />
      </button>
    </div>
  );
}
