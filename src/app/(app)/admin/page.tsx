import Link from "next/link";
import { getStats } from "@/lib/admin/server";
import { gameMeta } from "@/games/catalog";
import { BarList, ColumnChart, RetentionGrid, TrendChart } from "@/components/admin/Charts";
import { compact } from "@/lib/format";
import { cn } from "@/lib/cn";

const RANGES = [7, 30, 90] as const;

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-raised p-4">
      <p className="text-[0.82rem] text-muted">{label}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none">{typeof value === "number" ? compact(value) : value}</p>
      {sub ? <p className="mt-2 text-[0.78rem] text-muted">{sub}</p> : null}
    </div>
  );
}

function Card({ title, note, children, className }: { title?: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[18px] border border-line bg-raised p-5", className)}>
      {title ? <h2 className="text-[0.95rem] font-semibold">{title}</h2> : null}
      {note ? <p className="mt-0.5 text-[0.8rem] text-muted">{note}</p> : null}
      <div className={title ? "mt-4" : undefined}>{children}</div>
    </section>
  );
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const days = RANGES.find((r) => String(r) === raw) ?? 30;
  const stats = await getStats(days);

  if (!stats) {
    return <p className="py-16 text-center text-muted">The numbers didn&apos;t load. Refresh to try again.</p>;
  }
  const t = stats.totals;
  const series = (k: "signups" | "active" | "games" | "messages") => stats.daily.map((p) => ({ d: p.d, v: Number(p[k]) }));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[2.6rem] leading-none">Overview</h1>
          <p className="mt-2 max-w-xl text-[0.9rem] text-muted">Counts only. Nobody&apos;s messages, notes, answers, photos or After Dark activity are ever read or counted here.</p>
        </div>
        {/* One filter row, above everything it scopes. */}
        <nav aria-label="Date range" className="flex rounded-full border border-line bg-raised p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin?days=${r}`}
              aria-current={r === days ? "true" : undefined}
              className={cn("rounded-full px-3.5 py-1.5 text-[0.85rem] font-semibold", r === days ? "bg-fg text-bg" : "text-muted hover:text-fg")}
            >
              Last {r} days
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="People" value={t.users} sub={`+${t.new_users.toLocaleString()} in ${days} days · ${t.onboarded.toLocaleString()} set up`} />
        <Tile label="Couples paired" value={t.paired_rooms} sub={`${pct(t.paired_rooms, t.rooms)} of ${t.rooms.toLocaleString()} rooms`} />
        <Tile label="Active people" value={t.active_users} sub={`Today ${t.dau} · 7 days ${t.wau} · 30 days ${t.mau}`} />
        <Tile label="Games started" value={t.games} sub={`${t.active_couples.toLocaleString()} active couples`} />
        <Tile label="Chat messages" value={t.messages} sub={`${t.voice_notes.toLocaleString()} voice · ${t.stickers.toLocaleString()} stickers`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <TrendChart title="Active people per day" data={series("active")} unit="people" />
        </Card>
        <Card>
          <ColumnChart title="New sign-ups per day" data={series("signups")} unit="sign-ups" />
        </Card>
        <Card>
          <TrendChart title="Games started per day" data={series("games")} unit="games" />
        </Card>
        <Card>
          <TrendChart title="Chat messages per day" data={series("messages")} unit="messages" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card title="Most played" note={`Games started in the last ${days} days, and how many were played to the end. After Dark isn't counted.`}>
          <BarList
            valueLabel="games started"
            rows={stats.games.map((g) => ({ label: gameMeta(g.game_id)?.name ?? g.game_id, value: g.started, note: `${pct(g.finished, g.started)} finished` }))}
          />
        </Card>
        <Card title="Do people come back?" note="Of everyone who signed up in a given week, the share who played, chatted or answered the Daily Question in each week after.">
          <RetentionGrid rows={stats.retention} />
        </Card>
      </div>

      <p className="mt-6 text-[0.78rem] text-muted">
        “Active” means making a game move, sending a chat message or answering the Daily Question that day (UTC). {t.suspended ? `${t.suspended} suspended account${t.suspended === 1 ? "" : "s"}.` : ""} Updated{" "}
        {new Date(stats.generated_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.
      </p>
    </div>
  );
}
