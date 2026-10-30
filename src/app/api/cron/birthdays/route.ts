import { NextResponse } from "next/server";
import { sendBirthdayReminders } from "@/lib/birthdays-server";
import { sendPlusReminders } from "@/lib/plus/server";
import { grantEarlyMonthIfDue } from "@/lib/plus/admin";
import { health } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron (vercel.json), which sends the CRON_SECRET as a bearer token.
 * Runs every daily job: birthday heads-ups, Amah Plus reminders, and (once, after a launch day
 * set in advance) the early users' free month. Each job's result goes to the admin health page.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const now = new Date();
  const run = async <T,>(key: string, job: () => Promise<T>, say: (r: T) => string): Promise<T | null> => {
    try {
      const r = await job();
      await health(key, true, say(r));
      return r;
    } catch (e) {
      await health(key, false, e instanceof Error ? e.message : "failed");
      return null;
    }
  };
  const [birthdays, plus, early] = await Promise.all([
    run("daily_birthdays", () => sendBirthdayReminders(now), (r) => JSON.stringify(r).slice(0, 200)),
    run("daily_plus_reminders", () => sendPlusReminders(now), (r) => `${r.sent} reminders sent`),
    run("daily_early_month", () => grantEarlyMonthIfDue(), (r) => (r == null ? "Nothing to do" : `${r} free months given in total`)),
  ]);
  await health("daily_job", true, "Ran");
  return NextResponse.json({ birthdays, plus, early });
}
