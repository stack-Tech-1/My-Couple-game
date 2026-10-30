import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { plusUser } from "@/lib/plus/admin";
import { PLANS, naira } from "@/lib/plus/plans";
import { formatScore, soloGame } from "@/lib/solo/catalog";
import { myBests } from "@/lib/solo/server";
import type { Purchase } from "@/lib/plus/server";

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");
const SOURCE: Record<string, string> = { paid: "Paid", gift: "Gift", trial: "Free trial", early: "Thank-you month", admin: "From the team" };

/** Everything about one person in one place: rooms, Plus and payments, Solo. Never what they wrote. */
export async function PersonDetail({ email }: { email: string }) {
  const person = await plusUser(email);
  if (!person) return null;
  const admin = supabaseAdmin();
  const [{ data: memberships }, { data: bought }, bests, { count: wordDays }, { count: challengesSent }, { data: profile }] = await Promise.all([
    admin.from("room_members").select("room_id, joined_at").eq("user_id", person.id),
    admin.from("plus_purchases").select("*").eq("payer_id", person.id).neq("status", "pending").order("created_at", { ascending: false }).limit(20),
    myBests(person.id),
    admin.from("solo_word_plays").select("day", { count: "exact", head: true }).eq("user_id", person.id).not("finished_at", "is", null),
    admin.from("solo_challenges").select("id", { count: "exact", head: true }).eq("from_user", person.id),
    admin.from("profiles").select("solo_home, created_at").eq("id", person.id).maybeSingle(),
  ]);
  const roomIds = (memberships ?? []).map((m) => m.room_id as string);
  const [{ data: rooms }, { data: others }] = roomIds.length
    ? await Promise.all([admin.from("rooms").select("id, name, kind, paired_at, owner_id").in("id", roomIds), admin.from("room_members").select("room_id, user_id").in("room_id", roomIds)])
    : [{ data: [] }, { data: [] }];
  const otherIds = [...new Set((others ?? []).map((o) => o.user_id as string).filter((id) => id !== person.id))];
  const { data: names } = otherIds.length ? await admin.from("profiles").select("id, display_name").in("id", otherIds) : { data: [] };
  const nameOf = (id: string) => ((names ?? []).find((n) => n.id === id)?.display_name as string | undefined) ?? "Someone";
  const purchases = (bought ?? []) as Purchase[];
  const paidTotal = purchases.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount_kobo / 100, 0);
  const plays = bests.reduce((a, b) => a + b.plays, 0);

  return (
    <section aria-labelledby="person-h" className="mt-10 grid gap-4 md:grid-cols-2">
      <h2 id="person-h" className="display text-[1.9rem] md:col-span-2">
        {person.name ?? "No name yet"} <span className="text-[1rem] text-muted">{person.email}</span>
      </h2>

      <div className="rounded-[18px] border border-line bg-raised p-4">
        <h3 className="text-[0.95rem] font-semibold">Rooms</h3>
        {(rooms ?? []).length ? (
          <ul className="mt-2 flex flex-col gap-2 text-[0.88rem]">
            {(rooms ?? []).map((r) => {
              const with_ = (others ?? []).filter((o) => o.room_id === r.id && o.user_id !== person.id).map((o) => nameOf(o.user_id as string));
              return (
                <li key={r.id as string}>
                  <span className="font-semibold">{r.kind === "couple" ? "Couple room" : (r.name as string)}</span>
                  <span className="text-muted">
                    {" "}
                    · {r.kind === "couple" ? (with_.length ? `with ${with_[0]}, since ${day(r.paired_at as string)}` : "waiting for their person") : `${with_.length + 1} people${r.owner_id === person.id ? ", owner" : ""}`}
                  </span>
                  {r.kind === "friends" ? (
                    <Link prefetch={false} href={`/admin/rooms?room=${r.id}#people`} className="ml-2 text-accent-ink hover:underline">
                      See
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[0.88rem] text-muted">{profile?.solo_home ? "No rooms. Chose \"Just me for now\"." : "No rooms yet."}</p>
        )}
      </div>

      <div className="rounded-[18px] border border-line bg-raised p-4">
        <h3 className="text-[0.95rem] font-semibold">Amah Plus</h3>
        <p className="mt-2 text-[0.88rem]">
          {person.until ? (
            <>
              Has Plus until <b>{day(person.until)}</b>
              {person.seats[0] ? ` (${SOURCE[person.seats.find((s) => !s.revoked_at)?.source ?? ""] ?? "Plus"})` : ""}.
            </>
          ) : (
            "No Plus right now."
          )}{" "}
          <span className="text-muted">{person.trialUsed ? "Free trial used." : "Free trial not used."}</span>
        </p>
        <p className="mt-1 text-[0.88rem] text-muted">
          {purchases.length ? `${purchases.length} payment${purchases.length === 1 ? "" : "s"}, ${naira(paidTotal)} paid in total.` : "Never paid."}
        </p>
        {purchases.length ? (
          <ul className="mt-2 text-[0.82rem]">
            {purchases.slice(0, 4).map((p) => (
              <li key={p.id} className="flex justify-between gap-2 border-t border-line py-1.5">
                <span>
                  {day(p.paid_at ?? p.created_at)} · {PLANS[p.plan].label}
                  {p.status !== "paid" ? ` (${p.status})` : ""}
                </span>
                <span className="font-mono">{p.reference}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Link prefetch={false} href={`/admin/plus?q=${encodeURIComponent(person.email)}#payments`} className="mt-2 inline-block text-[0.85rem] font-semibold text-accent-ink hover:underline">
          Payments, refunds and giving Plus
        </Link>
      </div>

      <div className="rounded-[18px] border border-line bg-raised p-4 md:col-span-2">
        <h3 className="text-[0.95rem] font-semibold">Solo</h3>
        <p className="mt-2 text-[0.88rem] text-muted">
          {plays} games played · today&apos;s word finished on {wordDays ?? 0} days · {challengesSent ?? 0} challenges sent
        </p>
        {bests.length ? (
          <ul className="mt-2 flex flex-wrap gap-2 text-[0.82rem]">
            {bests
              .filter((b) => soloGame(b.gameId) && soloGame(b.gameId)!.kind !== "bot")
              .map((b) => {
                const g = soloGame(b.gameId)!;
                return (
                  <li key={`${b.gameId}-${b.mode}`} className="rounded-full bg-sunk px-3 py-1">
                    {g.name}: best {formatScore(g, b.best)}
                  </li>
                );
              })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
