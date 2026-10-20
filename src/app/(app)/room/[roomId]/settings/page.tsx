import type { Metadata } from "next";
import { getUser } from "@/lib/room/server";
import { supabaseServer } from "@/lib/supabase/server";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getUser();
  const { data } = user ? await (await supabaseServer()).from("profiles").select("announcement_emails").eq("id", user.id).maybeSingle() : { data: null };
  return <SettingsView announcementEmails={data?.announcement_emails !== false} />;
}
