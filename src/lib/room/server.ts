import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import type { Member, Moment, Profile, Room, RoomBundle, RoomKind, RoomSummary } from "./types";

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profiles").select("id, display_name, avatar_key, avatar_hue, onboarded_at, theme").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/** Every room I'm in, couple room first, then friend rooms by when I joined. */
export const getMyRooms = cache(async (): Promise<RoomSummary[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await supabaseServer();
  const { data: mine } = await supabase.from("room_members").select("room_id, joined_at").eq("user_id", user.id).order("joined_at");
  const ids = (mine ?? []).map((m) => m.room_id as string);
  if (!ids.length) return [];
  const [{ data: rooms }, { data: members }] = await Promise.all([
    supabase.from("rooms").select("id, name, kind").in("id", ids),
    supabase.from("room_members").select("room_id").in("room_id", ids),
  ]);
  const count = new Map<string, number>();
  for (const m of members ?? []) count.set(m.room_id as string, (count.get(m.room_id as string) ?? 0) + 1);
  const byId = new Map((rooms ?? []).map((r) => [r.id as string, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ id: r.id as string, name: r.name as string, kind: r.kind as RoomKind, members: count.get(r.id as string) ?? 1 }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "couple" ? -1 : 1));
});

/** One room I'm a member of, with everyone in it. Null if it doesn't exist or isn't mine. */
export const getRoom = cache(async (roomId: string): Promise<RoomBundle | null> => {
  const user = await getUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(roomId)) return null;
  const supabase = await supabaseServer();

  // RLS only returns rooms I'm in, so a stranger's room id simply comes back empty.
  const [{ data: room }, { data: memberRows }, rooms, { data: blocks }] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
    supabase.from("room_members").select("*").eq("room_id", roomId).order("joined_at"),
    getMyRooms(),
    supabase.from("blocks").select("blocked_id"), // RLS: only my own blocks
  ]);
  const members = (memberRows ?? []) as Member[];
  const member = members.find((m) => m.user_id === user.id);
  if (!room || !member) return null;

  const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_key, avatar_hue, onboarded_at, theme").in("id", members.map((m) => m.user_id));
  const byId = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));
  const people = members.flatMap((m) => {
    const profile = byId.get(m.user_id);
    return profile ? [{ profile, member: m }] : [];
  });
  const me = people.find((p) => p.profile.id === user.id);
  if (!me) return null;
  const r = room as Room;

  return {
    room: r,
    me,
    partner: r.kind === "couple" ? (people.find((p) => p.profile.id !== user.id) ?? null) : null,
    members: people,
    rooms,
    blocked: (blocks ?? []).map((b) => b.blocked_id as string),
  };
});

/** My couple room (After Dark, notes, moods and other couple-only features). Null if I don't have one. */
export const getMyRoom = cache(async (): Promise<RoomBundle | null> => {
  const couple = (await getMyRooms()).find((r) => r.kind === "couple");
  return couple ? getRoom(couple.id) : null;
});

/** Where to send someone with no room in the URL: the room they opened last, else their couple room, else any. */
export async function homeRoomId(): Promise<string | null> {
  const user = await getUser();
  const rooms = await getMyRooms();
  if (!user || !rooms.length) return null;
  const { data } = await (await supabaseServer()).from("profiles").select("last_room_id").eq("id", user.id).maybeSingle();
  const last = data?.last_room_id as string | null | undefined;
  return rooms.find((r) => r.id === last)?.id ?? rooms[0]!.id;
}

export async function getRecentMoments(roomId: string, limit = 12): Promise<Moment[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("moments").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Moment[];
}