import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "–");

/** Friend rooms: names, owners and who's in them. Never what anyone says inside. */
export default async function AdminRooms({ searchParams }: { searchParams: Promise<{ q?: string; room?: string }> }) {
  const { q, room } = await searchParams;
  const admin = supabaseAdmin();
  let query = admin.from("rooms").select("id, name, owner_id, created_at").eq("kind", "friends").order("created_at", { ascending: false }).limit(100);
  const s = q?.trim().replace(/[%_,()]/g, "");
  if (s) query = query.ilike("name", `%${s}%`);
  const { data: rooms } = await query;
  const ids = (rooms ?? []).map((r) => r.id as string);
  const [{ data: members }, { data: games }] = ids.length
    ? await Promise.all([
        admin.from("room_members").select("room_id, user_id, joined_at").in("room_id", ids),
        admin.from("game_sessions").select("room_id, created_at").in("room_id", ids).order("created_at", { ascending: false }).limit(5000),
      ])
    : [{ data: [] }, { data: [] }];
  const people = [...new Set([...(members ?? []).map((m) => m.user_id as string), ...(rooms ?? []).map((r) => r.owner_id as string).filter(Boolean)])];
  const { data: profiles } = people.length ? await admin.from("profiles").select("id, display_name").in("id", people) : { data: [] };
  const nameOf = (id: string | null) => ((profiles ?? []).find((p) => p.id === id)?.display_name as string | undefined) ?? "Someone";
  const open = room && ids.includes(room) ? room : null;
  const openMembers = open ? (members ?? []).filter((m) => m.room_id === open) : [];
  const emails = open ? await Promise.all(openMembers.map(async (m) => [m.user_id as string, (await admin.auth.admin.getUserById(m.user_id as string)).data.user?.email ?? ""] as const)) : [];

  return (
    <div className="max-w-4xl">
      <h1 className="display text-[2.6rem] leading-none">Friend rooms</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">Every friend room: its name, owner and who&apos;s in it. Never the chat or anything shared inside.</p>
      <form className="mt-6 flex gap-2" action="/admin/rooms">
        <label htmlFor="rooms-q" className="sr-only">Search by room name</label>
        <input id="rooms-q" name="q" defaultValue={q ?? ""} placeholder="Room name" className="h-11 min-w-0 flex-1 rounded-[12px] border-[1.5px] border-line bg-raised px-3" />
        <button className="rounded-full bg-fg px-5 font-semibold text-bg">Search</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-[18px] border border-line bg-raised">
        <table className="w-full min-w-[40rem] text-left text-[0.88rem]">
          <caption className="sr-only">Friend rooms</caption>
          <thead className="text-[0.78rem] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Room</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 text-right font-semibold">People</th>
              <th className="px-4 py-3 font-semibold">Started</th>
              <th className="px-4 py-3 font-semibold">Last game</th>
            </tr>
          </thead>
          <tbody>
            {(rooms ?? []).map((r) => {
              const n = (members ?? []).filter((m) => m.room_id === r.id).length;
              const last = (games ?? []).find((g) => g.room_id === r.id)?.created_at as string | undefined;
              return (
                <tr key={r.id as string} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <Link prefetch={false} href={`/admin/rooms?${new URLSearchParams({ ...(q ? { q } : {}), room: r.id as string })}#people`} className="font-semibold hover:underline">
                      {r.name as string}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{nameOf(r.owner_id as string | null)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{n} of 8</td>
                  <td className="px-4 py-2.5 tabular-nums">{day(r.created_at as string)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{day(last ?? null)}</td>
                </tr>
              );
            })}
            {!rooms?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No friend rooms{q ? " match" : " yet"}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <section id="people" aria-labelledby="people-h" className="mt-8 scroll-mt-28 rounded-[18px] border border-line bg-raised p-5">
          <h2 id="people-h" className="text-[0.95rem] font-semibold">Who&apos;s in {(rooms ?? []).find((r) => r.id === open)?.name as string}</h2>
          <ul className="mt-3 divide-y divide-line">
            {openMembers.map((m) => {
              const email = emails.find((e) => e[0] === m.user_id)?.[1] ?? "";
              return (
                <li key={m.user_id as string} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {nameOf(m.user_id as string)}
                      {(rooms ?? []).find((r) => r.id === open)?.owner_id === m.user_id ? <span className="ml-2 text-[0.75rem] font-normal text-muted">Owner</span> : null}
                    </span>
                    <span className="block text-[0.82rem] text-muted">{email}</span>
                  </span>
                  <span className="text-[0.8rem] text-muted">Joined {day(m.joined_at as string)}</span>
                  {email ? (
                    <Link prefetch={false} href={`/admin/users?email=${encodeURIComponent(email)}#manage`} className="text-[0.85rem] font-semibold text-accent-ink hover:underline">
                      Manage
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
