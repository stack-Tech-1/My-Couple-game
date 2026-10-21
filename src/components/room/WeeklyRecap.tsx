"use client";

import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { gameMeta } from "@/games/catalog";
import { useRoom } from "@/lib/realtime/RoomProvider";
import type { Week } from "@/lib/progress/server";

const range = (start: string) => {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(s.getTime() + 6 * 86_400_000);
  const f = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(s)} to ${f(e)}`;
};

/** Last week, together: a small, shareable summary on the room home. */
export function WeeklyRecap({ week }: { week: Week }) {
  const { bundle } = useRoom();
  const me = bundle.me.profile;
  const partner = bundle.partner?.profile;
  const myWins = week.wins[me.id] ?? 0;
  const theirWins = partner ? (week.wins[partner.id] ?? 0) : 0;
  const top = week.top_game ? gameMeta(week.top_game)?.name : null;

  const stats: [string, number | string][] = [
    ["Days you both showed up", `${week.shared_days} of 7`],
    ["Games finished", week.games],
    ["Daily Questions answered", week.dailies],
    ["Messages", week.messages],
    ["Hearts sent", week.nudges],
  ];

  const text = [
    `Our week on Amah (${range(week.start)}):`,
    `${week.shared_days}/7 days together, ${week.games} games${top ? ` (mostly ${top})` : ""}, ${week.dailies} Daily Questions, ${week.nudges} hearts.`,
    partner && (myWins || theirWins) ? `Score: ${me.display_name} ${myWins}, ${partner.display_name} ${theirWins}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied.", "Paste it anywhere you like.");
      }
    } catch {
      // share sheet dismissed
    }
  }

  return (
    <section aria-labelledby="recap-h" className="rounded-[22px] border border-line bg-raised p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recap-h" className="eyebrow text-muted">
          Last week, together
        </h2>
        <span className="text-[0.8rem] text-muted">{range(week.start)}</span>
      </div>
      {partner && (myWins || theirWins) ? (
        <p className="display mt-2 text-[1.6rem] leading-tight">
          {myWins === theirWins ? "Dead even" : myWins > theirWins ? `${me.display_name} took the week` : `${partner.display_name} took the week`}{" "}
          <span className="text-muted">
            {myWins}–{theirWins}
          </span>
        </p>
      ) : null}
      {top ? <p className="mt-1 text-[0.9rem] text-muted">Most played: {top}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[0.75rem] text-muted">{label}</dt>
            <dd className="text-[1.2rem] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" icon="link" onClick={() => void share()}>
          Share our week
        </Button>
      </div>
    </section>
  );
}
