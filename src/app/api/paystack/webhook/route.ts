import { NextResponse } from "next/server";
import { validSignature, type PaystackCharge } from "@/lib/plus/paystack";
import { health } from "@/lib/admin/audit";
import { confirmCharge, reverseCharge, subscriptionCreated, subscriptionStopped } from "@/lib/plus/server";

export const dynamic = "force-dynamic";

/**
 * Paystack tells us about payments here (set in the Paystack dashboard, Settings, API Keys &
 * Webhooks). Every request must carry Paystack's signature; anything else is ignored.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-paystack-signature"))) {
    await health("paystack_webhook_rejected", false, "A request without a valid Paystack signature was ignored.");
    return new NextResponse("Bad signature", { status: 401 });
  }
  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad body", { status: 400 });
  }
  const d = (event.data ?? {}) as Record<string, unknown>;
  try {
    switch (event.event) {
      case "charge.success":
        await confirmCharge(d as unknown as PaystackCharge);
        break;
      case "subscription.create":
        await subscriptionCreated(d as Parameters<typeof subscriptionCreated>[0]);
        break;
      case "subscription.disable":
      case "subscription.not_renew":
        await subscriptionStopped(d.subscription_code as string | undefined);
        break;
      case "charge.dispute.create": {
        const reference = (d.transaction as { reference?: string } | undefined)?.reference;
        if (reference) await reverseCharge(reference, "disputed");
        break;
      }
      case "refund.processed": {
        const reference = (d.transaction_reference as string | undefined) ?? (d.transaction as { reference?: string } | undefined)?.reference;
        if (reference) await reverseCharge(reference, "refunded");
        break;
      }
    }
  } catch (e) {
    // A 500 makes Paystack retry later, which is what we want if the database hiccupped.
    await health("paystack_webhook", false, `${event.event ?? "unknown"}: ${e instanceof Error ? e.message : "failed"}`);
    return new NextResponse("Try again", { status: 500 });
  }
  await health("paystack_webhook", true, event.event ?? "unknown");
  return NextResponse.json({ ok: true });
}
