import { NextResponse } from "next/server";
import { sendBirthdayReminders } from "@/lib/birthdays-server";
import { sendPlusReminders } from "@/lib/plus/server";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron (vercel.json), which sends the CRON_SECRET as a bearer token.
 * Runs every daily job: birthday heads-ups and Amah Plus reminders.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const now = new Date();
  const [birthdays, plus] = await Promise.all([sendBirthdayReminders(now), sendPlusReminders(now).catch(() => ({ sent: 0, failed: true }))]);
  return NextResponse.json({ ...birthdays, plus });
}
