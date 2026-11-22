"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/design/Avatar";
import { Selvedge } from "@/design/wax";
import { AdireFill } from "@/design/adire";
import { INDIGO_LOOK } from "@/games/look";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { levelOf, xpOf, type Stats } from "@/lib/progress/model";

const GREETING = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", late: "Still up" } as const;
const partOfDay = (h: number): keyof typeof GREETING => (h < 5 ? "late" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "late");

/** The top of a couple's room: the two of you and the lifetime score, sewn onto the room's cloth. */
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

  const days = Math.max(1, Math.floor((Date.now() - Date.parse(bundle.room.created_at)) / 864e5) + 1);
  const names = partner ? `${me.profile.display_name} & ${partner.profile.display_name}` : me.profile.display_name;

  return (
    <section aria-labelledby="room-hero" className="relative -mx-4 overflow-hidden sm:mx-0 sm:cut">
      {/* The room's cloth: the record print, one bold band. The score is sewn on as a patch. */}
      <AdireFill motif="agbole" bg={INDIGO_LOOK.bg} ink={INDIGO_LOOK.ink} />
      <div className="relative px-3.5 pb-4 pt-16 sm:px-7 sm:pb-7 sm:pt-24">
        <div className="cut relative bg-raised px-4 pb-4 pt-3.5 shadow-[0_14px_30px_-16px_rgba(0,0,0,.6)] sm:max-w-[560px] sm:px-6 sm:pb-5">
          <h1 id="room-hero" className="text-center text-[0.9rem] font-semibold text-muted" style={{ opacity: part ? 1 : 0, transition: "opacity 300ms" }}>
            {GREETING[part ?? "evening"]}, {me.profile.display_name}.
          </h1>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Person name={me.profile.display_name} motif={me.profile.avatar_key} hue={me.profile.avatar_hue} lead={mine > theirs} />
            <p className="display tabular whitespace-nowrap text-center leading-none">
              <span className="text-[clamp(3.2rem,14vw,5.4rem)]" aria-label={`${me.profile.display_name}: ${mine} wins`}>{mine}</span>
              <span aria-hidden className="mx-2 text-[clamp(1.1rem,4.5vw,1.7rem)] text-muted">to</span>
              {partner ? (
                <span className="text-[clamp(3.2rem,14vw,5.4rem)]" aria-label={`${partner.profile.display_name}: ${theirs} wins`}>{theirs}</span>
              ) : (
                <span aria-hidden className="text-[clamp(3.2rem,14vw,5.4rem)]">?</span>
              )}
            </p>
            {partner ? (
              <Person name={partner.profile.display_name} motif={partner.profile.avatar_key} hue={partner.profile.avatar_hue} lead={theirs > mine} />
            ) : (
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted text-[1.3rem] text-muted">?</span>
                <p className="mt-1.5 text-[0.82rem] font-semibold text-muted">Empty seat</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-[0.92rem] text-muted">{verdict}</p>
          {level ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[0.78rem] font-bold">
              <span className="cut-sm bg-indigo px-3 py-1 text-[#f6efe6]">Level {level.level}</span>
              {stats && stats.streak > 0 ? <span className="cut-sm bg-marigold px-3 py-1 text-[#1b1519]">{stats.streak}-day streak</span> : null}
            </div>
          ) : null}
        </div>
      </div>
      <Selvedge words={[names.toUpperCase(), `DAY ${days}`]} />
    </section>
  );
}

function Person({ name, motif, hue, lead }: { name: string; motif: string; hue: number; lead: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="rounded-full p-[3px]" style={{ background: lead ? "var(--fab-marigold)" : "var(--line)" }}>
        <Avatar name={name} motif={motif} hue={hue} size={52} />
      </span>
      <p className="mt-1.5 max-w-[6.5rem] truncate text-[0.85rem] font-bold">{name}</p>
    </div>
  );
}
