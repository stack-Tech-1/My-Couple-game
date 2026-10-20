import { NextResponse } from "next/server";
import { applyOptOut } from "@/lib/email/optout";

/** One-click unsubscribe (RFC 8058): mail apps POST here from their own "Unsubscribe" button. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const ok = await applyOptOut(url.searchParams.get("u"), url.searchParams.get("t"), false);
  return new NextResponse(ok ? "Unsubscribed." : "That link isn't valid.", { status: ok ? 200 : 400 });
}

/** Someone opened the header link in a browser: show the normal page instead. */
export function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/email/unsubscribe${url.search}`, url.origin));
}
