"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentAdmin } from "@/lib/admin/server";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/room/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notify } from "@/lib/push/server";
import { clearQueuedEarlyMonths, grantEarlyMonthIfDue, plusConfig, plusUser, savePlusConfig, type AdminPlusUser } from "./admin";
import { disableSubscription, fetchSubscription, refund } from "./paystack";
import { reverseCharge, subscriptionStopped } from "./server";

// Every action re-checks admin rights itself: a server action is a public endpoint.
async function guard() {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Admins only.");
  return admin;
}
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error && (e.message === "Admins only." || e.message.startsWith("Paystack")) ? e.message : friendlyError(e) });
const done = () => {
  revalidatePath("/admin/plus");
  revalidatePath("/room", "layout");
};

/**
 * Launch day. A date in the past (or now) opens Plus straight away and hands out the free month;
 * a future date opens it then (the daily job hands out the month). Null switches Plus off:
 * everything is free again, and nobody's seats are touched.
 */
export async function setPlusLaunch(at: unknown): Promise<ActionResult<{ early: number | null }>> {
  try {
    const me = await guard();
    const cfg = await plusConfig();
    if (at === null) {
      // Before launch: the queued free months go too. After launch: everyone keeps what they have.
      await clearQueuedEarlyMonths();
      await savePlusConfig({ ...(await plusConfig()), launched_at: null }, me.id);
      done();
      return { ok: true, data: { early: null } };
    }
    const when = z.iso.datetime({ offset: true }).safeParse(at);
    if (!when.success) return { ok: false, error: "Pick a date and time." };
    const next = new Date(when.data).toISOString();
    if (cfg.early_granted_at && cfg.launched_at !== next) {
      // The free month already started for the old launch day; turning Plus back on keeps that day.
      if (cfg.launched_at) return { ok: false, error: "Plus has already launched and the free month has gone out. Launch day can't move now." };
      await savePlusConfig({ ...cfg, launched_at: cfg.launched_at ?? next }, me.id);
    } else {
      // Not launched yet: free months queued for an old date are redone for the new one.
      if (cfg.launched_at && cfg.launched_at !== next) await clearQueuedEarlyMonths();
      await savePlusConfig({ ...(await plusConfig()), launched_at: next }, me.id);
    }
    const early = await grantEarlyMonthIfDue();
    done();
    return { ok: true, data: { early } };
  } catch (e) {
    return fail(e);
  }
}

export async function findPlusUser(email: unknown): Promise<ActionResult<AdminPlusUser | null>> {
  try {
    await guard();
    const parsed = z.email().safeParse(typeof email === "string" ? email.trim() : email);
    if (!parsed.success) return { ok: false, error: "That doesn't look like an email address." };
    return { ok: true, data: await plusUser(parsed.data) };
  } catch (e) {
    return fail(e);
  }
}

const LENGTHS = { "7d": "7 days", "1m": "1 month", "3m": "3 months", "1y": "1 year" } as const;

/** Give someone Plus by hand (a thank-you, a fix after a payment problem). Adds to any Plus they have. */
export async function giveAdminPlus(userId: unknown, length: unknown): Promise<ActionResult<{ until: string }>> {
  try {
    const me = await guard();
    const id = z.uuid().parse(userId);
    const len = z.enum(Object.keys(LENGTHS) as [keyof typeof LENGTHS, ...(keyof typeof LENGTHS)[]]).parse(length);
    const { data, error } = await supabaseAdmin().rpc("plus_stack_seat", { p_user: id, p_purchase: null, p_source: "admin", p_length: LENGTHS[len], p_given_by: me.id });
    if (error) return fail(error);
    await notify(id, "plus", { title: "The Amah team gave you Plus", body: "Every game is open. Enjoy.", url: "/room", tag: "plus-admin" }, { evenIfHere: true });
    done();
    return { ok: true, data: { until: data as string } };
  } catch (e) {
    return fail(e);
  }
}

/** End one seat now (for example, a mistaken gift). Payments are refunded separately. */
export async function endSeat(seatId: unknown): Promise<ActionResult> {
  try {
    await guard();
    const id = z.uuid().parse(seatId);
    const { error } = await supabaseAdmin().from("plus_seats").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null);
    if (error) return fail(error);
    done();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Full refund through Paystack. The Plus that payment bought ends now. */
export async function refundPayment(reference: unknown): Promise<ActionResult> {
  try {
    await guard();
    const ref = z.string().regex(/^[A-Za-z0-9-]{6,100}$/).parse(reference);
    const { data } = await supabaseAdmin().from("plus_purchases").select("status, paystack_subscription, cancelled_at").eq("reference", ref).maybeSingle();
    if (!data) return { ok: false, error: "No payment with that reference." };
    if (data.status !== "paid") return { ok: false, error: `That payment is ${data.status}, not paid.` };
    try {
      await refund(ref);
    } catch (e) {
      return { ok: false, error: `Paystack: ${e instanceof Error ? e.message : "the refund didn't go through"}` };
    }
    await reverseCharge(ref, "refunded");
    // A refunded card plan shouldn't charge them again next month.
    const sub = data.paystack_subscription as string | null;
    if (sub && !data.cancelled_at) {
      try {
        const s = await fetchSubscription(sub);
        if (s.status !== "cancelled" && s.status !== "complete") await disableSubscription(sub, s.email_token);
        await subscriptionStopped(sub);
      } catch {
        return { ok: false, error: "Refunded, but Paystack didn't stop the renewal. Cancel it in the Paystack dashboard." };
      }
    }
    done();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
