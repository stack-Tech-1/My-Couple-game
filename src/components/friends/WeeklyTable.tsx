import Link from "next/link";
import { Avatar } from "@/design/Avatar";
import { gameMeta } from "@/games/catalog";
import type { FriendWeek } from "@/lib/engage/weekly";
import type { RoomPerson } from "@/lib/room/types";
import { cn } from "@/lib/cn";

const MEDAL = ["#c9952e", "#8a8f99", "#b0723a"];

/** This week's table in a friend room (resets Monday), last week's winner, and the Gang of the Week race. */
export function WeeklyTable({ week, members, me, roomName }: { week: FriendWeek; members: RoomPerson[]; me: string; roomName: string }) {
  const person = (id: string) => members.find((m) => m.profile.id === id)?.profile;
  const anyone = week.rows.some((r) => r.played > 0);
  const lastName = week.lastWinner ? (week.lastWinner.userId === me ? "You" : (person(week.lastWinner.userId)?.display_name ?? "Someone")) : null;
  return (
    <section aria-labelledby="week-h" className="flex flex-col gap-3">
      <div className="glass flex items-baseline justify-between gap-3 rounded-[18px] px-4 py-3">
        <h2 id="week-h" className="display text-[1.6rem] leading-none">This week</h2>
        <p className="text-[0.82rem] font-semibold text-muted">3 a win, 1 a game. Resets Monday.</p>
      </div>
      <ol className="glass rounded-[22px] px-4 py-1.5" aria-label="This week's table">
        {week.rows.map((r, i) => {
          const p = person(r.userId);
          if (!p) return null;
          return (
            <li key={r.userId} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="w-5 text-center text-[1.05rem] font-extrabold" style={{ color: anyone && r.points ? (MEDAL[i] ?? "var(--muted)") : "var(--muted)" }}>
                {i + 1}
              </span>
              <Avatar name={p.display_name} motif={p.avatar_key} hue={p.avatar_hue} size={34} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-semibold", r.userId === me && "font-extrabold")}>{r.userId === me ? "You" : p.display_name}</span>
                <span className="block truncate text-[0.78rem] text-muted">
                  {r.played ? `${r.wins} win${r.wins === 1 ? "" : "s"} in ${r.played} game${r.played === 1 ? "" : "s"}${r.topGame ? `, best at ${gameMeta(r.topGame)?.name ?? r.topGame}` : ""}` : "No games yet this week"}
                </span>
              </span>
              <span className="tabular-nums font-extrabold">{r.points}</span>
            </li>
          );
        })}
      </ol>
      {week.race ? (
        <Link prefetch={false} href="/spotlight" className="block rounded-[22px] bg-[#1c1416] p-4 text-[#f6efe6]">
          <span className="inline-block rounded-full bg-[#f6d26a] px-2.5 py-1 text-[0.68rem] font-extrabold text-[#1c1416]">GANG OF THE WEEK RACE</span>
          <span className="display mt-2 block text-[1.3rem]">
            {roomName} is {ordinal(week.race.rank)} on Amah
          </span>
          <span className="mt-1 block text-[0.85rem] text-[#cdbfc0]">{week.race.rank <= 3 ? "In the top three. Keep it up until Wednesday and you could be asked on Thursday." : "The top three on Thursday are asked. Play together, every day counts."}</span>
        </Link>
      ) : null}
      {lastName && week.lastWinner ? (
        <p className="glass rounded-[18px] px-4 py-3 text-[0.9rem]">
          <b>Last week&apos;s winner:</b> {lastName} with {week.lastWinner.points} points{week.lastWinner.topGame ? `, mostly ${gameMeta(week.lastWinner.topGame)?.name ?? ""}` : ""}.
        </p>
      ) : null}
    </section>
  );
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${n % 10 > 3 ? "th" : s}`;
}
