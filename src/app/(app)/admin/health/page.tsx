import { supabaseAdmin } from "@/lib/supabase/server";
import { emailConfigured } from "@/lib/email/send";
import { paystackConfigured } from "@/lib/plus/paystack";
import { cn } from "@/lib/cn";

const CHECKS: { key: string; name: string; about: string; staleHours: number | null }[] = [
  { key: "paystack_webhook", name: "Paystack payments", about: "Paystack telling us about payments, renewals and refunds. Quiet days are normal when nobody pays.", staleHours: null },
  { key: "paystack_webhook_rejected", name: "Forged payment messages", about: "Requests pretending to be Paystack. They're ignored; a few now and then is nothing to worry about.", staleHours: null },
  { key: "daily_job", name: "Daily job", about: "Runs every morning at 7am Lagos time. If it hasn't run in over a day, check CRON_SECRET in Vercel.", staleHours: 26 },
  { key: "daily_plus_reminders", name: "Plus reminders", about: "Reminders before Plus runs out.", staleHours: 26 },
  { key: "daily_birthdays", name: "Birthday heads-ups", about: "Three days before, and on the day.", staleHours: 26 },
  { key: "daily_early_month", name: "Early users' free month", about: "Hands out the thank-you month around launch day.", staleHours: 26 },
];

const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export default async function AdminHealth() {
  const { data } = await supabaseAdmin().from("app_health").select("*");
  const rows = data ?? [];
  const setup = [
    { name: "Paystack key", ok: paystackConfigured(), about: "PAYSTACK_SECRET_KEY in Vercel. Without it nobody can pay." },
    { name: "Email sending", ok: emailConfigured(), about: "SMTP_USER and SMTP_PASS. Without them receipts and announcement emails don't go out." },
    { name: "Daily job secret", ok: !!process.env.CRON_SECRET, about: "CRON_SECRET in Vercel. Without it the daily job can't run." },
  ];
  return (
    <div className="max-w-4xl">
      <h1 className="display text-[2.6rem] leading-none">Health</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">Is everything behind the scenes working? Green is fine. Red needs a look.</p>

      <h2 className="mt-8 text-[0.95rem] font-semibold">Set up</h2>
      <ul className="mt-2 divide-y divide-line rounded-[18px] border border-line bg-raised">
        {setup.map((s) => (
          <li key={s.name} className="flex items-start gap-3 px-4 py-3">
            <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", s.ok ? "bg-[#3f9a5c]" : "bg-accent")} />
            <div>
              <p className="font-semibold">
                {s.name}: {s.ok ? "set" : "missing"}
              </p>
              <p className="text-[0.82rem] text-muted">{s.about}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-[0.95rem] font-semibold">Jobs and webhooks</h2>
      <ul className="mt-2 divide-y divide-line rounded-[18px] border border-line bg-raised">
        {CHECKS.map((c) => {
          const r = rows.find((x) => x.key === c.key);
          const lastOk = (r?.last_ok_at as string | null) ?? null;
          const lastErr = (r?.last_error_at as string | null) ?? null;
          const failing = !!lastErr && (!lastOk || lastErr > lastOk);
          const stale = c.staleHours !== null && (!lastOk || Date.now() - Date.parse(lastOk) > c.staleHours * 3600_000);
          const bad = c.key === "paystack_webhook_rejected" ? false : failing || stale;
          return (
            <li key={c.key} className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", bad ? "bg-accent" : lastOk || lastErr ? "bg-[#3f9a5c]" : "bg-line-strong")} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {c.name}
                  <span className="sr-only">{bad ? ": needs a look" : ": fine"}</span>
                </p>
                <p className="text-[0.82rem] text-muted">{c.about}</p>
                <p className="mt-1 text-[0.82rem]">
                  Last worked: <b>{ago(lastOk)}</b>
                  {r?.detail ? <span className="text-muted"> ({r.detail as string})</span> : null}
                  {lastErr ? (
                    <>
                      {" "}
                      · Last problem: <b className={failing ? "text-accent-ink" : ""}>{ago(lastErr)}</b>
                      <span className="block truncate text-muted">{r?.last_error as string}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
