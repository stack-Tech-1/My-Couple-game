import { redirect } from "next/navigation";
import { getMyProfile, getMyRooms, getUser, homeRoomId } from "@/lib/room/server";

export const dynamic = "force-dynamic";

/** Sends you wherever you belong: sign-in, onboarding, Solo, or your room. */
export default async function RoomIndex() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const profile = await getMyProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");
  const [home, rooms] = await Promise.all([homeRoomId(), getMyRooms()]);
  // "Just me for now": Solo is home until someone is actually in one of your rooms with you.
  if (profile.solo_home && rooms.every((r) => r.members < 2)) redirect("/solo");
  if (!home) redirect("/onboarding?step=room");
  redirect(`/room/${home}`);
}
