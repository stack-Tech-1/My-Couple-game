import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

const WHAT: Record<string, string> = {
  "user.suspend": "Suspended an account",
  "user.unsuspend": "Lifted a suspension",
  "user.delete": "Deleted an account",
  "games.switches": "Changed game switches",
  "announcement.create": "Posted an announcement",
  "announcement.end": "Ended an announcement",
  "announcement.email": "Emailed an announcement",
  "feedback.update": "Updated feedback",
  "feedback.reply": "Replied to feedback",
  "suggestion.approve": "Approved a suggestion",
  "suggestion.reject": "Turned down a suggestion",
  "report.update": "Updated a report",
  "content.add": "Added content",
  "content.hide": "Hid or showed content",
  "sticker.add": "Added a starter sticker",
  "sticker.remove": "Removed a starter sticker",
  "plus.launch": "Set Plus launch day",
  "plus.switch_off": "Switched Plus off",
  "plus.give": "Gave someone Plus",
  "plus.end_seat": "Ended a Plus seat",
  "plus.refund": "Refunded a payment",
  "fixam.add": "Added a Fix Am picture",
  "fixam.update": "Changed a Fix Am picture",
  "fixam.delete": "Deleted a Fix Am picture",
  "word.set": "Set a day's word",
  "word.clear": "Undid a day's word",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

export default async function AdminActivity({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let query = supabaseAdmin().from("admin_audit").select("*").order("created_at", { ascending: false }).limit(200);
  const s = q?.trim().replace(/[%_,()]/g, "");
  if (s) query = query.or(`action.ilike.%${s}%,target.ilike.%${s}%,admin_email.ilike.%${s}%`);
  const { data } = await query;
  const rows = data ?? [];

  return (
    <div className="max-w-4xl">
      <h1 className="display text-[2.6rem] leading-none">Activity</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">Everything done in the admin: refunds, Plus given, suspensions, deleted accounts, launch day, announcements and more. Who did it, and when (Lagos time). Entries can&apos;t be edited or removed.</p>
      <form className="mt-6 flex gap-2" action="/admin/activity">
        <label htmlFor="act-q" className="sr-only">Search the log</label>
        <input id="act-q" name="q" defaultValue={q ?? ""} placeholder="refund, plus, an email or a reference…" className="h-11 min-w-0 flex-1 rounded-[12px] border-[1.5px] border-line bg-raised px-3" />
        <button className="rounded-full bg-fg px-5 font-semibold text-bg">Search</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-[18px] border border-line bg-raised">
        <table className="w-full min-w-[40rem] text-left text-[0.88rem]">
          <caption className="sr-only">Admin activity</caption>
          <thead className="text-[0.78rem] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Who</th>
              <th className="px-4 py-3 font-semibold">What</th>
              <th className="px-4 py-3 font-semibold">On</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id as number} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{when(r.created_at as string)}</td>
                <td className="px-4 py-2.5">{(r.admin_email as string) ?? "An admin"}</td>
                <td className="px-4 py-2.5">
                  {WHAT[r.action as string] ?? (r.action as string)}
                  {r.detail && Object.keys(r.detail as object).length ? <span className="block max-w-[22rem] truncate text-[0.78rem] text-muted">{JSON.stringify(r.detail)}</span> : null}
                </td>
                <td className="max-w-[16rem] truncate px-4 py-2.5 font-mono text-[0.78rem]">{(r.target as string) ?? ""}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  {q ? "Nothing matches." : "Nothing yet."} {q ? <Link href="/admin/activity" className="underline">Show everything</Link> : null}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
