import type { Metadata } from "next";
import { soloContext } from "@/lib/solo/context";
import { supabaseServer } from "@/lib/supabase/server";
import { getMyFeedback } from "@/lib/feedback/server";
import { SoloSettings } from "./SoloSettings";

export const metadata: Metadata = { title: "Settings" };

/** Settings that belong to the person, reachable from Solo with or without a room. */
export default async function SoloSettingsPage() {
  const ctx = await soloContext();
  const [{ data }, feedback] = await Promise.all([
    (await supabaseServer()).from("profiles").select("announcement_emails").eq("id", ctx.user.id).maybeSingle(),
    getMyFeedback(),
  ]);
  return (
    <SoloSettings
      profile={ctx.profile}
      soundOn={ctx.soundOn}
      announcementEmails={data?.announcement_emails !== false}
      feedback={feedback}
      homeRoomId={ctx.homeRoomId}
    />
  );
}
