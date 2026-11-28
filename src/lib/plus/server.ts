import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/config";
import { notify } from "@/lib/push/server";
import { renderReceipt } from "@/lib/email/receipt";
import { sendTransactional } from "@/lib/email/send";
import { PLANS, STAFF_UNTIL, isGroupPlan, naira, type PlanId, type Period, type PlusInfo } from "./plans";
import { createPlan, planCodeOf, type PaystackCharge } from "./paystack";
export { emailKey } from "./emailKey";

export type Purchase = {
  id: string;
  reference: string;
  payer_id: string | null;
  room_id: string | null;
  plan: PlanId;
  period: Period;
  method: "card" | "pass" | "admin";
  seats: number;
  amount_kobo: number;
  status: "pending" | "paid" | "failed" | "refunded" | "disputed";
  recipients: string[];
  renews_from: string | null;
  period_end: string | null;
  paystack_customer: string | null;
  paystack_plan: string | null;
  paystack_subscription: string | null;
  channel: string | null;
  card_brand: string | null;
  card_last4: string | null;
  cancelled_at: string | null;
  receipt_sent_at: string | null;
  created_at: string;
  paid_at: string | null;
};

/** Plus is live once launch day has passed. Until then everything is free. One read per request. */
export const plusLive = cache(async (): Promise<boolean> => {
  try {
    const { data } = await supabaseAdmin().from("app_config").select("value").eq("key", "plus").maybeSingle();
    const at = (data?.value as { launched_at?: string } | null)?.launched_at;
    return !!at && Date.parse(at) <= Date.now();
  } catch {
    return false;
  }
});

type Seat = { user_id: string; source: string; starts_at: string; ends_at: string };

/** Which of these people are admins, or an admin's partner in a couple room (0032_staff_plus.sql). */
async function staffPlus(userIds: string[]): Promise<string[]> {
  const { data } = await supabaseAdmin().rpc("staff_plus", { p_users: userIds });
  return ((data ?? []) as unknown[]).map((r) => (typeof r === "string" ? r : ((r as { staff_plus?: string }).staff_plus ?? ""))).filter(Boolean);
}

/** For each person: when their Plus ends (counting time already queued after it), and whether it's a trial. */
export async function plusStatus(userIds: string[]): Promise<Record<string, { until: string | null; trial: boolean }>> {
  const out: Record<string, { until: string | null; trial: boolean }> = Object.fromEntries(userIds.map((id) => [id, { until: null, trial: false }]));
  if (!userIds.length) return out;
  const now = new Date().toISOString();
  const [{ data }, staff] = await Promise.all([
    supabaseAdmin().from("plus_seats").select("user_id, source, starts_at, ends_at").in("user_id", userIds).is("revoked_at", null).gt("ends_at", now),
    staffPlus(userIds),
  ]);
  const seats = (data ?? []) as Seat[];
  // The Amah team (and each admin's partner in their couple room) always has Plus. Friend rooms
  // don't share it. Read from the database, never from anything the phone sends.
  for (const id of staff) out[id] = { until: STAFF_UNTIL, trial: false };
  for (const id of userIds) {
    if (out[id]!.until === STAFF_UNTIL) continue;
    const mine = seats.filter((s) => s.user_id === id);
    const current = mine.filter((s) => s.starts_at <= now);
    if (!current.length) continue;
    const until = mine.reduce((m, s) => (s.ends_at > m ? s.ends_at : m), "");
    out[id] = { until, trial: mine.every((s) => s.source === "trial") };
  }
  return out;
}

/** The Plus picture for one room's members, for the room page. */
export async function roomPlus(memberIds: string[], me: string, roomId?: string): Promise<PlusInfo> {
  const live = await plusLive();
  if (!live) return { live: false, until: {}, trial: [], trialUsed: false };
  const admin = supabaseAdmin();
  const [status, { count }, { data: groups }] = await Promise.all([
    plusStatus(memberIds),
    admin.from("plus_trials").select("email_key", { count: "exact", head: true }).eq("user_id", me),
    roomId
      ? admin.from("plus_purchases").select("id, seats").eq("payer_id", me).eq("room_id", roomId).eq("status", "paid").in("plan", ["group3", "group5", "group8"]).gt("period_end", new Date().toISOString())
      : Promise.resolve({ data: [] as { id: string; seats: number }[] }),
  ]);
  let seatsToGive: PlusInfo["seatsToGive"] = null;
  if (groups?.length) {
    const { data: given } = await admin.from("plus_seats").select("purchase_id").in("purchase_id", groups.map((g) => g.id)).is("revoked_at", null);
    for (const g of groups) {
      const left = (g.seats as number) - (given ?? []).filter((s) => s.purchase_id === g.id).length;
      if (left > 0) {
        seatsToGive = { purchaseId: g.id as string, left };
        break;
      }
    }
  }
  return {
    seatsToGive,
    live,
    until: Object.fromEntries(Object.entries(status).map(([id, s]) => [id, s.until])),
    trial: Object.entries(status).filter(([, s]) => s.until && s.trial).map(([id]) => id),
    trialUsed: (count ?? 0) > 0,
  };
}

/** Which of these players don't have Plus right now (none while Plus isn't live). */
export async function lackingPlus(userIds: string[]): Promise<string[]> {
  if (!(await plusLive())) return [];
  const status = await plusStatus(userIds);
  return userIds.filter((id) => !status[id]?.until);
}

// ---- Paystack plans ---------------------------------------------------------------------------

/** The Paystack plan for a card subscription, created the first time it's needed. */
export async function planCode(plan: PlanId, period: Period): Promise<string> {
  const amount = PLANS[plan][period] * 100;
  const key = `${plan}-${period}-${amount}`;
  const admin = supabaseAdmin();
  const { data } = await admin.from("plus_paystack_plans").select("plan_code").eq("key", key).maybeSingle();
  if (data?.plan_code) return data.plan_code as string;
  const created = await createPlan(`Amah Plus, ${PLANS[plan].label} (${period === "year" ? "yearly" : "monthly"})`, period === "year" ? "annually" : "monthly", amount);
  await admin.from("plus_paystack_plans").upsert({ key, plan_code: created.plan_code }, { onConflict: "key", ignoreDuplicates: true });
  const { data: again } = await admin.from("plus_paystack_plans").select("plan_code").eq("key", key).single();
  return (again?.plan_code as string) ?? created.plan_code;
}

// ---- Confirming payments ----------------------------------------------------------------------

const info = (c: PaystackCharge, extra: Record<string, string | null | undefined> = {}) => ({
  channel: c.channel ?? null,
  card_brand: c.authorization?.brand ?? c.authorization?.card_type ?? null,
  card_last4: c.authorization?.last4 ?? null,
  customer: c.customer?.customer_code ?? null,
  plan: planCodeOf(c),
  subscription: c.subscription_code ?? null,
  ...extra,
});

/**
 * A successful Paystack charge: pay the purchase it belongs to and hand out its seats, or, for a
 * card renewal we've never seen, carry the last payment's seats forward. Safe to call more than once.
 */
export async function confirmCharge(c: PaystackCharge): Promise<Purchase | null> {
  if (c.status !== "success" || c.currency !== "NGN") return null;
  const admin = supabaseAdmin();
  const { data: found } = await admin.from("plus_purchases").select("*").eq("reference", c.reference).maybeSingle();
  let purchase = found as Purchase | null;

  if (!purchase) {
    // A renewal: Paystack charged the saved card for an existing subscription.
    const code = planCodeOf(c);
    const customer = c.customer?.customer_code;
    if (!code || !customer) return null;
    const { data: prevRow } = await admin
      .from("plus_purchases")
      .select("*")
      .eq("paystack_plan", code)
      .eq("paystack_customer", customer)
      .eq("method", "card")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prev = prevRow as Purchase | null;
    if (!prev) return null;
    const { data: inserted, error } = await admin
      .from("plus_purchases")
      .insert({
        reference: c.reference,
        payer_id: prev.payer_id,
        room_id: prev.room_id,
        plan: prev.plan,
        period: prev.period,
        method: "card",
        seats: prev.seats,
        amount_kobo: prev.amount_kobo,
        renews_from: prev.id,
        paystack_customer: customer,
        paystack_plan: code,
        paystack_subscription: prev.paystack_subscription,
      })
      .select("*")
      .single();
    if (error) {
      // Two deliveries of the same renewal at once: the other one inserted it.
      const { data: again } = await admin.from("plus_purchases").select("*").eq("reference", c.reference).maybeSingle();
      purchase = again as Purchase | null;
    } else purchase = inserted as Purchase;
    if (!purchase) return null;
  }

  const { data, error } = await admin.rpc("plus_fulfil", { p_reference: c.reference, p_amount: c.amount, p_info: info(c) });
  if (error) throw new Error(`plus_fulfil: ${error.message}`);
  const paid = data as Purchase;
  if (paid.status === "paid") await afterPaid(paid);
  return paid;
}

/** Receipt and "you've got Plus" notifications. Runs once per purchase. */
async function afterPaid(p: Purchase) {
  const admin = supabaseAdmin();
  const { data: claimed } = await admin.from("plus_purchases").update({ receipt_sent_at: new Date().toISOString() }).eq("id", p.id).is("receipt_sent_at", null).select("id");
  if (!claimed?.length || !p.payer_id) return;

  const { data: seats } = await admin.from("plus_seats").select("user_id, ends_at").eq("purchase_id", p.id).is("revoked_at", null);
  const holders = [...new Set((seats ?? []).map((s) => s.user_id as string))];
  const ids = [...new Set([p.payer_id, ...holders])];
  const { data: profiles } = await admin.from("profiles").select("id, display_name").in("id", ids);
  const nameOf = (id: string) => (profiles ?? []).find((x) => x.id === id)?.display_name as string | undefined;
  const payerName = nameOf(p.payer_id) ?? "there";
  const site = siteUrl();
  const plusUrl = p.room_id ? `${site}/room/${p.room_id}/settings/plus` : `${site}/solo/plus`;

  // Everyone who got a seat from someone else hears about it.
  for (const id of holders) {
    if (id === p.payer_id) continue;
    await notify(id, "plus", { title: `${payerName} gave you Amah Plus`, body: "Every game is open. Tap to play.", url: p.room_id ? `/room/${p.room_id}/games` : "/room", tag: `plus-${p.id}` }, { evenIfHere: true });
  }

  const { data: auth } = await admin.auth.admin.getUserById(p.payer_id);
  const email = auth.user?.email;
  if (!email) return;
  const others = holders.filter((h) => h !== p.payer_id).map((h) => nameOf(h) ?? "your friend");
  const meToo = holders.includes(p.payer_id);
  const headline = isGroupPlan(p.plan)
    ? `Your group of ${p.seats} has Plus.`
    : meToo
      ? others.length
        ? `You and ${others.join(" and ")} have Plus.`
        : "You have Plus."
      : `${others.join(" and ") || "Your friend"} has Plus.`;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }) : "");
  const seatEnd = (seats ?? []).reduce((m, s) => ((s.ends_at as string) > m ? (s.ends_at as string) : m), p.period_end ?? "");
  const rows: [string, string][] = [
    ["Plan", `${PLANS[p.plan].label}, ${p.period === "year" ? "yearly" : "monthly"}`],
    ["Seats", isGroupPlan(p.plan) ? `${holders.length} given, ${p.seats - holders.length} waiting` : holders.map((h) => (h === p.payer_id ? payerName : (nameOf(h) ?? "Friend"))).join(", ")],
    ["Plus until", fmt(seatEnd)],
    ["Paid with", p.card_last4 ? `${cap(p.card_brand ?? "Card")} ending ${p.card_last4}` : channelName(p.channel)],
    ...(p.method === "card" && !p.cancelled_at ? ([["Renews", `Automatically, ${fmt(p.period_end)}`]] as [string, string][]) : []),
    ["Reference", p.reference],
  ];
  const r = renderReceipt({
    name: payerName,
    headline,
    amount: naira(p.amount_kobo / 100),
    paidOn: fmt(p.paid_at ?? new Date().toISOString()),
    rows,
    siteUrl: site,
    openUrl: plusUrl,
    renews: p.method === "card",
  });
  try {
    await sendTransactional({ to: email, subject: r.subject, html: r.html, text: r.text });
  } catch {
    // Paystack sends its own receipt too; a failed email never undoes a payment.
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const channelName = (c: string | null) => (c === "bank_transfer" ? "Bank transfer" : c === "ussd" ? "USSD" : c === "bank" ? "Bank" : c === "card" ? "Card" : "Paystack");

/** A disputed or refunded charge takes back the seats it paid for. */
export async function reverseCharge(reference: string, status: "refunded" | "disputed") {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("plus_purchases")
    .update({ status, ...(status === "refunded" ? { refunded_at: new Date().toISOString() } : {}) })
    .eq("reference", reference)
    .in("status", ["paid", "disputed"])
    .select("id");
  const id = data?.[0]?.id as string | undefined;
  if (id) await admin.from("plus_seats").update({ revoked_at: new Date().toISOString() }).eq("purchase_id", id).is("revoked_at", null);
}

/** Paystack made the subscription for a card plan: remember its code (needed to cancel or change card). */
export async function subscriptionCreated(d: { subscription_code?: string; customer?: { customer_code?: string }; plan?: { plan_code?: string } }) {
  if (!d.subscription_code || !d.customer?.customer_code || !d.plan?.plan_code) return;
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("plus_purchases")
    .select("id")
    .eq("paystack_customer", d.customer.customer_code)
    .eq("paystack_plan", d.plan.plan_code)
    .eq("method", "card")
    .is("paystack_subscription", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const id = data?.[0]?.id;
  if (id) await admin.from("plus_purchases").update({ paystack_subscription: d.subscription_code }).eq("id", id);
}

/** The subscription won't renew any more (cancelled here, at Paystack, or the card kept failing). */
export async function subscriptionStopped(code: string | undefined) {
  if (!code) return;
  await supabaseAdmin().from("plus_purchases").update({ cancelled_at: new Date().toISOString() }).eq("paystack_subscription", code).is("cancelled_at", null);
}

// ---- Reminders --------------------------------------------------------------------------------

/**
 * Daily: a heads-up 3 days before Plus runs out and on the last day, and a day before a trial ends.
 * Card plans that still renew are skipped. Each reminder goes once.
 */
export async function sendPlusReminders(now: Date): Promise<{ sent: number }> {
  if (!(await plusLive())) return { sent: 0 };
  const admin = supabaseAdmin();
  const soon = new Date(now.getTime() + 3.5 * 864e5).toISOString();
  const { data } = await admin.from("plus_seats").select("user_id, source, ends_at, purchase_id").is("revoked_at", null).gt("ends_at", now.toISOString()).lt("ends_at", soon);
  const seats = (data ?? []) as (Seat & { purchase_id: string | null })[];
  if (!seats.length) return { sent: 0 };
  const users = [...new Set(seats.map((s) => s.user_id))];
  const status = await plusStatus(users);
  const purchaseIds = [...new Set(seats.map((s) => s.purchase_id).filter((x): x is string => !!x))];
  const { data: purchases } = purchaseIds.length ? await admin.from("plus_purchases").select("id, method, cancelled_at").in("id", purchaseIds) : { data: [] };
  const renewing = new Set((purchases ?? []).filter((p) => p.method === "card" && !p.cancelled_at).map((p) => p.id as string));

  let sent = 0;
  for (const id of users) {
    const until = status[id]?.until;
    if (!until) continue;
    // Only the seat that actually ends their Plus matters (not one that's followed by more time).
    const last = seats.find((s) => s.user_id === id && s.ends_at === until);
    if (!last || (last.purchase_id && renewing.has(last.purchase_id))) continue;
    const left = (Date.parse(until) - now.getTime()) / 864e5;
    const kind = last.source === "trial" ? (left <= 1.5 ? "trial_ending" : null) : left <= 1 ? "ends_today" : left <= 3.5 ? "ends_soon" : null;
    if (!kind) continue;
    const { error } = await admin.from("plus_reminders").insert({ user_id: id, kind, ends_on: until.slice(0, 10) });
    if (error) continue; // already reminded
    const body =
      kind === "trial_ending"
        ? { title: "Your free trial ends tomorrow", body: "Keep every game open: Plus is from ₦1,500 a month." }
        : kind === "ends_today"
          ? { title: "Your Amah Plus ends today", body: "Renew to keep every game, voice notes and stickers." }
          : { title: "Your Amah Plus ends in 3 days", body: "Renew any time from Settings, Amah Plus." };
    if ((await notify(id, "plus", { ...body, url: "/room", tag: `plus-reminder-${kind}` }, { evenIfHere: true })) > 0) sent++;
  }
  return { sent };
}
