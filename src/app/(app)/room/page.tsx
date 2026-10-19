import { redirect } from "next/navigation";
import { getMyProfile, getMyRoom, getUser } from "@/lib/room/server";

export const dynamic = "force-dynamic";

/** Sends you wherever you belong: sign-in, onboarding, or your room. */
export default async function RoomIndex() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const profile = await getMyProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");
  const bundle = await getMyRoom();
  if (!bundle) redirect("/onboarding?step=room");
  redirect(`/room/${bundle.room.id}`);
}