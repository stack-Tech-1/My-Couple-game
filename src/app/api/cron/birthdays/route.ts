import { NextResponse } from "next/server";
import { sendBirthdayReminders } from "@/lib/birthdays-server";

export const dynamic = "force-dynamic";

/** Called once a day by Vercel Cron (vercel.json), which sends the CRON_SECRET as a bearer token. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json(await sendBirthdayReminders(new Date()));
}
