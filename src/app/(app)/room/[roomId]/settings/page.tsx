import type { Metadata } from "next";
import { getUser } from "@/lib/room/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getMyFeedback } from "@/lib/feedback/server";
import { vapidKeys } from "@/lib/push/server";
import { PUSH_KINDS, type PushPrefs } from "@/lib/push/types";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getUser();
  const [{ data }, feedback, keys] = await Promise.all([
    user ? (await supabaseServer()).from("profiles").select("announcement_emails, push_prefs").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    getMyFeedback(),
    vapidKeys(),
  ]);
  const saved = (data?.push_prefs ?? {}) as Partial<PushPrefs>;
  const pushPrefs = Object.fromEntries(PUSH_KINDS.map((k) => [k, saved[k] !== false])) as PushPrefs;
  return <SettingsView announcementEmails={data?.announcement_emails !== false} feedback={feedback} push={{ publicKey: keys?.publicKey ?? null, prefs: pushPrefs }} />;
}
