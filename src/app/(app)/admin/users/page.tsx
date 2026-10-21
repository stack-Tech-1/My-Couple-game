import Link from "next/link";
import { listUsers, USER_FILTERS, USERS_PAGE, type UserFilter } from "@/lib/admin/server";
import { UserTools } from "@/components/admin/UserTools";
import { cn } from "@/lib/cn";

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
      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">Everyone with an account, and who they&apos;re paired with. Account facts only, never what anyone has written or shared.</p>

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
          <Link
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
        {total.toLocaleString()} {total === 1 ? "account" : "accounts"}
        {q ? ` matching “${q}”` : ""}
      </p>

      <div className="mt-3 overflow-x-auto rounded-[18px] border border-line bg-raised">
        <table className="w-full min-w-[46rem] text-[0.88rem]">
          <caption className="sr-only">Accounts and their partners</caption>
          <thead className="text-left text-[0.78rem] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Person</th>
              <th className="px-4 py-3 font-semibold">Paired with</th>
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
                  <td className="px-4 py-3">
                    {u.partner_id ? (
                      <Link href={href({ q: u.partner_email ?? "", filter: "all", page: 0 })} className="hover:underline">
                        <span className="font-semibold">{u.partner_name || "No name yet"}</span>
                        <span className="block text-muted">{u.partner_email}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">{u.room_id ? "Waiting for a partner" : "No room yet"}</span>
                    )}
                    {u.paired_at ? <span className="block text-[0.75rem] text-muted">since {day(u.paired_at)}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day(u.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day(u.last_active)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`${href({ email: u.email })}#manage`} className="font-semibold text-accent-ink hover:underline" aria-label={`Manage ${u.email}`}>
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  Nobody matches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[0.88rem]">
          {page > 0 ? (
            <Link href={href({ page: page - 1 })} className="font-semibold hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page + 1} of {pages}
          </span>
          {page + 1 < pages ? (
            <Link href={href({ page: page + 1 })} className="font-semibold hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

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
