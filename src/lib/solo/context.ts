import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getMyProfile, getMyRooms, getUser, homeRoomId } from "@/lib/room/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Everything a Solo page needs about me. Works with or without a room. */
export const soloContext = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/solo");
  const profile = await getMyProfile();
  if (!profile?.onboarded_at) redirect("/onboarding?next=/solo");
  const [rooms, home, { data: member }] = await Promise.all([
    getMyRooms(),
    homeRoomId(),
    (await supabaseServer()).from("room_members").select("sound_enabled").eq("user_id", user.id),
  ]);
  return {
    user,
    profile,
    rooms,
    homeRoomId: home,
    // Sound follows the room setting (off by default); on if switched on in any room.
    soundOn: (member ?? []).some((m) => m.sound_enabled === true),
  };
});
