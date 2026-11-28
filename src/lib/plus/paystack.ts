import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A thin Paystack client. Server only: the secret key never leaves the server.
 * Live: PAYSTACK_SECRET_KEY. The test project uses TEST_PAYSTACK_SECRET_KEY (.env.test.local).
 */
const API = "https://api.paystack.co";

export function paystackKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || process.env.TEST_PAYSTACK_SECRET_KEY || null;
}
export const paystackConfigured = () => !!paystackKey();
/**
 * Payments paused: the live site until it holds a live Paystack key (Paystack is still reviewing
 * the business). Plus, its limits and its prices all show; paying explains why it can't go through
 * yet. Test keys never take payments on the live site. PAYMENTS_PAUSED=1 shows the same on a test copy.
 */
export const paymentsPaused = () => process.env.PAYMENTS_PAUSED === "1" || (process.env.VERCEL_ENV === "production" && !(paystackKey() ?? "").startsWith("sk_live_"));

export class PaystackError extends Error {}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = paystackKey();
  if (!key) throw new PaystackError("Payments aren't set up yet.");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.status) throw new PaystackError(json?.message ?? `Paystack said ${res.status}`);
  return json.data as T;
}

export type InitInput = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  /** A subscription plan code: Paystack charges the plan's amount and renews it. */
  plan?: string;
  channels: string[];
  metadata: Record<string, unknown>;
};

export function initialize(i: InitInput) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("POST", "/transaction/initialize", {
    email: i.email,
    amount: i.amountKobo,
    reference: i.reference,
    callback_url: i.callbackUrl,
    currency: "NGN",
    channels: i.channels,
    metadata: i.metadata,
    ...(i.plan ? { plan: i.plan } : {}),
  });
}

/** What we need from a Paystack transaction (verify response or charge.success webhook). */
export type PaystackCharge = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  channel?: string;
  authorization?: { last4?: string; brand?: string; card_type?: string } | null;
  customer?: { customer_code?: string; email?: string } | null;
  plan?: { plan_code?: string } | string | null;
  plan_object?: { plan_code?: string } | null;
  subscription_code?: string | null;
};

export const verify = (reference: string) => call<PaystackCharge>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);

export const createPlan = (name: string, interval: "monthly" | "annually", amountKobo: number) =>
  call<{ plan_code: string }>("POST", "/plan", { name, interval, amount: amountKobo, currency: "NGN" });

export const fetchSubscription = (code: string) => call<{ subscription_code: string; email_token: string; status: string }>("GET", `/subscription/${encodeURIComponent(code)}`);

export const disableSubscription = (code: string, token: string) => call<unknown>("POST", "/subscription/disable", { code, token });

/** A Paystack page where the subscriber can change the card on their plan. */
export const manageLink = (code: string) => call<{ link: string }>("GET", `/subscription/${encodeURIComponent(code)}/manage/link`);

export const refund = (reference: string) => call<unknown>("POST", "/refund", { transaction: reference });

/** Paystack signs every webhook with HMAC-SHA512 of the raw body, keyed with the secret key. */
export function validSignature(rawBody: string, signature: string | null): boolean {
  const key = paystackKey();
  if (!key || !signature) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const planCodeOf = (c: PaystackCharge): string | null =>
  (typeof c.plan === "string" ? c.plan : c.plan?.plan_code) || c.plan_object?.plan_code || null;
