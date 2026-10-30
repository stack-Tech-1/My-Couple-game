import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FixPicture } from "@/components/solo/games/FixAm";

export type PictureRow = {
  id: string;
  name: string;
  place: string;
  note: string;
  link: string | null;
  own_photo: boolean;
  credit: string | null;
  credit_url: string | null;
  path: string;
  live: boolean;
  sort: number;
  feature_on: string | null;
  created_at: string;
};

export const pictureUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fixam/${path}`;

export const toPicture = (p: PictureRow): FixPicture => ({
  id: p.id,
  name: p.name,
  place: p.place,
  note: p.note,
  link: p.link,
  credit: p.own_photo ? null : p.credit,
  creditUrl: p.own_photo ? null : p.credit_url,
  url: pictureUrl(p.path),
});

/** Live pictures, today's picture, and which ones I've finished. */
export async function fixamToday(userId: string, day: string): Promise<{ pictures: FixPicture[]; todayId: string | null; finished: string[]; total: number }> {
  const admin = supabaseAdmin();
  const [{ data }, { data: mine }] = await Promise.all([
    admin.from("fixam_pictures").select("*").eq("live", true).order("sort").order("created_at"),
    admin.from("solo_scores").select("mode").eq("user_id", userId).eq("game_id", "fix-am").limit(2000),
  ]);
  const rows = (data ?? []) as PictureRow[];
  if (!rows.length) return { pictures: [], todayId: null, finished: [], total: 0 };
  // A picture set for today wins; otherwise they take turns, one a day.
  const featured = rows.find((r) => r.feature_on === day);
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 864e5);
  // Pictures saved for a future date (Independence Day, say) stay hidden until then.
  const pool = rows.filter((r) => !r.feature_on || r.feature_on <= day);
  const today = featured ?? pool[((n % pool.length) + pool.length) % pool.length] ?? rows[0]!;
  const done = new Set((mine ?? []).map((s) => (s.mode as string).split("-")[1]).filter(Boolean));
  const finished = rows.filter((r) => done.has(r.id.replace(/-/g, "").slice(0, 8))).map((r) => r.id);
  return { pictures: rows.map(toPicture), todayId: today.id, finished, total: rows.length };
}
