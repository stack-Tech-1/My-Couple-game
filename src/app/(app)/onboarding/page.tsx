import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyProfile, homeRoomId } from "@/lib/room/server";
import { safeNext } from "@/lib/safeNext";
import { Onboarding } from "./Onboarding";

export const metadata: Metadata = { title: "Getting set up" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const profile = await getMyProfile();
  if (!profile) redirect("/sign-in");
  // Already set up with a room: more rooms are started from /room/new.
  const home = await homeRoomId();
  if (home && profile.onboarded_at) redirect(`/room/${home}`);

  const next = sp.next ? safeNext(sp.next) : null;
  const startAt = profile.onboarded_at && sp.step === "room" ? "room" : "you";
  return <Onboarding profile={profile} startAt={startAt} next={next} />;
}