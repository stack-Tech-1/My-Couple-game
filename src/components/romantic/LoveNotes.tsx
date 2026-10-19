"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { Tabs } from "@/design/Tabs";
import { Toggle } from "@/design/Field";
import { Icon } from "@/design/icons";
import { toast, useToasts } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { deleteNote, openNote, sendNote } from "@/lib/romantic/actions";
import type { Note, NotesState, Stationery } from "@/lib/romantic/types";

const PAPER: Record<Stationery, { bg: string; ink: string; edge: string; label: string }> = {
  paper: { bg: "#fbf7f1", ink: "#1c1416", edge: "#dfd2c1", label: "Cream" },
  wine: { bg: "#5b1a2b", ink: "#f6e3c8", edge: "#3d1019", label: "Wine" },
  sage: { bg: "#e4eadb", ink: "#2f3a27", edge: "#b9c5aa", label: "Sage" },
  brass: { bg: "#f2e2bd", ink: "#4a3410", edge: "#d6bd85", label: "Brass" },
};

function until(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  // Rounded, so a note sealed "a week from now" reads as 7 days, not 6.
  const d = Math.round(ms / 86_400_000);
  if (d >= 2) return `in ${d} days`;
  const h = Math.round(ms / 3_600_000);
  if (h >= 2) return `in ${h} hours`;
  return "very soon";
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function LoveNotes({ notes }: { notes: NotesState }) {
  const { bundle, on } = useRoom();
  const router = useRouter();
  const unread = notes.inbox.filter((n) => !n.opened_at).length;
  const [tab, setTab] = useState<"inbox" | "write" | "sent">(unread || notes.sealed.length ? "inbox" : "write");
  const [reading, setReading] = useState<Note | null>(null);
  const partnerName = bundle.partner?.profile.display_name ?? "your partner";

  useEffect(() => on("notes:changed", () => router.refresh()), [on, router]);

  // A letter that lands while you're on another tab deserves more than a badge.
  const arrived = notes.inbox.length + notes.sealed.length;
  const seen = useRef(arrived);
  useEffect(() => {
    if (arrived > seen.current) {
      // One letter toast at a time: a newer arrival replaces the previous announcement.
      const store = useToasts.getState();
      store.toasts.filter((t) => t.title === "A letter just arrived").forEach((t) => store.dismiss(t.id));
      store.push({ tone: "invite", icon: "envelope", title: "A letter just arrived", body: `From ${partnerName}`, action: { label: "Read", onClick: () => setTab("inbox") } });
    }
    seen.current = arrived;
  }, [arrived, partnerName]);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        label="Love notes"
        value={tab}
        onChange={setTab}
        items={[
          { key: "inbox", label: <>For you{unread ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[0.72rem] text-on-accent">{unread}</span> : null}</> },
          { key: "write", label: "Write one" },
          { key: "sent", label: "Sent" },
        ]}
      />
      {tab === "inbox" ? <Inbox notes={notes} partnerName={partnerName} onRead={setReading} /> : tab === "write" ? <Compose partnerName={partnerName} onSent={() => setTab("sent")} /> : <Sent notes={notes.sent} partnerName={partnerName} />}
      <Letter note={reading} from={partnerName} onClose={() => setReading(null)} />
    </div>
  );
}

function Inbox({ notes, partnerName, onRead }: { notes: NotesState; partnerName: string; onRead: (n: Note) => void }) {
  if (!notes.inbox.length && !notes.sealed.length) {
    return <p className="py-10 text-center text-muted">No letters yet. {partnerName[0]!.toUpperCase() + partnerName.slice(1)} is clearly working on something epic.</p>;
  }
  return (
    <ul className="grid gap-4 @md:grid-cols-2">
      {notes.sealed.map((n) => (
        <li key={n.id}>
          <Envelope stationery={n.stationery} sealed label={`Sealed until ${fmtDate(n.unlock_at)}`}>
            <p className="font-semibold">Sealed</p>
            <p className="text-[0.85rem] opacity-80">Opens {until(n.unlock_at)} · {fmtDate(n.unlock_at)}</p>
          </Envelope>
        </li>
      ))}
      {notes.inbox.map((n) => (
        <li key={n.id}>
          <Envelope stationery={n.stationery} sealed={!n.opened_at} onOpen={() => onRead(n)} label={n.opened_at ? "Read again" : "Open your letter"}>
            <p className="font-semibold">{n.opened_at ? "Opened" : "New letter"}</p>
            <p className="line-clamp-1 text-[0.85rem] opacity-80">{n.opened_at ? n.body : `From ${partnerName} · ${fmtDate(n.created_at)}`}</p>
          </Envelope>
        </li>
      ))}
    </ul>
  );
}

function Envelope({ stationery, sealed, onOpen, label, children }: { stationery: Stationery; sealed: boolean; onOpen?: () => void; label: string; children: React.ReactNode }) {
  const p = PAPER[stationery];
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      type={onOpen ? "button" : undefined}
      onClick={onOpen}
      aria-label={label}
      className={cn("relative flex w-full items-end overflow-hidden rounded-[10px] border-[1.5px] p-5 text-left transition-transform", onOpen && "hover:-translate-y-0.5")}
      style={{ background: p.bg, borderColor: p.edge, color: p.ink, aspectRatio: "16 / 10" }}
    >
      <svg viewBox="0 0 160 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M0 0 L80 58 L160 0" fill="none" stroke={p.edge} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      {sealed ? (
        <span aria-hidden className="absolute left-1/2 top-[58%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent shadow-[inset_0_-3px_0_rgba(0,0,0,.25)]">
          <Icon name={onOpen ? "heart" : "lock"} size={18} />
        </span>
      ) : null}
      <div className="relative">{children}</div>
    </Tag>
  );
}

type Stage = "closed" | "flap" | "rise" | "read";

/**
 * The envelope, as layered paper: back → letter → front pocket → flap.
 * Flap swings open, the letter slides up out of the pocket, the envelope drops away,
 * and the letter settles into place (layout animation).
 */
function Letter({ note, from, onClose }: { note: Note | null; from: string; onClose: () => void }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("closed");

  useEffect(() => {
    if (!note) return;
    if (reduce) {
      setStage("read");
    } else {
      setStage("closed");
      const t = [setTimeout(() => setStage("flap"), 350), setTimeout(() => setStage("rise"), 1000), setTimeout(() => setStage("read"), 1750)];
      if (!note.opened_at) void openNote(note.id).then(() => router.refresh());
      return () => t.forEach(clearTimeout);
    }
    if (!note.opened_at) void openNote(note.id).then(() => router.refresh());
  }, [note, reduce, router]);

  useEffect(() => {
    if (!note) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [note, onClose]);

  const p = note ? PAPER[note.stationery] : PAPER.paper;
  const reading = stage === "read";
  const letter = note ? (
    <motion.article
      layout
      transition={{ layout: { type: "spring", stiffness: 120, damping: 20 } }}
      className={cn("rounded-[6px] border-[1.5px] px-7 py-8 shadow-[0_24px_50px_-30px_rgba(0,0,0,.6)] sm:px-10", reading ? "relative max-h-[82dvh] overflow-y-auto" : "absolute inset-x-[5%] top-[8%] h-[84%] overflow-hidden")}
      style={{ background: p.bg, borderColor: p.edge, color: p.ink, zIndex: 10 }}
      animate={{ y: stage === "rise" ? "-55%" : 0 }}
    >
      <p className="eyebrow opacity-70">{fmtDate(note.created_at)}</p>
      <p className="display mt-5 whitespace-pre-wrap text-[1.35rem] leading-[1.55]">{note.body}</p>
      {reading ? (
        <>
          <p className="display mt-8 text-right text-[1.2rem] italic">— {from}</p>
          <div className="mt-8 flex justify-center">
            <Button variant="ghost" onClick={onClose} style={{ color: p.ink }}>
              Fold it back up
            </Button>
          </div>
        </>
      ) : null}
    </motion.article>
  ) : null;

  return (
    <AnimatePresence>
      {note ? (
        <motion.div role="dialog" aria-modal="true" aria-label={`Letter from ${from}`} className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[rgba(18,12,14,.62)] p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            {reading ? (
              letter
            ) : (
              <div className="relative mt-[30%] aspect-[16/10] w-full [perspective:1400px]">
                {/* back of the envelope */}
                <div className="absolute inset-0 rounded-[10px]" style={{ background: p.edge }} />
                {letter}
                {/* front pocket, in front of the letter */}
                <div className="absolute inset-0 z-20 rounded-[10px]" style={{ background: p.bg, clipPath: "polygon(0 34%, 50% 66%, 100% 34%, 100% 100%, 0 100%)", boxShadow: "inset 0 -2px 0 rgba(0,0,0,.08)" }} aria-hidden />
                {/* flap */}
                <motion.div
                  className="absolute inset-x-0 top-0 h-[66%] origin-top [backface-visibility:hidden]"
                  style={{ background: p.bg, clipPath: "polygon(0 0, 100% 0, 50% 100%)", zIndex: stage === "closed" ? 30 : 5, filter: "brightness(0.96)" }}
                  animate={{ rotateX: stage === "closed" ? 0 : 180 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden
                />
                {stage === "closed" ? (
                  <span aria-hidden className="absolute left-1/2 top-[66%] z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent shadow-[inset_0_-3px_0_rgba(0,0,0,.25)]">
                    <Icon name="heart" size={20} />
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
function Compose({ partnerName, onSent }: { partnerName: string; onSent: () => void }) {
  const { send } = useRoom();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [paper, setPaper] = useState<Stationery>("paper");
  const [seal, setSeal] = useState(false);
  const [when, setWhen] = useState("");
  const [pending, start] = useTransition();
  const p = PAPER[paper];

  const submit = () =>
    start(async () => {
      const res = await sendNote({ body, stationery: paper, unlockAt: seal && when ? new Date(when).toISOString() : null });
      if (!res.ok) return void toast.error(res.error);
      send("notes:changed", {});
      toast.success(seal ? "Sealed and delivered." : "Delivered.", seal ? `${partnerName} can open it ${until(new Date(when).toISOString())}.` : undefined);
      setBody("");
      setSeal(false);
      router.refresh();
      onSent();
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[8px] border-[1.5px] p-5 transition-colors" style={{ background: p.bg, borderColor: p.edge, color: p.ink }}>
        <label htmlFor="note-body" className="eyebrow opacity-70">
          Dear {partnerName},
        </label>
        <textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={9}
          placeholder="Say the thing you never quite say out loud."
          className="display mt-3 w-full resize-y bg-transparent text-[1.25rem] leading-[1.55] placeholder:opacity-50 focus:outline-none"
          style={{ color: p.ink }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Stationery">
        {(Object.keys(PAPER) as Stationery[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={paper === k} onClick={() => setPaper(k)} className={cn("flex items-center gap-2 rounded-full border-[1.5px] py-1.5 pl-1.5 pr-3 text-[0.85rem] font-semibold", paper === k ? "border-line-strong" : "border-line")}>
            <span className="h-6 w-6 rounded-full border" style={{ background: PAPER[k].bg, borderColor: PAPER[k].edge }} />
            {PAPER[k].label}
          </button>
        ))}
      </div>
      <div className="rounded-[14px] border border-line px-4">
        <Toggle checked={seal} onChange={setSeal} label="Seal it until a date" description="They'll see the envelope, but can't open it until then." />
        {seal ? (
          <div className="pb-4">
            <label htmlFor="note-when" className="text-[0.82rem] font-semibold">
              Opens on
            </label>
            <input id="note-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1.5 h-12 w-full rounded-[var(--radius)] border-[1.5px] border-line bg-raised px-4" />
          </div>
        ) : null}
      </div>
      <Button size="lg" variant="accent" icon="envelope" loading={pending} disabled={!body.trim() || (seal && !when)} onClick={submit}>
        {seal ? "Seal and send" : "Send it"}
      </Button>
    </div>
  );
}

function Sent({ notes, partnerName }: { notes: Note[]; partnerName: string }) {
  const router = useRouter();
  if (!notes.length) return <p className="py-10 text-center text-muted">Nothing sent yet. The first one is the hardest.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {notes.map((n) => {
        const sealed = n.unlock_at && new Date(n.unlock_at) > new Date();
        return (
          <li key={n.id} className="flex items-start gap-4 rounded-[14px] border border-line p-4">
            <span className="mt-1 h-4 w-4 shrink-0 rounded-full border" style={{ background: PAPER[n.stationery].bg, borderColor: PAPER[n.stationery].edge }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2">{n.body}</p>
              <p className="mt-1 text-[0.82rem] text-muted">
                {sealed ? `Sealed until ${fmtDate(n.unlock_at!)}` : n.opened_at ? `${partnerName} opened it ${fmtDate(n.opened_at)}` : "Delivered, not opened yet"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Delete this note"
              className="rounded-full p-1.5 text-muted hover:bg-sunk hover:text-fg"
              onClick={() => void deleteNote(n.id).then((r) => (r.ok ? router.refresh() : toast.error(r.error)))}
            >
              <Icon name="close" size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
