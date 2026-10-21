import type { Metadata } from "next";
import { getUser } from "@/lib/room/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getMyFeedback } from "@/lib/feedback/server";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getUser();
  const [{ data }, feedback] = await Promise.all([
    user ? (await supabaseServer()).from("profiles").select("announcement_emails").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    getMyFeedback(),
  ]);
  return <SettingsView announcementEmails={data?.announcement_emails !== false} feedback={feedback} />;
}
