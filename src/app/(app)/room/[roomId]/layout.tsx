import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getRoom } from "@/lib/room/server";
import { RoomProvider } from "@/lib/realtime/RoomProvider";
import { RoomHeader } from "@/components/room/RoomHeader";
import { ConnectionBanner } from "@/components/room/ConnectionBanner";
import { InviteListener } from "@/components/game/InviteListener";
import { AnnouncementBar, type Announcement } from "@/components/room/AnnouncementBar";
import { GameFlagsProvider } from "@/lib/games/FlagsProvider";
import { getGameFlags } from "@/lib/games/flags.server";
import { supabaseServer } from "@/lib/supabase/server";
import { TermsGate } from "@/components/room/TermsGate";
import { TERMS_VERSION } from "@/lib/legal";
import { unreadReplies } from "@/lib/feedback/server";
import { Heartbeat } from "@/components/room/Heartbeat";

export const dynamic = "force-dynamic";

async function liveAnnouncements(): Promise<Announcement[]> {
  const supabase = await supabaseServer();
  // RLS returns only the live ones.
  const { data } = await supabase.from("announcements").select("id, title, body, tone, link_url, link_label").order("starts_at", { ascending: false }).limit(5);
  return (data ?? []) as Announcement[];
}

/** Has this person accepted the current Terms? null = never asked (signed up before we did). */
async function termsStatus(userId: string): Promise<"ok" | "first" | "updated"> {
  const { data } = await (await supabaseServer()).from("profiles").select("terms_version").eq("id", userId).maybeSingle();
  const v = data?.terms_version as string | null | undefined;
  return v === TERMS_VERSION ? "ok" : v ? "updated" : "first";
}

export default async function RoomLayout({ children, params }: { children: ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [bundle, flags, announcements] = await Promise.all([getRoom(roomId), getGameFlags(), liveAnnouncements()]);
  // A room URL that isn't yours just takes you home: no hint the other room exists.
  if (!bundle) redirect("/room");
  // Remember it, so signing in next time lands here.
  const sb = await supabaseServer();
  after(async () => {
    await sb.from("profiles").update({ last_room_id: roomId }).eq("id", bundle.me.profile.id).or(`last_room_id.is.null,last_room_id.neq.${roomId}`);
  });
  const [terms, feedbackUnread] = await Promise.all([termsStatus(bundle.me.profile.id), unreadReplies()]);

  return (
    <RoomProvider bundle={bundle}>
      <GameFlagsProvider flags={flags}>
        <RoomHeader feedbackUnread={feedbackUnread} />
        <ConnectionBanner />
        <AnnouncementBar items={announcements} />
        <InviteListener />
        <Heartbeat userId={bundle.me.profile.id} />
        <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">{children}</main>
        {terms !== "ok" ? <TermsGate firstTime={terms === "first"} /> : null}
      </GameFlagsProvider>
    </RoomProvider>
  );
}
