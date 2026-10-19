"use client";

import { Avatar } from "@/design/Avatar";
import { useRoom } from "@/lib/realtime/RoomProvider";

/**
 * The scoreboard as a typographic moment. Phase 2 feeds it real totals from
 * head_to_head; until then both sides start at a respectable zero.
 */
export function HeadToHead({ mine = 0, theirs = 0 }: { mine?: number; theirs?: number }) {
  const { bundle } = useRoom();
  const { me, partner } = bundle;
  const verdict =
    !partner ? "A rivalry needs two people. Invite yours."
      : mine === 0 && theirs === 0 ? "Nil-nil. Pristine. Enjoy it while it lasts."
        : mine === theirs ? "Dead level. Somebody break the tie."
          : mine > theirs ? `You're ahead by ${mine - theirs}. ${partner.profile.display_name} has filed a complaint.`
            : `${partner.profile.display_name} leads by ${theirs - mine}. Revenge is a dish best served at Whot.`;

  return (
    <section aria-labelledby="h2h" className="border-t-[1.5px] border-line-strong pt-5">
      <h2 id="h2h" className="eyebrow text-muted">Lifetime, head to head</h2>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-4">
        <Side name={me.profile.display_name} motif={me.profile.avatar_key} hue={me.profile.avatar_hue} score={mine} />
        <span className="display pb-6 text-[1.6rem] text-muted">to</span>
        {partner ? (
          <Side name={partner.profile.display_name} motif={partner.profile.avatar_key} hue={partner.profile.avatar_hue} score={theirs} align="right" />
        ) : (
          <div className="text-right">
            <span className="display tabular block text-[clamp(4.5rem,15vw,8rem)] leading-[0.85] text-line">?</span>
            <span className="text-[0.9rem] text-muted">Empty seat</span>
          </div>
        )}
      </div>
      <p className="mt-4 text-muted">{verdict}</p>
    </section>
  );
}

function Side({ name, motif, hue, score, align }: { name: string; motif: string; hue: number; score: number; align?: "right" }) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <span className="display tabular block text-[clamp(4.5rem,15vw,8rem)] leading-[0.85]" aria-label={`${name}: ${score} wins`}>
        {score}
      </span>
      <span className={`mt-2 inline-flex items-center gap-2 text-[0.9rem] font-semibold ${align === "right" ? "flex-row-reverse" : ""}`}>
        <Avatar name={name} motif={motif} hue={hue} size={24} />
        {name}
      </span>
    </div>
  );
}