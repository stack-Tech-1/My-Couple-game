import { plusAdminData } from "@/lib/plus/admin";
import { PLANS, naira } from "@/lib/plus/plans";
import { BarList, ColumnChart } from "@/components/admin/Charts";
import { LaunchControl, PlusPersonTools, RefundButton } from "@/components/admin/PlusAdminTools";
import { cn } from "@/lib/cn";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-raised p-4">
      <p className="text-[0.82rem] text-muted">{label}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none">{value}</p>
      {sub ? <p className="mt-2 text-[0.78rem] text-muted">{sub}</p> : null}
    </div>
  );
}

function Card({ title, note, children, className, id }: { title: string; note?: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className={cn("scroll-mt-28 rounded-[18px] border border-line bg-raised p-5", className)}>
      <h2 id={`${id ?? title}-h`} className="text-[0.95rem] font-semibold">{title}</h2>
      {note ? <p className="mt-0.5 text-[0.8rem] text-muted">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const STATUS: Record<string, string> = { paid: "Paid", refunded: "Refunded", disputed: "Disputed", failed: "Failed" };
const METHOD = (m: string, ch: string | null) => (m === "card" ? "Card, renews" : ch === "bank_transfer" ? "Transfer" : ch === "ussd" ? "USSD" : ch === "card" ? "Card, once" : m === "admin" ? "Team" : "Once");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default async function AdminPlus({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const d = await plusAdminData(q);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

  return (
    <div>
      <h1 className="display text-[2.6rem] leading-none">Amah Plus</h1>
      <p className="mt-2 max-w-xl text-[0.9rem] text-muted">Launch day, money in, who has Plus, refunds and why people leave. Payment facts only; card details never reach Amah.</p>

      <Card title="Launch" className="mt-8" id="launch">
        <LaunchControl launchedAt={d.config.launched_at ?? null} earlyCount={d.config.early_count ?? 0} earlyDone={!!d.config.early_granted_at} />
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="People with Plus" value={d.people.total.toLocaleString()} sub={`${d.people.paid} paid · ${d.people.gift} gifted · ${d.people.trial} trial · ${d.people.early} thank-you · ${d.people.admin} team`} />
        <Tile label="This month" value={naira(d.revenue.month)} sub="Paid, Lagos time" />
        <Tile label="Last 30 days" value={naira(d.revenue.last30)} sub={`${naira(d.revenue.all)} all time`} />
        <Tile label="Card plans renewing" value={d.renewing.toLocaleString()} sub="Not cancelled" />
        <Tile label="Free trials" value={d.trials.started.toLocaleString()} sub={`${d.trials.converted} went on to pay (${pct(d.trials.converted, d.trials.started)})`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Money in, last 30 days" note="Naira, by day paid. Refunds not taken off.">
          <ColumnChart title="Naira paid per day" data={d.daily} unit="naira" />
        </Card>
        <Card title="By plan" note="Paid payments, all time">
          <BarList rows={d.byPlan.map((p) => ({ label: PLANS[p.plan].label, value: p.count, note: naira(p.naira) }))} valueLabel="payments" />
        </Card>
      </div>

      <Card title="Payments" note={q ? `Matching "${q}"` : "The latest 50. Search by payment reference or the payer's email."} className="mt-6" id="payments">
        <form className="mb-4 flex gap-2" action="/admin/plus#payments">
          <label htmlFor="pay-q" className="sr-only">Reference or email</label>
          <input id="pay-q" name="q" defaultValue={q ?? ""} placeholder="AMH-… or name@email.com" className="h-10 min-w-0 flex-1 rounded-[12px] border-[1.5px] border-line bg-bg px-3" />
          <button type="submit" className="rounded-full border-[1.5px] border-line-strong px-4 text-[0.88rem] font-semibold hover:bg-fg hover:text-bg">Search</button>
        </form>
        {d.payments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[0.85rem]">
              <caption className="sr-only">Payments</caption>
              <thead className="text-muted">
                <tr>
                  <th className="py-1.5 font-semibold">Date</th>
                  <th className="py-1.5 font-semibold">Who paid</th>
                  <th className="py-1.5 font-semibold">Plan</th>
                  <th className="py-1.5 font-semibold">How</th>
                  <th className="py-1.5 text-right font-semibold">Amount</th>
                  <th className="py-1.5 font-semibold">Status</th>
                  <th className="py-1.5 font-semibold">Reference</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {d.payments.map((p) => (
                  <tr key={p.id} className="border-t border-line align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{day(p.paid_at ?? p.created_at)}</td>
                    <td className="py-2 pr-3">
                      {p.payer_name ?? "Deleted account"}
                      {p.payer_email ? <span className="block text-[0.78rem] text-muted">{p.payer_email}</span> : null}
                    </td>
                    <td className="py-2 pr-3">
                      {PLANS[p.plan].label}, {p.period === "year" ? "yearly" : "monthly"}
                      {p.renews_from ? " (renewal)" : ""}
                      {p.seats > 1 ? <span className="block text-[0.78rem] text-muted">{p.seats_given} of {p.seats} seats given</span> : null}
                    </td>
                    <td className="py-2 pr-3">
                      {METHOD(p.method, p.channel)}
                      {p.method === "card" && p.cancelled_at ? <span className="block text-[0.78rem] text-muted">Cancelled</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular">{naira(p.amount_kobo / 100)}</td>
                    <td className={cn("py-2 pr-3", p.status !== "paid" && "text-accent-ink")}>{STATUS[p.status] ?? p.status}</td>
                    <td className="py-2 pr-3 font-mono text-[0.78rem]">{p.reference}</td>
                    <td className="py-2 text-right">{p.status === "paid" ? <RefundButton reference={p.reference} amount={naira(p.amount_kobo / 100)} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{q ? "No payments match." : "No payments yet."}</p>
        )}
        <p className="mt-3 text-[0.8rem] text-muted">Refund rule from the Terms: within 7 days of paying and fewer than 3 Plus games played since. One-off passes and gifts aren&apos;t refundable.</p>
      </Card>

      <Card title="Someone's Plus" note="Look someone up to see their Plus, give them some (a thank-you, or to fix a payment problem), or end a seat." className="mt-6" id="person">
        <PlusPersonTools />
      </Card>

      <Card title="Why people leave" note="From the question when someone leaves a room. Nobody's name is ever stored with it." className="mt-6" id="leaving">
        <table className="w-full text-left text-[0.88rem]">
          <caption className="sr-only">Reasons for leaving</caption>
          <thead className="text-muted">
            <tr>
              <th className="py-1.5 font-semibold">Reason</th>
              <th className="py-1.5 text-right font-semibold">Couple rooms</th>
              <th className="py-1.5 text-right font-semibold">Friend rooms</th>
              <th className="py-1.5 text-right font-semibold">Last 30 days</th>
            </tr>
          </thead>
          <tbody>
            {d.leaving.map((l) => (
              <tr key={l.reason} className="border-t border-line">
                <td className="py-2">{l.label}</td>
                <td className="py-2 text-right tabular">{l.couple}</td>
                <td className="py-2 text-right tabular">{l.reason === "breakup" || l.reason === "break" ? "–" : l.friends}</td>
                <td className="py-2 text-right tabular">{l.last30}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
