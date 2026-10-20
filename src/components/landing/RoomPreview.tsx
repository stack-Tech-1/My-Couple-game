"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/design/Avatar";
import { Icon } from "@/design/icons";
import { cn } from "@/lib/cn";

/**
 * A living miniature of a room. Scores tick, the partner drifts online, a game invite slides
 * in, a disc drops. Purely decorative. CSS-only motion so the landing page stays featherweight.
 */
const BEATS = 4;

export function RoomPreview() {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setBeat((b) => b + 1), 2600);
    return () => clearInterval(t);
  }, []);

  const phase = beat % BEATS;
  const lap = Math.floor(beat / BEATS);
  const left = 14 + lap + (phase >= 3 ? 1 : 0);
  const right = 12 + lap;
  const partnerOnline = phase !== 0;
  const showInvite = phase === 1 || phase === 2;

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[380px] select-none">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-[2.5deg] rounded-[26px] border border-line bg-sunk" />
      <div className="relative overflow-hidden rounded-[26px] border-[1.5px] border-line-strong bg-bg">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="eyebrow text-muted">Room</p>
            <p className="display text-[1.35rem]">Tolu &amp; Sam</p>
          </div>
          <div className="flex -space-x-2">
            <Avatar name="Tolu" motif="fig" hue={12} size={36} online />
            <Avatar name="Sam" motif="moon" hue={200} size={36} online={partnerOnline} />
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <p className="eyebrow text-muted">Lifetime, head to head</p>
          <div className="mt-1 flex items-baseline gap-3">
            <Score value={left} />
            <span className="display text-[2rem] text-muted">to</span>
            <Score value={right} />
          </div>
          <p className="mt-1 text-[0.85rem] text-muted">Tolu leads. Sam disputes this.</p>

          <div className="mt-5 rounded-[14px] border border-line bg-raised p-4">
            <p className="eyebrow" style={{ color: "var(--cat-personal-ink)" }}>
              Today&apos;s question
            </p>
            <p className="display mt-2 text-[1.2rem] leading-tight">What smell takes you straight back to being nine?</p>
            <p className="mt-3 flex items-center gap-2 text-[0.82rem] text-muted">
              <Icon name="check" size={16} /> Sam answered. Your turn.
            </p>
          </div>

          <MiniBoard drop={phase >= 3} dropKey={lap} />
        </div>

        <div
          className={cn(
            "absolute inset-x-3 top-3 flex items-center gap-3 rounded-[14px] border border-line bg-bg px-3.5 py-3 shadow-[0_18px_40px_-22px_rgba(28,20,22,.6)]",
            "transition-[transform,opacity] duration-500 ease-[cubic-bezier(.34,1.3,.64,1)]",
            showInvite ? "translate-y-0 opacity-100" : "-translate-y-[120%] opacity-0",
          )}
        >
          <Avatar name="Sam" motif="moon" hue={200} size={30} />
          <p className="flex-1 text-[0.88rem] leading-snug">
            <b>Sam</b> wants to play <b>Whot</b>
          </p>
          <span className="rounded-full bg-accent px-3 py-1 text-[0.8rem] font-bold text-on-accent">Join</span>
        </div>
      </div>
    </div>
  );
}

/** Odometer-style digit roll, keyed so each new number slides up into place. */
function Score({ value }: { value: number }) {
  return (
    <span className="relative inline-block h-[4.2rem] overflow-hidden">
      <span key={value} className="display tabular block animate-[score-roll_.5s_cubic-bezier(.34,1.3,.64,1)] text-[4.2rem] leading-none">
        {value}
      </span>
    </span>
  );
}

function MiniBoard({ drop, dropKey }: { drop: boolean; dropKey: number }) {
  const cells = [0, 0, 1, 2, 0, 0, 0, 1, 2, 1, 2, 0];
  return (
    <div className="mt-5 flex items-end justify-between rounded-[14px] border border-line px-4 py-3">
      <div>
        <p className="eyebrow text-muted">Now playing</p>
        <p className="mt-1 font-semibold">Connect Four · Sam&apos;s move</p>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(6, 12px)" }}>
        {cells.map((v, i) => {
          const isDrop = i === 1 && drop;
          const val = isDrop ? 2 : v;
          return (
            <span
              key={isDrop ? `d${dropKey}` : i}
              className={cn("h-3 w-3 rounded-full border border-line-strong", isDrop && "animate-[disc-drop_.45s_cubic-bezier(.34,1.5,.64,1)]")}
              style={{ background: val === 1 ? "var(--fg)" : val === 2 ? "var(--accent)" : "transparent" }}
            />
          );
        })}
      </div>
    </div>
  );
}
