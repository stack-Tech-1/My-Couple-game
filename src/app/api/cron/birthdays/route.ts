import { NextResponse } from "next/server";
import { sendBirthdayReminders } from "@/lib/birthdays-server";
import { sendPlusReminders } from "@/lib/plus/server";
import { grantEarlyMonthIfDue } from "@/lib/plus/admin";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron (vercel.json), which sends the CRON_SECRET as a bearer token.
 * Runs every daily job: birthday heads-ups, Amah Plus reminders, and (once, after a launch day
 * set in advance) the early users' free month.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const now = new Date();
  const early = await grantEarlyMonthIfDue().catch(() => null);
  const [birthdays, plus] = await Promise.all([sendBirthdayReminders(now), sendPlusReminders(now).catch(() => ({ sent: 0, failed: true }))]);
  return NextResponse.json({ ...birthdays, plus, early });
}
