"use client";

import { motion } from "framer-motion";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/design/Avatar";
import { IconButton } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { canRecord, startRecording, type Recorder, type Recording } from "@/lib/chat/media";
import { describe, formatDuration, MAX_CHAT_LENGTH, type LocalMessage, type StickerMedia } from "@/lib/chat/types";
import { StickerImage, VoiceNote } from "./Bubbles";
import { StickerTray } from "./StickerTray";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { useDataSaver, voiceBitrate } from "@/lib/dataSaver";

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

type Props = {
  roomId: string;
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
  onSendText: (body: string) => void;
  onSendSticker: (m: StickerMedia) => void;
  onSendVoice: (r: Recording) => void;
  onRetry: (m: LocalMessage) => void;
  onTyping: () => void;
  onClose: () => void;
};

export function ChatPanel(props: Props) {
  const { me, partner, online, typing, messages, loaded, hasMore, loadingEarlier, partnerReadAt, onEarlier, onRetry, onClose } = props;
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

  // The partner has seen everything up to my latest confirmed message?
  const myLast = messages.findLast((m) => m.sender_id === me && !m.status);
  const seen = !!(myLast && partnerReadAt && Date.parse(partnerReadAt) >= Date.parse(myLast.created_at));
  const name = partner.display_name;
  const { active: saver } = useDataSaver();
  const [reporting, setReporting] = useState<{ id: string; preview: string } | null>(null);
  // Press and hold (touch) or right-click (mouse) a partner's message to report it.
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const report = (m: LocalMessage) => setReporting({ id: m.id, preview: m.kind === "text" ? m.body : describe(m) });
  const holdProps = (m: LocalMessage) => ({
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      report(m);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      hold.current = setTimeout(() => report(m), 550);
    },
    onPointerUp: () => hold.current && clearTimeout(hold.current),
    onPointerLeave: () => hold.current && clearTimeout(hold.current),
    onPointerCancel: () => hold.current && clearTimeout(hold.current),
  });

  return (
    <motion.div
      role="dialog"
      aria-label={`Chat with ${name}`}
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
            <p className="text-[0.88rem] text-muted">Or trash-talk. Voice notes and stickers work too, and this chat follows you into every game.</p>
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
                  <p className="sr-only">
                    {mine ? "You" : name}: {m.kind === "text" ? "" : describe(m)}
                  </p>
                  {mine || m.status ? (
                    <Body m={m} mine={mine} saver={false} />
                  ) : (
                    <div className="group relative max-w-full select-none [-webkit-touch-callout:none]" {...holdProps(m)}>
                      <Body m={m} mine={mine} saver={saver} />
                      <button
                        type="button"
                        onClick={() => report(m)}
                        className="sr-only rounded-full border border-line bg-raised px-2.5 py-1 text-[0.75rem] font-semibold focus:not-sr-only focus:absolute focus:left-full focus:top-1/2 focus:ml-2 focus:-translate-y-1/2 focus:whitespace-nowrap"
                      >
                        Report message
                      </button>
                    </div>
                  )}
                  {m.status === "failed" ? (
                    <button type="button" onClick={() => onRetry(m)} className="mt-1 text-[0.75rem] font-semibold text-accent-ink underline underline-offset-2">
                      Didn&apos;t send. Tap to retry.
                    </button>
                  ) : endsRun ? (
                    <p className="mt-1 text-[0.7rem] text-muted">
                      {m.status === "sending" && m.kind === "voice" ? "Sending…" : clockTime(m.created_at)}
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

      <Composer {...props} onBeforeSend={pin} />
      <ReportDialog open={!!reporting} onClose={() => setReporting(null)} partnerName={name} message={reporting} />
    </motion.div>
  );
}

function Body({ m, mine, saver }: { m: LocalMessage; mine: boolean; saver: boolean }) {
  const pending = m.status === "sending" && "opacity-60";
  const failed = m.status === "failed" && "opacity-60 ring-2 ring-accent-ink";
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
  return <div className={cn("max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2 text-[0.95rem] leading-snug", bubble, pending, failed)}>{m.body}</div>;
}

// ---- composer ------------------------------------------------------------------------------------

function Composer({ roomId, me, partner, onSendText, onSendSticker, onSendVoice, onTyping, onBeforeSend }: Props & { onBeforeSend: () => void }) {
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState(false);
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [starting, setStarting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const name = partner.display_name;
  const mic = canRecord();
  const { active: saver } = useDataSaver();

  useEffect(() => inputRef.current?.focus(), []);

  function send(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    onBeforeSend();
    onSendText(body);
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
      <form onSubmit={send} className="flex items-end gap-1.5 border-t border-line px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => setTray((t) => !t)}
          aria-label={tray ? "Close stickers" : "Stickers"}
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
            onClick={() => void startRec()}
            disabled={starting}
            aria-label="Record a voice message"
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
    <div className="flex items-center gap-2 border-t border-line px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3" role="group" aria-label="Recording a voice message">
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
