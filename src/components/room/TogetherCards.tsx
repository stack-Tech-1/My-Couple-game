"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { CHALLENGES, challengeById } from "@/content/challenges";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { addCountdown, endChallenge, removeCountdown, setMood, setTogetherSince, startChallenge, tickChallenge } from "@/lib/together/actions";
import { daysTogether, daysUntil, isAnniversary, MOODS, moodInfo, type ChallengeState, type Countdown, type Mood, type MoodKey } from "@/lib/together/types";

const input = "h-11 rounded-[var(--radius)] border-[1.5px] border-line bg-bg px-3 text-[0.95rem] focus:border-line-strong focus:outline-none";
const EVENT = "together:changed";

/** Runs an action, tells the partner's app to refresh, and refreshes ours. */
function useTogetherAction() {
  const router = useRouter();
  const { send } = useRoom();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "That didn't work.");
      send(EVENT, {});
      onOk?.();
      router.refresh();
    });
  return { pending, run };
}

/** The partner changed something here: pull the fresh state. */
export function TogetherSync() {
  const router = useRouter();
  const { on } = useRoom();
  useEffect(() => on(EVENT, () => router.refresh()), [on, router]);
  return null;
}

const when = (n: number) => (n === 0 ? "today!" : n === 1 ? "tomorrow" : `in ${n} days`);

export function TogetherCard({ countdowns }: { countdowns: Countdown[] }) {
  const { bundle } = useRoom();
  const since = bundle.room.together_since;
  // Separate busy states: saving the date mustn't block adding a countdown.
  const { pending, run } = useTogetherAction();
  const cd = useTogetherAction();
  const [editing, setEditing] = useState(!since);
  const [date, setDate] = useState(since ?? "");
  const [title, setTitle] = useState("");
  const [on, setOn] = useState("");
  const anniversary = since ? isAnniversary(since) : null;
  const today = new Date().toISOString().slice(0, 10);

  function saveSince(e: FormEvent) {
    e.preventDefault();
    run(() => setTogetherSince(date), () => setEditing(false));
  }
  function add(e: FormEvent) {
    e.preventDefault();
    cd.run(() => addCountdown(title, on), () => {
      setTitle("");
      setOn("");
    });
  }

  return (
    <section aria-labelledby="together-h" className="rounded-[22px] border border-line bg-raised p-5">
      <h2 id="together-h" className="eyebrow text-muted">
        Together
      </h2>
      {anniversary ? (
        <p className="display mt-2 text-[1.7rem] leading-tight text-accent-ink">
          Happy {anniversary === 1 ? "first" : `${anniversary}-year`} anniversary! <Icon name="heart" size={22} className="inline -translate-y-1" />
        </p>
      ) : null}
      {since && !editing ? (
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="display text-[2rem] leading-none">
            Day {daysTogether(since).toLocaleString()} <span className="text-[1.1rem] text-muted">together</span>
          </p>
          <button type="button" onClick={() => setEditing(true)} className="text-[0.8rem] font-semibold text-muted underline underline-offset-2 hover:text-fg">
            Edit
          </button>
        </div>
      ) : (
        <form onSubmit={saveSince} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[0.82rem] font-semibold">When did you two get together?</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={input} required />
          </label>
          <Button type="submit" size="sm" loading={pending} className="mb-1">
            Save
          </Button>
        </form>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[0.82rem] font-semibold">Counting down to</p>
        {countdowns.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {countdowns.map((c) => {
              const n = daysUntil(c.on_date);
              return (
                <li key={c.id} className="group flex items-center gap-3">
                  <span className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[12px] border", n === 0 ? "border-accent bg-accent text-on-accent" : "border-line bg-bg")}>
                    <span className="text-[1rem] font-bold leading-none tabular-nums">{n}</span>
                    <span className="text-[0.55rem] font-semibold uppercase">{n === 1 ? "day" : "days"}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.title}</span>
                    <span className="block text-[0.78rem] text-muted">{when(n)}</span>
                  </span>
                  <button type="button" onClick={() => cd.run(() => removeCountdown(c.id))} aria-label={`Remove countdown: ${c.title}`} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-fg">
                    <Icon name="close" size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-[0.85rem] text-muted">Your next visit, a trip, a birthday… add something to look forward to.</p>
        )}
        <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="cd-title">
            What are you counting down to?
          </label>
          <input id="cd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Our next visit" className={cn(input, "min-w-[9rem] flex-1")} required />
          <label className="sr-only" htmlFor="cd-date">
            Date
          </label>
          <input id="cd-date" type="date" value={on} min={today} onChange={(e) => setOn(e.target.value)} className={input} required />
          <Button type="submit" size="sm" variant="outline" loading={cd.pending} className="h-11">
            Add
          </Button>
        </form>
      </div>
    </section>
  );
}

export function MoodCard({ moods }: { moods: Mood[] }) {
  const { bundle } = useRoom();
  const me = bundle.me.profile.id;
  const partner = bundle.partner?.profile;
  const mine = moods.find((m) => m.user_id === me);
  const theirs = moods.find((m) => m.user_id !== me);
  const [picked, setPicked] = useState<MoodKey | null>(mine?.mood ?? null);
  const [note, setNote] = useState(mine?.note ?? "");
  const [open, setOpen] = useState(!mine);
  const { pending, run } = useTogetherAction();
  const t = theirs ? moodInfo(theirs.mood) : null;
  // Right after sharing, the saved mood may not have arrived from the server yet: show what was picked.
  const shown = mine ?? (picked && !open ? { mood: picked, note: note || null } : null);

  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!picked) return;
    run(() => setMood(picked, note), () => setOpen(false));
  }

  return (
    <section aria-labelledby="mood-h" className="rounded-[22px] border border-line bg-raised p-5">
      <h2 id="mood-h" className="eyebrow text-muted">
        How are you today?
      </h2>
      {partner ? (
        <p className="mt-2 text-[0.92rem]">
          {t ? (
            <>
              <span aria-hidden>{t.emoji}</span> <span className="font-semibold">{partner.display_name}</span> is feeling <span className="font-semibold">{t.label.toLowerCase()}</span>
              {theirs?.note ? <span className="block text-muted">“{theirs.note}”</span> : null}
            </>
          ) : (
            <span className="text-muted">{partner.display_name} hasn&apos;t checked in today.</span>
          )}
        </p>
      ) : null}

      {open || !shown ? (
        <form onSubmit={save} className="mt-4">
          <div role="radiogroup" aria-label="Your mood" className="grid grid-cols-4 gap-2">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={picked === m.key}
                onClick={() => setPicked(m.key)}
                className={cn("flex flex-col items-center gap-1 rounded-[12px] border-[1.5px] px-1 py-2 text-[0.72rem] font-semibold", picked === m.key ? "border-line-strong bg-bg" : "border-transparent hover:bg-sunk")}
              >
                <span aria-hidden className="text-[1.5rem] leading-none">
                  {m.emoji}
                </span>
                {m.label}
              </button>
            ))}
          </div>
          {picked ? (
            <div className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor="mood-note">
                Add a few words (optional)
              </label>
              <input id="mood-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="A few words? (optional)" className={cn(input, "min-w-0 flex-1")} />
              <Button type="submit" size="sm" loading={pending} className="h-11">
                Share
              </Button>
            </div>
          ) : null}
        </form>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-[0.92rem]">
            You: <span aria-hidden>{moodInfo(shown.mood)?.emoji}</span> {moodInfo(shown.mood)?.label}
            {shown.note ? <span className="text-muted"> · {shown.note}</span> : null}
          </p>
          <button type="button" onClick={() => setOpen(true)} className="text-[0.8rem] font-semibold text-muted underline underline-offset-2 hover:text-fg">
            Change
          </button>
        </div>
      )}
    </section>
  );
}

export function ChallengeCard({ challenge }: { challenge: ChallengeState }) {
  const { bundle } = useRoom();
  const me = bundle.me.profile.id;
  const partner = bundle.partner?.profile;
  const { pending, run } = useTogetherAction();
  const [all, setAll] = useState(false);

  if (!challenge) {
    return (
      <section aria-labelledby="challenge-h" className="rounded-[22px] border border-line bg-raised p-5">
        <h2 id="challenge-h" className="eyebrow text-muted">
          30-day challenge
        </h2>
        <p className="mt-2 text-[0.92rem] text-muted">One small thing a day, for a month. Both of you tick it off.</p>
        <ul className="mt-4 flex flex-col gap-3">
          {CHALLENGES.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-bg p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.name}</p>
                <p className="text-[0.82rem] text-muted">{c.blurb}</p>
              </div>
              <Button size="sm" onClick={() => run(() => startChallenge(c.id))} loading={pending}>
                Start
              </Button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const pack = challengeById(challenge.challenge_id);
  if (!pack) return null;
  const done = (day: number, uid: string) => challenge.checks.some((c) => c.day === day && c.user_id === uid);
  const both = (day: number) => done(day, me) && (!partner || done(day, partner.id));
  const complete = pack.days.filter((_, i) => both(i + 1)).length;
  const finished = challenge.today >= 30 && complete === 30;
  const days = all ? pack.days.map((_, i) => i + 1).slice(0, challenge.today).reverse() : [challenge.today];

  return (
    <section aria-labelledby="challenge-h" className="rounded-[22px] border border-line bg-raised p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="challenge-h" className="eyebrow text-muted">
          {pack.name}
        </h2>
        <span className="text-[0.8rem] tabular-nums text-muted">
          Day {challenge.today} of 30 · {complete} done together
        </span>
      </div>
      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {pack.days.map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", both(i + 1) ? "bg-[var(--series)]" : i + 1 <= challenge.today ? "bg-[color-mix(in_srgb,var(--series)_25%,var(--bg-raised))]" : "bg-sunk")} />
        ))}
      </div>

      {finished ? <p className="display mt-4 text-[1.6rem] leading-tight">You did all thirty. Proud of you two.</p> : null}

      <ol className="mt-4 flex flex-col gap-3">
        {days.map((day) => (
          <li key={day} className="rounded-[14px] border border-line bg-bg p-3">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-muted">{day === challenge.today ? "Today" : `Day ${day}`}</p>
            <p className="mt-1">{pack.days[day - 1]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={done(day, me)}
                onClick={() => run(() => tickChallenge(challenge.id, day, !done(day, me)))}
                disabled={pending}
                className={cn("flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[0.85rem] font-semibold", done(day, me) ? "border-fg bg-fg text-bg" : "border-line hover:border-line-strong")}
              >
                <Icon name="check" size={14} /> {done(day, me) ? "You did it" : "Mark mine done"}
              </button>
              {partner ? (
                <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem]", done(day, partner.id) ? "bg-sunk font-semibold" : "text-muted")}>
                  {done(day, partner.id) ? <Icon name="check" size={14} /> : null}
                  {partner.display_name} {done(day, partner.id) ? "did it" : "hasn't yet"}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between">
        {challenge.today > 1 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="text-[0.85rem] font-semibold text-muted underline underline-offset-2 hover:text-fg">
            {all ? "Just today" : "All days so far"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => run(() => endChallenge(challenge.id))}
          className="text-[0.8rem] font-semibold text-muted hover:text-accent-ink"
        >
          {finished ? "Finish and pick another" : "Stop this challenge"}
        </button>
      </div>
    </section>
  );
}
