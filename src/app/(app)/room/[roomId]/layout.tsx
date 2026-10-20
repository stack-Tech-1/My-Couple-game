import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMyRoom } from "@/lib/room/server";
import { RoomProvider } from "@/lib/realtime/RoomProvider";
import { RoomHeader } from "@/components/room/RoomHeader";
import { ConnectionBanner } from "@/components/room/ConnectionBanner";
import { InviteListener } from "@/components/game/InviteListener";
import { AnnouncementBar, type Announcement } from "@/components/room/AnnouncementBar";
import { GameFlagsProvider } from "@/lib/games/FlagsProvider";
import { getGameFlags } from "@/lib/games/flags.server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function liveAnnouncements(): Promise<Announcement[]> {
  const supabase = await supabaseServer();
  // RLS returns only the live ones.
  const { data } = await supabase.from("announcements").select("id, title, body, tone, link_url, link_label").order("starts_at", { ascending: false }).limit(5);
  return (data ?? []) as Announcement[];
}

export default async function RoomLayout({ children, params }: { children: ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [bundle, flags, announcements] = await Promise.all([getMyRoom(), getGameFlags(), liveAnnouncements()]);
  if (!bundle) redirect("/room");
  // A room URL that isn't yours just takes you home: no hint the other room exists.
  if (bundle.room.id !== roomId) redirect(`/room/${bundle.room.id}`);

  return (
    <RoomProvider bundle={bundle}>
      <GameFlagsProvider flags={flags}>
        <RoomHeader />
        <ConnectionBanner />
        <AnnouncementBar items={announcements} />
        <InviteListener />
        <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">{children}</main>
      </GameFlagsProvider>
    </RoomProvider>
  );
}
