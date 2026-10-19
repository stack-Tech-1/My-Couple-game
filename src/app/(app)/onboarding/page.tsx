import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyProfile, getMyRoom } from "@/lib/room/server";
import { safeNext } from "@/lib/safeNext";
import { Onboarding } from "./Onboarding";

export const metadata: Metadata = { title: "Getting set up" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const profile = await getMyProfile();
  if (!profile) redirect("/sign-in");
  const bundle = await getMyRoom();
  if (bundle && profile.onboarded_at) redirect(`/room/${bundle.room.id}`);

  const next = sp.next ? safeNext(sp.next) : null;
  const startAt = profile.onboarded_at && sp.step === "room" ? "room" : "you";
  return <Onboarding profile={profile} startAt={startAt} next={next} />;
}