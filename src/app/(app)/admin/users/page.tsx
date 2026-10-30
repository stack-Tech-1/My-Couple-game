import Link from "next/link";
import { listUsers, USER_FILTERS, USERS_PAGE, type UserFilter } from "@/lib/admin/server";
import { UserTools } from "@/components/admin/UserTools";
import { PersonDetail } from "@/components/admin/PersonDetail";
import { cn } from "@/lib/cn";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/admin/server";

const FILTER_LABEL: Record<UserFilter, string> = { all: "Everyone", paired: "Paired", waiting: "Waiting for partner", no_room: "No room yet", suspended: "Suspended", admins: "Admins" };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" }) : "–");

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string; email?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const filter = (USER_FILTERS as readonly string[]).includes(sp.filter ?? "") ? (sp.filter as UserFilter) : "all";
  const page = Math.max(0, Number(sp.page) || 0);
  const { rows, total } = await listUsers(q, filter, page);
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE));
  const href = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const next: Record<string, string | number | undefined> = { q, filter, page, ...over };
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === "" || (k === "filter" && v === "all") || (k === "page" && v === 0)) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <h1 className="display text-[2.6rem] leading-none">Users</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">Everyone with an account. Account facts only, never what anyone has written or shared.</p>

      <form action="/admin/users" className="mt-8 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
          <span className="text-[0.82rem] font-semibold">Search by name or email</span>
          <input name="q" defaultValue={q} placeholder="ada@… or Ada" className="h-12 rounded-[var(--radius)] border-[1.5px] border-line bg-raised px-4 text-[1rem] focus:border-line-strong focus:outline-none" />
        </label>
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <button className="h-12 rounded-full bg-fg px-5 font-semibold text-bg">Search</button>
      </form>

      <nav aria-label="Filter users" className="mt-4 flex flex-wrap gap-2">
        {USER_FILTERS.map((f) => (
          <Link prefetch={false}
            key={f}
            href={href({ filter: f, page: 0 })}
            aria-current={f === filter ? "true" : undefined}
            className={cn("rounded-full px-3 py-1.5 text-[0.82rem] font-semibold", f === filter ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg")}
          >
            {FILTER_LABEL[f]}
          </Link>
        ))}
      </nav>

      <p className="mt-5 text-[0.85rem] text-muted">
        {filter === "paired" ? `${Math.ceil(total / 2).toLocaleString()} ${Math.ceil(total / 2) === 1 ? "couple" : "couples"}` : `${total.toLocaleString()} ${total === 1 ? "account" : "accounts"}`}
        {q ? ` matching “${q}”` : ""}
      </p>

      {filter === "paired" ? (
        <Couples rows={rows} manage={(email) => `${href({ email })}#manage`} />
      ) : (
      <div className="mt-3 overflow-x-auto rounded-[18px] border border-line bg-raised">
        <table className="w-full min-w-[34rem] text-[0.88rem]">
          <caption className="sr-only">Accounts</caption>
          <thead className="text-left text-[0.78rem] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Person</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold">Last active</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Manage</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const suspended = !!u.banned_until && Date.parse(u.banned_until) > Date.now();
              return (
                <tr key={u.id} className={cn("border-t border-line align-top", sp.email === u.email && "bg-sunk")}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {u.display_name || <span className="text-muted">No name yet</span>}
                      {u.is_admin ? <span className="ml-2 rounded-full bg-fg px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-bg">Admin</span> : null}
                      {suspended ? <span className="ml-2 rounded-full bg-accent-ink px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-bg">Suspended</span> : null}
                    </p>
                    <p className="text-muted">{u.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day(u.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day(u.last_active)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link prefetch={false} href={`${href({ email: u.email })}#manage`} className="font-semibold text-accent-ink hover:underline" aria-label={`Manage ${u.email}`}>
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={4}className="px-4 py-10 text-center text-muted">
                  Nobody matches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[0.88rem]">
          {page > 0 ? (
            <Link prefetch={false} href={href({ page: page - 1 })} className="font-semibold hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page + 1} of {pages}
          </span>
          {page + 1 < pages ? (
            <Link prefetch={false} href={href({ page: page + 1 })} className="font-semibold hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {sp.email ? <PersonDetail email={sp.email} /> : null}

      <section id="manage" aria-labelledby="manage-h" className="mt-12 max-w-2xl scroll-mt-28">
        <h2 id="manage-h" className="display text-[1.9rem]">
          Manage an account
        </h2>
        <p className="mt-1 text-[0.9rem] text-muted">Pick someone above, or look them up by their exact email.</p>
        <UserTools key={sp.email ?? ""} initialEmail={sp.email ?? ""} />
      </section>
    </div>
  );
}

/** "Paired": one row per couple, both people side by side. */
async function Couples({ rows, manage }: { rows: UserRow[]; manage: (email: string) => string }) {
  // Each couple appears twice in the account list (once per person): keep it once.
  const seen = new Set<string>();
  const couples = rows.filter((r) => r.room_id && r.partner_id && !seen.has(r.room_id) && seen.add(r.room_id));
  const roomIds = couples.map((c) => c.room_id!);
  const { data: games } = roomIds.length ? await supabaseAdmin().from("game_sessions").select("room_id").in("room_id", roomIds).eq("status", "finished").limit(20000) : { data: [] };
  const count = (rid: string) => (games ?? []).filter((g) => g.room_id === rid).length;
  const lastOf = (r: UserRow) => {
    const other = rows.find((x) => x.id === r.partner_id);
    const a = r.last_active ?? "";
    const b = other?.last_active ?? "";
    return a > b ? a : b || null;
  };
  return (
    <div className="mt-3 overflow-x-auto rounded-[18px] border border-line bg-raised">
      <table className="w-full min-w-[40rem] text-[0.88rem]">
        <caption className="sr-only">Couples</caption>
        <thead className="text-left text-[0.78rem] text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Couple</th>
            <th className="px-4 py-3 font-semibold">Paired since</th>
            <th className="px-4 py-3 font-semibold">Last active</th>
            <th className="px-4 py-3 text-right font-semibold">Games together</th>
          </tr>
        </thead>
        <tbody>
          {couples.map((c) => (
            <tr key={c.room_id} className="border-t border-line align-top">
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <Person name={c.display_name} email={c.email} href={manage(c.email)} />
                  <span aria-hidden className="pt-0.5 text-accent">♥</span>
                  <span className="sr-only">and</span>
                  <Person name={c.partner_name} email={c.partner_email ?? ""} href={c.partner_email ? manage(c.partner_email) : undefined} />
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day(c.paired_at)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day(lastOf(c))}</td>
              <td className="px-4 py-3 text-right tabular-nums">{count(c.room_id!)}</td>
            </tr>
          ))}
          {!couples.length ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-muted">
                No couples match.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Person({ name, email, href }: { name: string | null; email: string; href?: string }) {
  const body = (
    <>
      <span className="block font-semibold">{name || "No name yet"}</span>
      <span className="block text-muted">{email}</span>
    </>
  );
  return href ? (
    <Link prefetch={false} href={href} className="hover:underline" aria-label={`Manage ${email}`}>
      {body}
    </Link>
  ) : (
    <span>{body}</span>
  );
}