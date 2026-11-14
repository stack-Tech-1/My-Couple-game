import Link from "next/link";
import { AdireFill } from "@/design/adire";
import { Icon } from "@/design/icons";
import { cn } from "@/lib/cn";
import type { Today } from "@/lib/engage/today";
import type { WeekDay } from "@/lib/progress/model";
import { soloGame } from "@/lib/solo/catalog";
import { SoloArt } from "@/components/solo/SoloArt";

const LETTER = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Today, in one place: the streak (with this week's rest day), today's game against each other,
 * today's word, the free game of the week, and a memory from this day.
 */
export function TodayCard({ roomId, today, streak, restUsed, week }: { roomId: string; today: Today; streak: number; restUsed: boolean; week: WeekDay[] | undefined }) {
  const g = soloGame(today.game.gameId)!;
  const me = today.game.scores[0];
  const others = today.game.scores.slice(1);
  const date = new Date(`${today.day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

  return (
    <section aria-labelledby="today-h" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-h" className="display text-[1.8rem] leading-none">Today</h2>
        <p className="text-[0.85rem] font-semibold text-muted">{date}</p>
      </div>

      {/* The streak and this week. */}
      {week?.length ? (
        <div className="glass rounded-[22px] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[1.25rem]", streak ? "bg-accent text-[#fff8f0]" : "bg-sunk text-muted")}>{streak}</span>
            <div className="min-w-0">
              <p className="font-bold">{streak ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "Start a streak today"}</p>
              <p className="text-[0.82rem] text-muted">{restUsed ? "This week's rest day is used. Keep it going." : "One rest day a week, so a busy day won't break it."}</p>
            </div>
          </div>
          <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label="This week">
            {week.map((d, i) => (
              <li key={d.day} className="flex flex-col items-center gap-1">
                <span
                  role="img"
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-[9px] text-[0.62rem] font-extrabold",
                    d.status === "together" && "bg-accent text-[#fff8f0]",
                    d.status === "rest" && "bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] text-accent-ink",
                    d.status === "today" && "border-2 border-dashed border-accent",
                    d.status === "missed" && "bg-sunk",
                    d.status === "later" && "bg-sunk opacity-50",
                  )}
                  aria-label={`${new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long" })}: ${d.status === "together" ? "together" : d.status === "rest" ? "rest day" : d.status === "today" ? "today" : d.status === "missed" ? "missed" : "still to come"}`}
                >
                  {d.status === "rest" ? "REST" : d.status === "together" ? <Icon name="heart" size={12} /> : ""}
                </span>
                <span className="text-[0.66rem] font-bold text-muted" aria-hidden>{LETTER[i]}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* Today's game: the same level for everyone, one go each. */}
      <Link prefetch={false} href={me?.played ? `/solo/${g.id}` : `/solo/${g.id}?daily=1`} className="relative block overflow-hidden rounded-[22px] text-[#1c1416]">
        <AdireFill motif={g.look.motif} bg={g.look.bg} ink={g.look.ink} />
        <div className="relative flex gap-3 p-4">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full bg-[#1c1416] px-2.5 py-1 text-[0.68rem] font-extrabold text-[#f6d26a]">TODAY&apos;S GAME</span>
            <p className="display mt-2 text-[1.6rem] leading-tight text-[#fffaf4] [text-shadow:0_2px_0_rgba(28,20,22,.35)]">{g.name}</p>
            <p className="text-[0.85rem] font-semibold text-[#fffaf4]/95">Same level for everyone today. One go each.</p>
          </div>
          <SoloArt id={g.id} className="h-16 w-auto shrink-0 self-center" />
        </div>
        <div className="relative grid grid-cols-2 gap-2 px-4 pb-4">
          <div className="rounded-[14px] bg-[rgba(255,250,244,.95)] px-3 py-2">
            <p className="text-[0.7rem] font-extrabold text-[#a2412c]">YOU</p>
            <p className="font-extrabold">{me?.score ?? (me?.played ? "Playing" : "Your turn")}</p>
          </div>
          {others.slice(0, 1).map((o) => (
            <div key={o.userId} className="rounded-[14px] bg-[rgba(255,250,244,.3)] px-3 py-2 text-[#fffaf4]">
              <p className="truncate text-[0.7rem] font-extrabold uppercase opacity-90">{o.name}</p>
              <p className="font-extrabold">{o.score ?? (o.played ? "Playing" : "Not yet")}</p>
            </div>
          ))}
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link prefetch={false} href="/solo/oro" className="glass rounded-[18px] p-3.5">
          <p className="text-[0.7rem] font-extrabold" style={{ color: "var(--cat-personal-ink)" }}>Ọ̀RỌ̀ OF THE DAY</p>
          <p className="mt-1.5 font-bold leading-snug">{today.word.finished ? (today.word.solved ? `Solved in ${today.word.guesses}` : "Not this time") : today.word.started ? `${today.word.guesses} guess${today.word.guesses === 1 ? "" : "es"} so far` : "One word, six guesses"}</p>
          <p className="mt-1 text-[0.78rem] text-muted">{today.word.finished ? "A new one at midnight" : "Play it"}</p>
        </Link>
        {today.freeGame ? (
          <Link prefetch={false} href={`/room/${roomId}/games/${today.freeGame.gameId}`} className="glass rounded-[18px] p-3.5">
            <p className="text-[0.7rem] font-extrabold" style={{ color: "var(--cat-romantic-ink)" }}>FREE THIS WEEK</p>
            <p className="mt-1.5 font-bold leading-snug">{today.freeGame.name}</p>
            <p className="mt-1 text-[0.78rem] text-muted">A Plus game, open to everyone until Sunday</p>
          </Link>
        ) : null}
      </div>

      {today.memory ? (
        <Link prefetch={false} href={`/room/${roomId}/games/memory-lane`} className="glass flex items-center gap-3 rounded-[18px] px-4 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#f4b26b,#d9521f)] text-[#fff8f0]">
            <Icon name="camera" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{today.memory.when === "month" ? "A month ago today" : today.memory.years === 1 ? "A year ago today" : `${today.memory.years} years ago today`}</span>
            <span className="block truncate text-[0.82rem] text-muted">{today.memory.prompt}</span>
          </span>
          <Icon name="arrowRight" size={16} className="text-muted" />
        </Link>
      ) : null}
    </section>
  );
}
