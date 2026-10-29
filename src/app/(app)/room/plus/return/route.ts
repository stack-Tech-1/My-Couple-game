import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUser } from "@/lib/room/server";
import { verify } from "@/lib/plus/paystack";
import { confirmCharge } from "@/lib/plus/server";

export const dynamic = "force-dynamic";

/**
 * Paystack sends the browser back here after checkout (?reference=…). We ask Paystack ourselves
 * whether it was paid; the browser's word is never taken for it. The webhook does the same, so
 * whichever arrives first hands out the seats.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  const user = await getUser();
  const home = new URL("/room", url);
  if (!user || !reference || !/^[A-Za-z0-9-]{6,100}$/.test(reference)) return NextResponse.redirect(home);

  const { data } = await supabaseAdmin().from("plus_purchases").select("room_id, payer_id, status").eq("reference", reference).maybeSingle();
  if (!data || data.payer_id !== user.id) return NextResponse.redirect(home);
  let result = data.status === "paid" ? "paid" : "pending";
  if (data.status === "pending") {
    try {
      const charge = await verify(reference);
      if (charge.status === "success") result = (await confirmCharge(charge))?.status === "paid" ? "paid" : "pending";
      else if (charge.status === "failed" || charge.status === "abandoned") result = "failed";
    } catch {
      // Paystack slow to answer: the webhook will finish the job.
    }
  }
  const to = new URL(data.room_id ? `/room/${data.room_id}/settings/plus` : "/room", url);
  to.searchParams.set("payment", result);
  return NextResponse.redirect(to);
}
