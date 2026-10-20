import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/room/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import type { Announcement } from "@/components/room/AnnouncementBar";

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
