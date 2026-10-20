import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyRoom } from "@/lib/room/server";
import { getAfterDark } from "@/lib/afterdark/server";
import { AfterDarkShell } from "@/components/afterdark/AfterDarkShell";
import { AfterDarkHub } from "@/components/afterdark/AfterDarkHub";

// Discreet: the tab title never says what this is.
export const metadata: Metadata = { title: "Room" };
export const dynamic = "force-dynamic";

export default async function AfterDarkPage() {
  const bundle = await getMyRoom();
  if (!bundle) redirect("/room");
  const state = await getAfterDark(bundle);
  // Consent controls must always be reachable (and opt-out instant), so the PIN only guards the open section.
  return (
    <AfterDarkShell hasPin={state.me.hasPin} requirePin={state.unlocked}>
      <AfterDarkHub state={state} />
    </AfterDarkShell>
  );
}