"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getRoom, getUser } from "@/lib/room/server";
import { siteUrl } from "@/lib/config";
import { notify } from "@/lib/push/server";
import type { ActionResult } from "@/lib/room/types";
import { PLANS, LEAVE_REASONS, PAYMENTS_PAUSED, TRIAL_DAYS, checkoutInput, isGroupPlan, type PlanId } from "./plans";
import { emailKey, lackingPlus, plusLive, planCode, type Purchase } from "./server";
import { PaystackError, disableSubscription, fetchSubscription, initialize, manageLink, paystackConfigured, paymentsPaused } from "./paystack";

async function limited(uid: string, action: string, max: number, windowSeconds: number) {
  const { data } = await supabaseAdmin().rpc("server_rate_limit", { uid, action, max_hits: max, window_seconds: windowSeconds });
  return data !== true;
}

const ref = () => {
  const s = randomBytes(8).toString("base64url").replace(/[-_]/g, "").toUpperCase().padEnd(8, "X");
  return `AMH-${s.slice(0, 4)}-${s.slice(4, 8)}`;
};

/** Start a Paystack checkout. Returns the page to send the browser to. */
export async function startCheckout(raw: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = checkoutInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That plan didn't look right." };
  const input = parsed.data;
  const user = await getUser();
  if (!user?.email) return { ok: false, error: "Sign in first." };
  if (!(await plusLive())) return { ok: false, error: "Amah Plus isn't open yet. Everything is free for now." };
  // Until Paystack approves the business, the live site explains instead of charging.
  if (paymentsPaused()) return { ok: false, error: PAYMENTS_PAUSED };
  if (!paystackConfigured()) return { ok: false, error: "Payments aren't set up yet. Try again soon." };
  if (await limited(user.id, "plus_checkout", 10, 600)) return { ok: false, error: "Easy, tiger. Give it a minute and try again." };

  // Plus belongs to the person, so someone with no room (playing Solo) can buy it for themselves.
  const bundle = input.roomId ? await getRoom(input.roomId) : null;
  if (input.roomId && !bundle) return { ok: false, error: "You need to be in that room." };
  const me = user.id;
  const plan: PlanId = input.plan;
  if (!bundle && plan !== "single") return { ok: false, error: "Without a room, Plus is just for you." };
  let recipients: string[] = [];
  if (plan === "single") recipients = [me];
  else if (!bundle) return { ok: false, error: "Without a room, Plus is just for you." };
  else if (plan === "couple") {
    if (bundle.room.kind !== "couple" || !bundle.partner) return { ok: false, error: "The couple plan is for you and your partner. Invite them first." };
    recipients = [me, bundle.partner.profile.id];
  } else if (isGroupPlan(plan)) {
    if (bundle.room.kind !== "friends") return { ok: false, error: "Group plans are for friend rooms." };
    recipients = input.includeMe && (await lackingPlus([me])).length ? [me] : [];
  } else {
    const to = input.giftTo;
    if (!to || to === me || !bundle.members.some((m) => m.profile.id === to) || bundle.blocked.includes(to)) return { ok: false, error: "You can buy a seat for someone in this room." };
    recipients = [to];
  }
  // Gifts are always one-off: nobody else's card renews on your behalf.
  const method = plan === "gift" ? "pass" : input.method;
  const price = PLANS[plan][input.period];
  const reference = ref();
  let code: string | undefined;
  try {
    if (method === "card") code = await planCode(plan, input.period);
  } catch (e) {
    return { ok: false, error: e instanceof PaystackError ? "Paystack isn't answering. Try again in a moment." : "Couldn't start the payment." };
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("plus_purchases").insert({
    reference,
    payer_id: me,
    room_id: bundle?.room.id ?? null,
    plan,
    period: input.period,
    method,
    seats: PLANS[plan].seats,
    amount_kobo: price * 100,
    recipients,
    paystack_plan: code ?? null,
  });
  if (error) return { ok: false, error: "Couldn't start the payment. Try again?" };

  const site = siteUrl();
  try {
    const init = await initialize({
      email: user.email,
      amountKobo: price * 100,
      reference,
      callbackUrl: `${site}/room/plus/return`,
      plan: code,
      channels: method === "card" ? ["card"] : ["card", "bank_transfer", "ussd", "bank"],
      metadata: { purchase: reference, plan, period: input.period, room_id: bundle?.room.id ?? null, cancel_action: bundle ? `${site}/room/${bundle.room.id}/settings/plus` : `${site}/solo/plus` },
    });
    return { ok: true, data: { url: init.authorization_url } };
  } catch {
    await admin.from("plus_purchases").update({ status: "failed" }).eq("reference", reference);
    return { ok: false, error: "Paystack isn't answering. Try again in a moment." };
  }
}

const DEVICE_COOKIE = "amah_dk";

/** Seven days of Plus, once per person (and at most two per device). */
export async function startTrial(): Promise<ActionResult> {
  const user = await getUser();
  if (!user?.email) return { ok: false, error: "Sign in first." };
  if (!(await plusLive())) return { ok: false, error: "Everything is free for now." };
  if (await limited(user.id, "plus_trial", 5, 3600)) return { ok: false, error: "Easy, tiger. Give it a minute and try again." };
  if (!(await lackingPlus([user.id])).length) return { ok: false, error: "You already have Plus." };

  const jar = await cookies();
  let device = jar.get(DEVICE_COOKIE)?.value;
  if (!device || !/^[A-Za-z0-9_-]{16,64}$/.test(device)) {
    device = randomBytes(18).toString("base64url");
    jar.set(DEVICE_COOKIE, device, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 730 });
  }
  const admin = supabaseAdmin();
  const { count } = await admin.from("plus_trials").select("email_key", { count: "exact", head: true }).eq("device_key", device);
  if ((count ?? 0) >= 2) return { ok: false, error: "This phone has already had its free trials. Plus is from ₦1,500 a month." };
  const { count: mine } = await admin.from("plus_trials").select("email_key", { count: "exact", head: true }).eq("user_id", user.id);
  if (mine) return { ok: false, error: "You've already had your free trial." };

  const { error } = await admin.from("plus_trials").insert({ email_key: emailKey(user.email), user_id: user.id, device_key: device });
  if (error) return { ok: false, error: error.code === "23505" ? "You've already had your free trial." : "Couldn't start your trial. Try again?" };
  const { error: seatErr } = await admin.rpc("plus_stack_seat", { p_user: user.id, p_purchase: null, p_source: "trial", p_length: `${TRIAL_DAYS} days`, p_given_by: null });
  if (seatErr) return { ok: false, error: "Couldn't start your trial. Try again?" };
  revalidatePath("/room", "layout");
  revalidatePath("/solo", "layout");
  return { ok: true, data: null };
}

/** Group plans: give one of the waiting seats to someone in the room. */
export async function giveSeat(purchaseId: unknown, userId: unknown): Promise<ActionResult> {
  const p = z.uuid().safeParse(purchaseId);
  const u = z.uuid().safeParse(userId);
  if (!p.success || !u.success) return { ok: false, error: "That didn't look right." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!(await lackingPlus([u.data])).length) return { ok: false, error: "They already have Plus." };
  const admin = supabaseAdmin();
  const { error } = await admin.rpc("plus_give_seat", { p_purchase: p.data, p_payer: user.id, p_user: u.data });
  if (error) {
    const m = error.message;
    return {
      ok: false,
      error: m.includes("no seats left") ? "No seats left on this plan." : m.includes("not in this room") ? "Seats only go to people in this room." : m.includes("already given") ? "They already have one of these seats." : "Couldn't give that seat.",
    };
  }
  const { data: purchase } = await admin.from("plus_purchases").select("room_id").eq("id", p.data).single();
  const { data: me } = await admin.from("profiles").select("display_name").eq("id", user.id).single();
  await notify(u.data, "plus", { title: `${me?.display_name ?? "A friend"} gave you Amah Plus`, body: "Every game is open. Tap to play.", url: purchase?.room_id ? `/room/${purchase.room_id}/games` : "/room", tag: `plus-seat-${p.data}` }, { evenIfHere: true });
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

/** My latest card plan that still renews. */
async function renewingPlan(uid: string): Promise<Purchase | null> {
  const { data } = await supabaseAdmin()
    .from("plus_purchases")
    .select("*")
    .eq("payer_id", uid)
    .eq("method", "card")
    .eq("status", "paid")
    .is("cancelled_at", null)
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Purchase | null) ?? null;
}

/** Stop a card plan renewing. Plus carries on until the end of what's paid for. */
export async function cancelRenewal(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const p = await renewingPlan(user.id);
  if (!p) return { ok: false, error: "Nothing is set to renew." };
  if (!p.paystack_subscription) return { ok: false, error: "Paystack is still setting up your plan. Try again in a minute." };
  try {
    const sub = await fetchSubscription(p.paystack_subscription);
    if (sub.status !== "cancelled" && sub.status !== "complete") await disableSubscription(p.paystack_subscription, sub.email_token);
  } catch {
    return { ok: false, error: "Paystack isn't answering. Try again in a moment." };
  }
  await supabaseAdmin().from("plus_purchases").update({ cancelled_at: new Date().toISOString() }).eq("paystack_subscription", p.paystack_subscription).is("cancelled_at", null);
  revalidatePath("/room", "layout");
  return { ok: true, data: null };
}

/** A Paystack page for changing the card on a plan. */
export async function changeCardLink(): Promise<ActionResult<{ url: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const p = await renewingPlan(user.id);
  if (!p?.paystack_subscription) return { ok: false, error: "There's no card plan to change." };
  try {
    return { ok: true, data: { url: (await manageLink(p.paystack_subscription)).link } };
  } catch {
    return { ok: false, error: "Paystack isn't answering. Try again in a moment." };
  }
}

/** The leaving pop-up's answer. Stored without who said it; only totals are ever shown. */
export async function recordLeaveReason(roomKind: unknown, reason: unknown): Promise<ActionResult> {
  const kind = z.enum(["couple", "friends"]).safeParse(roomKind);
  const why = z.enum(Object.keys(LEAVE_REASONS) as [keyof typeof LEAVE_REASONS, ...(keyof typeof LEAVE_REASONS)[]]).safeParse(reason);
  if (!kind.success || !why.success) return { ok: false, error: "That didn't look right." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (await limited(user.id, "leave_reason", 10, 3600)) return { ok: true, data: null };
  await supabaseAdmin().from("leave_reasons").insert({ room_kind: kind.data, reason: why.data });
  return { ok: true, data: null };
}
