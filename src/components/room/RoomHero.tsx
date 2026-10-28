"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/design/Avatar";
import { AdireFill } from "@/design/adire";
import { INDIGO_LOOK } from "@/games/look";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { levelOf, xpOf, type Stats } from "@/lib/progress/model";

const GREETING = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", late: "Still up" } as const;
const partOfDay = (h: number): keyof typeof GREETING => (h < 5 ? "late" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "late");

/**
 * The top of a couple's room: the two of you and the lifetime score, printed on adire indigo
 * (the agbole motif: the family home and close bonds).
 */
export function RoomHero({ mine, theirs, stats }: { mine: number; theirs: number; stats: Stats | null }) {
  const { bundle } = useRoom();
  const { me, partner } = bundle;
  // The greeting follows the viewer's clock, so it's filled in after mount.
  const [part, setPart] = useState<keyof typeof GREETING | null>(null);
  useEffect(() => setPart(partOfDay(new Date().getHours())), []);

  const verdict = !partner
    ? "A rivalry needs two people. Invite yours."
    : mine === 0 && theirs === 0
      ? "Nil-nil. Pristine. Enjoy it while it lasts."
      : mine === theirs
        ? "Dead level. Somebody break the tie."
        : mine > theirs
          ? `You're ahead by ${mine - theirs}. ${partner.profile.display_name} has filed a complaint.`
          : `${partner.profile.display_name} leads by ${theirs - mine}. Revenge is a dish best served at Whot.`;
  const level = stats ? levelOf(xpOf(stats)) : null;

  return (
    <section aria-labelledby="room-hero" className="relative -mx-4 overflow-hidden px-5 pb-7 pt-6 text-[#f6efe6] sm:mx-0 sm:rounded-[28px] sm:px-8 sm:pb-9 sm:pt-8">
      <AdireFill motif="agbole" bg={INDIGO_LOOK.bg} ink={INDIGO_LOOK.ink} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(24,32,63,0), rgba(24,32,63,.55))` }} />
      <div className="relative">
        <h1 id="room-hero" className="text-[1rem] font-semibold opacity-85" style={{ opacity: part ? 0.85 : 0, transition: "opacity 300ms" }}>
          {GREETING[part ?? "evening"]}, {me.profile.display_name}.
        </h1>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Person name={me.profile.display_name} motif={me.profile.avatar_key} hue={me.profile.avatar_hue} lead={mine > theirs} />
          <p className="display tabular whitespace-nowrap text-center leading-none" aria-label={partner ? `${mine} to ${theirs}` : `${mine} wins`}>
            <span className="text-[clamp(3.6rem,15vw,6.5rem)]">{mine}</span>
            <span className="mx-2 text-[clamp(1.3rem,5vw,2rem)] opacity-60">to</span>
            <span className="text-[clamp(3.6rem,15vw,6.5rem)]">{partner ? theirs : "?"}</span>
          </p>
          {partner ? (
            <Person name={partner.profile.display_name} motif={partner.profile.avatar_key} hue={partner.profile.avatar_hue} lead={theirs > mine} />
          ) : (
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[rgba(246,239,230,.5)] text-[1.4rem] opacity-70">?</span>
              <p className="mt-1.5 text-[0.85rem] font-semibold opacity-80">Empty seat</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[0.95rem] opacity-85">{verdict}</p>
        {level ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-[0.8rem] font-bold">
            <span className="rounded-full border border-[rgba(246,239,230,.3)] bg-[rgba(246,239,230,.12)] px-3 py-1">Level {level.level}</span>
            {stats && stats.streak > 0 ? (
              <span className="rounded-full border border-[rgba(242,183,5,.55)] bg-[rgba(242,183,5,.16)] px-3 py-1 text-[#ffd65c]">
                {stats.streak}-day streak
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Person({ name, motif, hue, lead }: { name: string; motif: string; hue: number; lead: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className={lead ? "rounded-full p-[3px] shadow-[0_0_0_6px_rgba(242,183,5,.18)]" : "rounded-full p-[3px]"} style={{ background: lead ? "#f2b705" : "rgba(246,239,230,.85)" }}>
        <Avatar name={name} motif={motif} hue={hue} size={60} />
      </span>
      <p className="mt-1.5 max-w-[7rem] truncate text-[0.9rem] font-bold">{name}</p>
    </div>
  );
}
