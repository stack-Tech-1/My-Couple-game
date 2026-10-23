"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { daysUntil, todayIn, whenLabel, type YMD } from "@/lib/birthdays";
import { useRoom } from "@/lib/realtime/RoomProvider";

const COLOURS = ["#e8563a", "#3f7a5e", "#c98d1f", "#5b1a2b", "#d9a5b3"];

/**
 * Birthdays on the room home: a celebration on the day, a heads-up in the week before, and a nudge
 * to add your own. Dates are read on the phone, so "today" is the viewer's today.
 */
export function Birthdays() {
  const { bundle } = useRoom();
  const me = bundle.me.profile;
  const [today, setToday] = useState<YMD | null>(null);
  const [hidePrompt, setHidePrompt] = useState(true);
  const promptKey = `amah-birthday-prompt:${me.id}`;

  useEffect(() => {
    setToday(todayIn(new Date()));
    try {
      setHidePrompt(localStorage.getItem(promptKey) === "1");
    } catch {
      setHidePrompt(false);
    }
  }, [promptKey]);

  if (!today) return null;
  const people = bundle.members
    .flatMap(({ profile: p }) => (p.birth_month && p.birth_day ? [{ id: p.id, name: p.display_name, m: p.birth_month, d: p.birth_day, n: daysUntil(p.birth_month, p.birth_day, today) }] : []))
    .filter((p) => p.n <= 7)
    .sort((a, b) => a.n - b.n);
  const todays = people.filter((p) => p.n === 0);
  const soon = people.filter((p) => p.n > 0 && p.id !== me.id);
  const others = bundle.members.filter((m) => m.profile.id !== me.id);
  const askMine = !me.birth_month && others.length > 0 && !hidePrompt;

  if (!todays.length && !soon.length && !askMine) return null;

  return (
    <section aria-label="Birthdays" className="mt-8 flex flex-col gap-3">
      {todays.map((p) => (
        <div key={p.id} className="relative overflow-hidden rounded-[22px] border-[1.5px] border-line-strong bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg-raised))] p-6">
          <Confetti />
          <p className="eyebrow text-accent-ink">Birthday</p>
          <h2 className="display mt-2 text-[clamp(1.8rem,7vw,2.4rem)] leading-tight">{p.id === me.id ? `Happy birthday, ${me.display_name}!` : `It's ${p.name}'s birthday today!`}</h2>
          <p className="mt-2 text-muted">
            {p.id === me.id ? "Wishing you a year of big wins and fewer Pick Twos. Your people know it's your day." : "Make some noise. A message from you will mean a lot today."}
          </p>
          {p.id !== me.id ? (
            <Button className="mt-4" variant="accent" onClick={() => window.dispatchEvent(new Event("amah:open-chat"))}>
              Send a birthday message
            </Button>
          ) : null}
        </div>
      ))}

      {soon.length ? (
        <div className="rounded-[18px] border-[1.5px] border-line bg-raised p-4">
          <p className="eyebrow text-muted">Coming up</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {soon.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <Icon name="heart" size={16} className="shrink-0 text-accent" />
                <span>
                  <strong>{p.name}</strong>&apos;s birthday is {whenLabel(p.m, p.d, today)}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {askMine ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] border-[1.5px] border-dashed border-line p-4">
          <p className="min-w-0 flex-1 text-[0.92rem]">
            When&apos;s your birthday? Add it so {others.length === 1 ? others[0]!.profile.display_name : "your people"} never forget{others.length === 1 ? "s" : ""}.
          </p>
          <span className="flex gap-2">
            <Link prefetch={false} href={`/room/${bundle.room.id}/settings#you`} className="rounded-full bg-fg px-4 py-2 text-[0.85rem] font-semibold text-bg">
              Add it
            </Link>
            <button
              type="button"
              onClick={() => {
                setHidePrompt(true);
                try {
                  localStorage.setItem(promptKey, "1");
                } catch {
                  // storage unavailable: hidden for this visit only
                }
              }}
              className="px-2 text-[0.85rem] text-muted underline underline-offset-2 hover:text-fg"
            >
              Not now
            </button>
          </span>
        </div>
      ) : null}
    </section>
  );
}

/** A one-off shower of confetti; still for people who prefer less motion. */
function Confetti() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 22 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block h-2.5 w-1.5 rounded-[2px]"
          style={{ left: `${(i * 37) % 100}%`, background: COLOURS[i % COLOURS.length] }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: 220, rotate: 360 + i * 25, opacity: 0 }}
          transition={{ duration: 1.8 + (i % 5) * 0.25, delay: (i % 7) * 0.12, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
