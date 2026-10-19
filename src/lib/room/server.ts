import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import type { Member, Moment, Profile, Room, RoomBundle } from "./types";

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
  const { data } = await supabase.from("profiles").select("id, display_name, avatar_key, avatar_hue, onboarded_at").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/** The signed-in user's room plus both members. Null when they have no room yet. */
export const getMyRoom = cache(async (): Promise<RoomBundle | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await supabaseServer();

  const { data: mine } = await supabase.from("room_members").select("*").eq("user_id", user.id).maybeSingle();
  if (!mine) return null;
  const member = mine as Member;

  const [{ data: room }, { data: members }] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", member.room_id).single(),
    supabase.from("room_members").select("*").eq("room_id", member.room_id),
  ]);
  if (!room) return null;

  const ids = ((members ?? []) as Member[]).map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_key, avatar_hue, onboarded_at").in("id", ids);
  const byId = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));

  const meProfile = byId.get(user.id);
  if (!meProfile) return null;
  const partnerMember = ((members ?? []) as Member[]).find((m) => m.user_id !== user.id);
  const partnerProfile = partnerMember ? byId.get(partnerMember.user_id) : undefined;

  return {
    room: room as Room,
    me: { profile: meProfile, member },
    partner: partnerMember && partnerProfile ? { profile: partnerProfile, member: partnerMember } : null,
  };
});

export async function getRecentMoments(roomId: string, limit = 12): Promise<Moment[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("moments").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Moment[];
}