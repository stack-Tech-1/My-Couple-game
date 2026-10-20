import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { RoomBundle } from "@/lib/room/types";

export type CustomCardRow = { id: string; deck: string; heat: number; text: string; created_by: string | null };
export type AfterDarkState = {
  unlocked: boolean;
  me: { ageConfirmed: boolean; optIn: boolean; maxHeat: number; matchMode: "yes" | "yes_maybe"; hasPin: boolean };
  /** The lower of the two limits: what games will actually allow. */
  effectiveHeat: number;
  customCards: CustomCardRow[];
};

export async function getAfterDark(bundle: RoomBundle): Promise<AfterDarkState> {
  const supabase = await supabaseServer();
  const roomId = bundle.room.id;
  const [{ data: unlocked }, { data: hasPin }, { data: mm }] = await Promise.all([
    supabase.rpc("spicy_unlocked", { p_room: roomId }),
    supabase.rpc("has_spicy_pin"),
    supabase.from("room_members").select("match_mode").eq("user_id", bundle.me.profile.id).single(),
  ]);
  const isOpen = unlocked === true;
  const { data: cards } = isOpen ? await supabase.from("custom_cards").select("id, deck, heat, text, created_by").eq("room_id", roomId).order("created_at", { ascending: false }) : { data: [] };
  return {
    unlocked: isOpen,
    me: {
      ageConfirmed: !!bundle.me.member.age_confirmed_at,
      optIn: bundle.me.member.spicy_opt_in,
      maxHeat: bundle.me.member.max_heat,
      matchMode: ((mm as { match_mode?: string } | null)?.match_mode as "yes" | "yes_maybe") ?? "yes",
      hasPin: hasPin === true,
    },
    effectiveHeat: Math.min(bundle.me.member.max_heat, bundle.partner?.member.max_heat ?? 1),
    customCards: (cards ?? []) as CustomCardRow[],
  };
}

export type FantasyState = { picks: Record<string, "yes" | "maybe" | "no">; matches: string[]; progress: { mine: number; partner: number } };

/** Only my own picks and the mutual matches. My partner's picks are never readable. */
export async function getFantasy(roomId: string, me: string): Promise<FantasyState> {
  const supabase = await supabaseServer();
  const [{ data: picks }, { data: matches }, { data: progress }] = await Promise.all([
    supabase.from("fantasy_picks").select("item_id, pick").eq("room_id", roomId).eq("user_id", me),
    supabase.rpc("fantasy_matches", { p_room: roomId }),
    supabase.rpc("fantasy_progress", { p_room: roomId }),
  ]);
  return {
    picks: Object.fromEntries(((picks ?? []) as { item_id: string; pick: "yes" | "maybe" | "no" }[]).map((p) => [p.item_id, p.pick])),
    matches: ((matches ?? []) as { item_id: string }[]).map((m) => m.item_id),
    progress: (progress as { mine: number; partner: number }[] | null)?.[0] ?? { mine: 0, partner: 0 },
  };
}