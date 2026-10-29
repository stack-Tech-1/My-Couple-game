import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LEAVE_REASONS, PLANS, type LeaveReason, type PlanId } from "./plans";
import type { Purchase } from "./server";

/** app_config 'plus': the launch switch, and when the early-user month was handed out. */
export type PlusConfig = { launched_at?: string | null; early_granted_at?: string | null; early_count?: number };

export async function plusConfig(): Promise<PlusConfig> {
  const { data } = await supabaseAdmin().from("app_config").select("value").eq("key", "plus").maybeSingle();
  return (data?.value as PlusConfig | null) ?? {};
}

export async function savePlusConfig(next: PlusConfig, by?: string) {
  const { error } = await supabaseAdmin()
    .from("app_config")
    .upsert({ key: "plus", value: next, updated_at: new Date().toISOString(), ...(by ? { updated_by: by } : {}) });
  if (error) throw error;
}

/**
 * Everyone who joined before launch day gets a free month starting on launch day, once each.
 * Runs as soon as a launch date is set (so nobody is ever locked out on the day), and again from
 * the daily job to catch people who joined since. Once launch day has passed, it's marked done.
 */
export async function grantEarlyMonthIfDue(): Promise<number | null> {
  const cfg = await plusConfig();
  if (!cfg.launched_at || cfg.early_granted_at) return null;
  const { data, error } = await supabaseAdmin().rpc("plus_grant_early", { p_cutoff: cfg.launched_at });
  if (error) throw error;
  const count = (cfg.early_count ?? 0) + Number(data ?? 0);
  const launched = Date.parse(cfg.launched_at) <= Date.now();
  await savePlusConfig({ ...cfg, early_count: count, ...(launched ? { early_granted_at: new Date().toISOString() } : {}) });
  return count;
}

/** Before launch day, a moved or cancelled launch takes back the free months queued for the old date. */
export async function clearQueuedEarlyMonths() {
  const cfg = await plusConfig();
  if (cfg.early_granted_at) return;
  const { error } = await supabaseAdmin().from("plus_seats").delete().eq("source", "early");
  if (error) throw error;
  await savePlusConfig({ ...cfg, early_count: 0 });
}

const lagosMonthStart = () => {
  // Africa/Lagos is UTC+1 all year.
  const now = new Date(Date.now() + 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3600_000).toISOString();
};

export type AdminPayment = Purchase & { payer_email: string | null; payer_name: string | null; seats_given: number };

export type PlusAdminData = {
  config: PlusConfig;
  people: { total: number; paid: number; gift: number; trial: number; early: number; admin: number };
  revenue: { month: number; last30: number; all: number; refunded: number };
  renewing: number;
  trials: { started: number; converted: number };
  byPlan: { plan: PlanId; count: number; naira: number }[];
  daily: { d: string; v: number }[];
  payments: AdminPayment[];
  leaving: { reason: LeaveReason; label: string; couple: number; friends: number; last30: number }[];
};

/** Everything the admin Plus page shows. Counts and payment facts only, never room content. */
export async function plusAdminData(search?: string): Promise<PlusAdminData> {
  const admin = supabaseAdmin();
  const now = new Date().toISOString();
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [config, { data: seats }, { data: paidRows }, { data: trialRows }, { data: leaveRows }] = await Promise.all([
    plusConfig(),
    admin.from("plus_seats").select("user_id, source, purchase_id").is("revoked_at", null).lte("starts_at", now).gt("ends_at", now).limit(20000),
    admin.from("plus_purchases").select("plan, amount_kobo, status, paid_at, method, cancelled_at, payer_id, paystack_subscription").in("status", ["paid", "refunded", "disputed"]).limit(20000),
    admin.from("plus_trials").select("user_id").limit(20000),
    admin.from("leave_reasons").select("room_kind, reason, created_at").limit(20000),
  ]);

  // People with Plus right now, by how they got it (a paid seat wins over a trial, and so on).
  const rank: Record<string, number> = { paid: 5, gift: 4, admin: 3, early: 2, trial: 1 };
  const best = new Map<string, string>();
  for (const s of seats ?? []) {
    const cur = best.get(s.user_id as string);
    if (!cur || rank[s.source as string]! > rank[cur]!) best.set(s.user_id as string, s.source as string);
  }
  const people = { total: best.size, paid: 0, gift: 0, trial: 0, early: 0, admin: 0 };
  for (const src of best.values()) people[src as keyof typeof people]++;

  const rows = paidRows ?? [];
  const month = lagosMonthStart();
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((a, r) => a + Number(r.amount_kobo), 0) / 100;
  const revenue = {
    month: sum((r) => r.status === "paid" && (r.paid_at as string) >= month),
    last30: sum((r) => r.status === "paid" && (r.paid_at as string) >= d30),
    all: sum((r) => r.status === "paid"),
    refunded: sum((r) => r.status === "refunded"),
  };
  const renewing = new Set(rows.filter((r) => r.method === "card" && r.status === "paid" && !r.cancelled_at && r.paystack_subscription).map((r) => r.paystack_subscription as string)).size;

  const trialUsers = new Set((trialRows ?? []).map((t) => t.user_id as string).filter(Boolean));
  const payers = new Set(rows.filter((r) => r.status === "paid").map((r) => r.payer_id as string));
  const trials = { started: (trialRows ?? []).length, converted: [...trialUsers].filter((u) => payers.has(u)).length };

  const byPlan = (Object.keys(PLANS) as PlanId[]).map((plan) => {
    const mine = rows.filter((r) => r.plan === plan && r.status === "paid");
    return { plan, count: mine.length, naira: mine.reduce((a, r) => a + Number(r.amount_kobo), 0) / 100 };
  });

  // Money in per day, last 30 days (Lagos dates).
  const daily: { d: string; v: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() + 3600_000 - i * 864e5).toISOString().slice(0, 10);
    daily.push({ d: day, v: 0 });
  }
  for (const r of rows) {
    if (r.status !== "paid" || !r.paid_at) continue;
    const day = new Date(Date.parse(r.paid_at as string) + 3600_000).toISOString().slice(0, 10);
    const p = daily.find((x) => x.d === day);
    if (p) p.v += Number(r.amount_kobo) / 100;
  }

  const leaving = (Object.keys(LEAVE_REASONS) as LeaveReason[]).map((reason) => {
    const mine = (leaveRows ?? []).filter((l) => l.reason === reason);
    return {
      reason,
      label: LEAVE_REASONS[reason],
      couple: mine.filter((l) => l.room_kind === "couple").length,
      friends: mine.filter((l) => l.room_kind === "friends").length,
      last30: mine.filter((l) => (l.created_at as string) >= d30).length,
    };
  });

  return { config, people, revenue, renewing, trials, byPlan, daily, payments: await recentPayments(search), leaving };
}

/** The latest payments, or the ones matching a reference or the payer's email. */
async function recentPayments(search?: string): Promise<AdminPayment[]> {
  const admin = supabaseAdmin();
  let q = admin.from("plus_purchases").select("*").neq("status", "pending").order("created_at", { ascending: false }).limit(50);
  const s = search?.trim();
  if (s) {
    if (s.includes("@")) {
      const { data } = await admin.rpc("admin_find_user", { p_email: s });
      const id = ((data as { id: string }[] | null) ?? [])[0]?.id;
      if (!id) return [];
      q = q.eq("payer_id", id);
    } else q = q.ilike("reference", `%${s.replace(/[%_]/g, "")}%`);
  }
  const { data } = await q;
  const list = (data ?? []) as Purchase[];
  if (!list.length) return [];
  const payerIds = [...new Set(list.map((p) => p.payer_id).filter((x): x is string => !!x))];
  const [{ data: profiles }, { data: given }, emails] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", payerIds),
    admin.from("plus_seats").select("purchase_id").in("purchase_id", list.map((p) => p.id)).is("revoked_at", null),
    Promise.all(payerIds.map(async (id) => [id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? null] as const)),
  ]);
  const emailOf = new Map(emails);
  return list.map((p) => ({
    ...p,
    payer_email: p.payer_id ? (emailOf.get(p.payer_id) ?? null) : null,
    payer_name: ((profiles ?? []).find((x) => x.id === p.payer_id)?.display_name as string | undefined) ?? null,
    seats_given: (given ?? []).filter((g) => g.purchase_id === p.id).length,
  }));
}

export type AdminPlusUser = {
  id: string;
  email: string;
  name: string | null;
  until: string | null;
  seats: { id: string; source: string; starts_at: string; ends_at: string; revoked_at: string | null; given_by_name: string | null }[];
  trialUsed: boolean;
};

/** One person's Plus, for the admin "find someone" box. */
export async function plusUser(email: string): Promise<AdminPlusUser | null> {
  const admin = supabaseAdmin();
  const { data } = await admin.rpc("admin_find_user", { p_email: email.trim() });
  const u = ((data as { id: string; email: string; display_name: string | null }[] | null) ?? [])[0];
  if (!u) return null;
  const [{ data: seats }, { data: until }, { count }] = await Promise.all([
    admin.from("plus_seats").select("id, source, starts_at, ends_at, revoked_at, given_by").eq("user_id", u.id).order("created_at", { ascending: false }).limit(20),
    admin.rpc("plus_until", { uid: u.id }),
    admin.from("plus_trials").select("email_key", { count: "exact", head: true }).eq("user_id", u.id),
  ]);
  const giverIds = [...new Set((seats ?? []).map((s) => s.given_by as string | null).filter((x): x is string => !!x))];
  const { data: givers } = giverIds.length ? await admin.from("profiles").select("id, display_name").in("id", giverIds) : { data: [] };
  return {
    id: u.id,
    email: u.email,
    name: u.display_name,
    until: (until as string | null) ?? null,
    trialUsed: (count ?? 0) > 0,
    seats: (seats ?? []).map((s) => ({
      id: s.id as string,
      source: s.source as string,
      starts_at: s.starts_at as string,
      ends_at: s.ends_at as string,
      revoked_at: (s.revoked_at as string | null) ?? null,
      given_by_name: ((givers ?? []).find((g) => g.id === s.given_by)?.display_name as string | undefined) ?? null,
    })),
  };
}
