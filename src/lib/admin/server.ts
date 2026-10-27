import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/room/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import type { Announcement } from "@/components/room/AnnouncementBar";
import { gameMeta } from "@/games/catalog";

/** Is the signed-in user an admin? Checked against the database every request. */
export const currentAdmin = cache(async (): Promise<User | null> => {
  const user = await getUser();
  if (!user) return null;
  const { data } = await (await supabaseServer()).rpc("is_admin");
  return data === true ? user : null;
});

/** For admin pages: signed out → sign in; not an admin → a plain 404 (no hint /admin exists). */
export async function requireAdminPage(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/admin");
  const admin = await currentAdmin();
  if (!admin) notFound();
  return admin;
}

export type DailyPoint = { d: string; signups: number; active: number; games: number; messages: number };
export type Stats = {
  days: number;
  generated_at: string;
  totals: {
    users: number;
    onboarded: number;
    suspended: number;
    rooms: number;
    paired_rooms: number;
    new_users: number;
    active_users: number;
    dau: number;
    wau: number;
    mau: number;
    active_couples: number;
    games: number;
    messages: number;
    voice_notes: number;
    stickers: number;
  };
  daily: DailyPoint[];
  games: { game_id: string; started: number; finished: number }[];
  retention: { week: string; size: number; weeks: (number | null)[] }[];
};

export async function getStats(days: number): Promise<Stats | null> {
  const { data, error } = await supabaseAdmin().rpc("admin_stats", { p_days: days });
  if (error || !data) return null;
  return data as Stats;
}

export type AdminAnnouncement = Announcement & { starts_at: string; ends_at: string | null; created_at: string; emailed_at: string | null; emailed_count: number };

export async function listAnnouncements(): Promise<AdminAnnouncement[]> {
  const { data } = await supabaseAdmin().from("announcements").select("id, title, body, tone, link_url, link_label, starts_at, ends_at, created_at, emailed_at, emailed_count").order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as AdminAnnouncement[];
}

// ---- user list -------------------------------------------------------------------------------------

export const USER_FILTERS = ["all", "paired", "waiting", "no_room", "suspended", "admins"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];
export type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_active: string | null;
  banned_until: string | null;
  is_admin: boolean;
  room_id: string | null;
  paired_at: string | null;
  partner_id: string | null;
  partner_email: string | null;
  partner_name: string | null;
  total: number;
};
export const USERS_PAGE = 25;

export async function listUsers(search: string, filter: UserFilter, page: number): Promise<{ rows: UserRow[]; total: number }> {
  const { data } = await supabaseAdmin().rpc("admin_list_users", { p_search: search || null, p_filter: filter, p_limit: USERS_PAGE, p_offset: page * USERS_PAGE });
  const rows = (data ?? []) as UserRow[];
  return { rows, total: Number(rows[0]?.total ?? 0) };
}

// ---- inbox -----------------------------------------------------------------------------------------

export type AdminFeedback = {
  id: string;
  user_id: string | null;
  email: string | null;
  kind: string;
  body: string;
  status: string;
  admin_note: string | null;
  meta: Record<string, string>;
  screenshot_url: string | null;
  created_at: string;
  replies: { id: string; from_team: boolean; body: string; created_at: string }[];
  /** The last game they started before sending this, so odd feedback has context. */
  last_game: { name: string; status: string; started_at: string } | null;
};

/** Each sender's most recent game started before their feedback (what they were most likely talking about). */
async function lastGamesFor(rows: { id: string; user_id: string | null; created_at: string }[]): Promise<Map<string, AdminFeedback["last_game"]>> {
  const admin = supabaseAdmin();
  const out = new Map<string, AdminFeedback["last_game"]>();
  await Promise.all(
    rows.map(async (r) => {
      if (!r.user_id) return;
      const { data } = await admin
        .from("game_sessions")
        .select("game_id, status, created_at")
        .contains("players", [r.user_id])
        .lte("created_at", r.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) out.set(r.id, { name: gameMeta(data.game_id as string)?.name ?? (data.game_id as string), status: data.status as string, started_at: data.created_at as string });
    }),
  );
  return out;
}

async function emailsFor(ids: (string | null)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  await Promise.all(
    unique.map(async (id) => {
      const { data } = await supabaseAdmin().auth.admin.getUserById(id);
      if (data.user?.email) out.set(id, data.user.email);
    }),
  );
  return out;
}

export async function listFeedback(status: string): Promise<AdminFeedback[]> {
  const admin = supabaseAdmin();
  let q = admin.from("feedback").select("id, user_id, kind, body, status, admin_note, meta, screenshot_path, created_at").order("created_at", { ascending: false }).limit(100);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as (Omit<AdminFeedback, "email" | "replies" | "screenshot_url"> & { screenshot_path: string | null })[];
  if (!rows.length) return [];
  const [{ data: replies }, emails, signed, games] = await Promise.all([
    admin.from("feedback_replies").select("id, feedback_id, from_team, body, created_at").in("feedback_id", rows.map((r) => r.id)).order("created_at"),
    emailsFor(rows.map((r) => r.user_id)),
    (async () => {
      const paths = rows.map((r) => r.screenshot_path).filter((p): p is string => !!p);
      if (!paths.length) return new Map<string, string>();
      const { data: urls } = await admin.storage.from("feedback").createSignedUrls(paths, 3600);
      return new Map((urls ?? []).filter((u) => u.signedUrl && u.path).map((u) => [u.path!, u.signedUrl]));
    })(),
    lastGamesFor(rows),
  ]);
  const byThread = new Map<string, AdminFeedback["replies"]>();
  for (const r of (replies ?? []) as (AdminFeedback["replies"][number] & { feedback_id: string })[]) byThread.set(r.feedback_id, [...(byThread.get(r.feedback_id) ?? []), r]);
  return rows.map(({ screenshot_path, ...r }) => ({
    ...r,
    email: r.user_id ? (emails.get(r.user_id) ?? null) : null,
    screenshot_url: screenshot_path ? (signed.get(screenshot_path) ?? null) : null,
    replies: byThread.get(r.id) ?? [],
    last_game: games.get(r.id) ?? null,
  }));
}

export type AdminSuggestion = { id: string; user_id: string | null; email: string | null; kind: string; body: Record<string, unknown>; status: string; created_at: string };

export async function listSuggestions(status: string): Promise<AdminSuggestion[]> {
  let q = supabaseAdmin().from("suggestions").select("id, user_id, kind, body, status, created_at").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as Omit<AdminSuggestion, "email">[];
  const emails = await emailsFor(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, email: r.user_id ? (emails.get(r.user_id) ?? null) : null }));
}

export type AdminReport = {
  id: string;
  reporter_email: string | null;
  reported_email: string | null;
  reported_id: string | null;
  reason: string;
  details: string | null;
  message_snapshot: { kind?: string; body?: string | null; created_at?: string } | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

export async function listReports(status: string): Promise<AdminReport[]> {
  let q = supabaseAdmin().from("reports").select("id, reporter_id, reported_id, reason, details, message_snapshot, status, admin_note, created_at").order("created_at", { ascending: false }).limit(100);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as (Omit<AdminReport, "reporter_email" | "reported_email"> & { reporter_id: string | null })[];
  const emails = await emailsFor(rows.flatMap((r) => [r.reporter_id, r.reported_id]));
  return rows.map(({ reporter_id, ...r }) => ({
    ...r,
    reporter_email: reporter_id ? (emails.get(reporter_id) ?? null) : null,
    reported_email: r.reported_id ? (emails.get(r.reported_id) ?? null) : null,
  }));
}

/** What needs attention, for the nav badge. */
export async function inboxCounts(): Promise<{ feedback: number; suggestions: number; reports: number }> {
  const admin = supabaseAdmin();
  const count = async (table: string, col: string, val: string) => (await admin.from(table).select("id", { count: "exact", head: true }).eq(col, val)).count ?? 0;
  const [feedback, suggestions, reports] = await Promise.all([count("feedback", "status", "new"), count("suggestions", "status", "pending"), count("reports", "status", "new")]);
  return { feedback, suggestions, reports };
}
