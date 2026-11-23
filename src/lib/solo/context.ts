import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getMyProfile, getMyRooms, getUser, homeRoomId } from "@/lib/room/server";

/** Everything a Solo page needs about me. Works with or without a room. */
export const soloContext = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/solo");
  const profile = await getMyProfile();
  if (!profile?.onboarded_at) redirect("/onboarding?next=/solo");
  const [rooms, home] = await Promise.all([getMyRooms(), homeRoomId()]);
  return {
    user,
    profile,
    rooms,
    homeRoomId: home,
    // Sound is the person's own setting, with or without a room (on for new players).
    soundOn: profile.sound_enabled !== false,
  };
});
