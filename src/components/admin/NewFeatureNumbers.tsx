import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { plusAdminData } from "@/lib/plus/admin";
import { naira } from "@/lib/plus/plans";
import { lagosDay } from "@/lib/solo/catalog";
import { compact } from "@/lib/format";

function Tile({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[0.82rem] text-muted">{label}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none">{value}</p>
      {sub ? <p className="mt-2 text-[0.78rem] text-muted">{sub}</p> : null}
    </>
  );
  return href ? (
    <Link prefetch={false} href={href} className="block rounded-[16px] border border-line bg-raised p-4 hover:border-line-strong">
      {body}
    </Link>
  ) : (
    <div className="rounded-[16px] border border-line bg-raised p-4">{body}</div>
  );
}

/** Plus, Solo, challenges and "Just me for now", on the Overview. Counts only. */
export async function NewFeatureNumbers() {
  const admin = supabaseAdmin();
  const today = lagosDay();
  const todayStart = new Date(Date.parse(`${today}T00:00:00Z`) - 3600_000).toISOString();
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const head = { count: "exact" as const, head: true };
  const [plus, playsToday, playsWeek, wordToday, sent, settled, justMe] = await Promise.all([
    plusAdminData(),
    admin.from("solo_scores").select("id", head).gte("created_at", todayStart),
    admin.from("solo_scores").select("id", head).gte("created_at", week),
    admin.from("solo_word_plays").select("user_id", head).eq("day", today),
    admin.from("solo_challenges").select("id", head).gte("created_at", week),
    admin.from("solo_challenges").select("id", head).gte("created_at", week).in("status", ["won", "lost"]),
    admin.from("profiles").select("id", head).eq("solo_home", true),
  ]);
  const live = !!plus.config.launched_at && Date.parse(plus.config.launched_at) <= Date.now();
  return (
    <section aria-labelledby="new-h" className="mt-8">
      <h2 id="new-h" className="text-[0.95rem] font-semibold">Plus and Solo</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Tile label="People with Plus" value={live ? compact(plus.people.total) : "Off"} sub={live ? `${plus.people.paid} paid · ${plus.people.trial} on trial` : "Plus isn't live yet"} href="/admin/plus" />
        <Tile label="Plus this month" value={naira(plus.revenue.month)} sub={`${plus.renewing} card plans renewing`} href="/admin/plus" />
        <Tile label="Solo games today" value={compact(playsToday.count ?? 0)} sub={`${compact(playsWeek.count ?? 0)} in 7 days`} />
        <Tile label="Today's word" value={compact(wordToday.count ?? 0)} sub="people playing today" href="/admin/words" />
        <Tile label="Challenges, 7 days" value={compact(sent.count ?? 0)} sub={`${compact(settled.count ?? 0)} played back`} />
        <Tile label={"\"Just me for now\""} value={compact(justMe.count ?? 0)} sub="Solo is their home" />
      </div>
    </section>
  );
}
