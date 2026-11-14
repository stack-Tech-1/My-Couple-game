"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/design/icons";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { cn } from "@/lib/cn";
import { describe, isDeleted, MAX_POLL_OPTIONS, QUICK_REACTIONS, type LocalMessage } from "@/lib/chat/types";

/** The message a reply answers, quoted above it. Tap to jump back to it. */
export function ReplyQuote({ target, name, mine, onJump }: { target: LocalMessage | undefined; name: string; mine: boolean; onJump: () => void }) {
  return (
    <button
      type="button"
      onClick={onJump}
      className={cn("mb-1 block w-full max-w-[18rem] rounded-[10px] border-l-[3px] border-accent px-2.5 py-1.5 text-left text-[0.8rem] leading-snug", mine ? "bg-[color-mix(in_srgb,var(--bg)_14%,transparent)]" : "bg-sunk")}
      aria-label={`Replying to ${name}: ${target ? describe(target) : "an earlier message"}. Go to it`}
    >
      <span className="block text-[0.72rem] font-bold text-accent">{name}</span>
      <span className="line-clamp-2 opacity-90">{target ? describe(target) : "An earlier message"}</span>
    </button>
  );
}

/** Reactions under a bubble: each emoji with how many, mine highlighted. Tap to add or take back. */
export function ReactionChips({ byUser, me, mine, nameOf, onToggle }: { byUser: Record<string, string> | undefined; me: string; mine: boolean; nameOf: (id: string) => string; onToggle: (emoji: string) => void }) {
  if (!byUser || !Object.keys(byUser).length) return null;
  const groups = new Map<string, string[]>();
  for (const [uid, e] of Object.entries(byUser)) groups.set(e, [...(groups.get(e) ?? []), uid]);
  return (
    <div className={cn("-mt-1.5 flex flex-wrap gap-1", mine ? "justify-end pr-2" : "pl-2")}>
      {[...groups.entries()].map(([emoji, who]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          aria-pressed={who.includes(me)}
          aria-label={`${emoji} from ${who.map((u) => (u === me ? "you" : nameOf(u))).join(", ")}`}
          className={cn("relative z-[1] rounded-full border-[1.5px] bg-raised px-1.5 py-[1px] text-[0.8rem] leading-tight shadow-[0_2px_6px_-3px_rgba(0,0,0,.35)]", who.includes(me) ? "border-accent" : "border-line")}
        >
          {emoji}
          {who.length > 1 ? <span className="ml-0.5 text-[0.7rem] font-bold text-muted">{who.length}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** @names of people in the room, picked out in the text. */
export function MentionText({ text, names, mine }: { text: string; names: string[]; mine: boolean }) {
  if (!names.length) return <>{text}</>;
  const alts = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const split = new RegExp(`(@(?:${alts}))`);
  const whole = new RegExp(`^@(?:${alts})$`);
  return (
    <>
      {text.split(split).map((part, i) =>
        whole.test(part) ? (
          <b key={i} className={mine ? "text-[#f6a48d]" : "text-accent-ink"}>
            {part}
          </b>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** A poll in a friend room: tap an option to vote (or change your vote); everyone sees the counts. */
export function PollBubble({ m, votes, me, members, onVote }: { m: Extract<LocalMessage, { kind: "poll" }>; votes: Record<string, number> | undefined; me: string; members: number; onVote: (option: number) => void }) {
  const counts = m.poll.options.map((_, i) => Object.values(votes ?? {}).filter((v) => v === i).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const mineVote = votes?.[me];
  return (
    <div className="w-[17rem] max-w-full rounded-[18px] border-[1.5px] border-line bg-raised px-3.5 py-3">
      <p className="text-[0.72rem] font-extrabold text-muted">POLL</p>
      <p className="mt-0.5 font-bold leading-snug">{m.body}</p>
      <div className="mt-2 flex flex-col gap-1.5" role="radiogroup" aria-label={m.body}>
        {m.poll.options.map((o, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={mineVote === i}
            onClick={() => onVote(i)}
            className={cn("relative overflow-hidden rounded-[10px] border-[1.5px] px-3 py-1.5 text-left text-[0.88rem]", mineVote === i ? "border-accent" : "border-line")}
          >
            <span aria-hidden className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] transition-[width] duration-300" style={{ width: total ? `${(counts[i]! / total) * 100}%` : "0%" }} />
            <span className="relative flex justify-between gap-2">
              <span className={cn(mineVote === i && "font-bold")}>{o}</span>
              <span className="tabular-nums text-muted">{counts[i]}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[0.72rem] text-muted">
        {total} of {members} voted{mineVote === undefined ? ". Tap to vote." : ". Tap another to change."}
      </p>
    </div>
  );
}

export type MenuAction = { icon: IconName; label: string; onClick: () => void; danger?: boolean };

/** Hold a message: quick reactions on top, actions below. */
export function MessageMenu({ m, open, onClose, onReact, myReaction, actions, preview }: { m: LocalMessage | null; open: boolean; onClose: () => void; onReact: (emoji: string | null) => void; myReaction: string | undefined; actions: MenuAction[]; preview: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open || !m) return null;
  return (
    <div className="fixed inset-0 z-[96] flex flex-col justify-end bg-[rgba(28,20,22,.4)] sm:items-center sm:justify-center" onClick={onClose} role="dialog" aria-modal="true" aria-label="Message options">
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-sm">
        {!isDeleted(m) ? (
          <div className="mx-4 mb-2 flex items-center justify-between rounded-full bg-raised px-3 py-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)]" role="group" aria-label="React">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => onReact(myReaction === e ? null : e)} aria-pressed={myReaction === e} aria-label={`React ${e}`} className={cn("rounded-full p-1.5 text-[1.5rem] leading-none transition-transform hover:scale-110", myReaction === e && "bg-sunk")}>
                {e}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mx-4 mb-2 max-h-28 overflow-hidden rounded-[16px] bg-raised/95 px-3.5 py-2 text-[0.9rem] opacity-90">{preview}</div>
        <ul className="rounded-t-[26px] bg-raised px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:mx-4 sm:rounded-[22px]">
          {actions.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  a.onClick();
                }}
                className={cn("flex w-full items-center gap-3.5 rounded-[12px] px-3 py-3 text-left text-[0.98rem] font-semibold hover:bg-sunk", a.danger && "text-[#b3261e]")}
              >
                <Icon name={a.icon} size={19} className={a.danger ? "" : "text-muted"} />
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Make a poll (friend rooms): a question and 2 to 6 options. */
export function PollMaker({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (question: string, options: string[]) => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const ready = q.trim() && opts.filter((o) => o.trim()).length >= 2;
  return (
    <Modal open={open} onClose={onClose} title="A poll" description="Settle it. Everyone in the room can vote once, and change their mind.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onSend(q.trim(), opts.map((o) => o.trim()).filter(Boolean));
          setQ("");
          setOpts(["", ""]);
          onClose();
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-[0.85rem] font-semibold">
          Question
          <input value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} placeholder="Who's buying suya after Ludo?" className="h-11 rounded-[14px] border-[1.5px] border-line bg-raised px-3.5 text-[1rem] font-normal" />
        </label>
        {opts.map((o, i) => (
          <label key={i} className="flex flex-col gap-1 text-[0.85rem] font-semibold">
            Option {i + 1}
            <input value={o} maxLength={60} onChange={(e) => setOpts((list) => list.map((x, j) => (j === i ? e.target.value : x)))} className="h-11 rounded-[14px] border-[1.5px] border-line bg-raised px-3.5 text-[1rem] font-normal" />
          </label>
        ))}
        {opts.length < MAX_POLL_OPTIONS ? (
          <button type="button" onClick={() => setOpts((l) => [...l, ""])} className="self-start text-[0.9rem] font-bold underline">
            Add an option
          </button>
        ) : null}
        <Button type="submit" size="lg" disabled={!ready}>
          Send poll
        </Button>
      </form>
    </Modal>
  );
}
