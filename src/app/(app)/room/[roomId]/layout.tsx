import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getRoom } from "@/lib/room/server";
import type { RoomBundle } from "@/lib/room/types";
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
import { TabBar } from "@/components/room/TabBar";
import { currentSpotlight, mySpotlightAsks } from "@/lib/engage/spotlight";
import { SpotlightTicker } from "@/components/spotlight/SpotlightTicker";
import { themeOn } from "@/lib/engage/themes";
import { lagosDate } from "@/lib/engage/rotation";
import { SpotlightAsk } from "@/components/spotlight/SpotlightAsk";
import { GentleStop } from "@/components/room/GentleStop";

export const dynamic = "force-dynamic";

async function liveAnnouncements(): Promise<(Announcement & { audience: string })[]> {
  const supabase = await supabaseServer();
  // RLS returns only the live ones.
  const { data } = await supabase.from("announcements").select("id, title, body, tone, link_url, link_label, audience").order("starts_at", { ascending: false }).limit(10);
  return (data ?? []) as (Announcement & { audience: string })[];
}

/** Announcements meant for a group only reach that group. */
function forMe(list: (Announcement & { audience: string })[], bundle: RoomBundle): Announcement[] {
  const me = bundle.me.profile.id;
  const plus = bundle.plus.live && !!bundle.plus.until[me];
  const waiting = bundle.rooms.some((r) => r.kind === "couple" && r.members < 2);
  return list
    .filter((a) => a.audience === "all" || (a.audience === "plus" && plus) || (a.audience === "free" && !plus) || (a.audience === "waiting" && waiting))
    .slice(0, 5)
    .map(({ audience: _audience, ...a }) => a);
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
  const [terms, feedbackUnread, winners, asks] = await Promise.all([termsStatus(bundle.me.profile.id), unreadReplies(), currentSpotlight(), mySpotlightAsks(bundle.me.profile.id)]);
  const roomAsks = asks.filter((a) => a.roomId === roomId);

  return (
    <RoomProvider bundle={bundle}>
      <GameFlagsProvider flags={flags}>
        <RoomHeader feedbackUnread={feedbackUnread} />
        <SpotlightTicker winners={winners} theme={themeOn(lagosDate())} />
        <ConnectionBanner />
        <AnnouncementBar items={forMe(announcements, bundle)} />
        <InviteListener />
        <Heartbeat userId={bundle.me.profile.id} />
        <main className="mx-auto max-w-6xl px-4 pb-32 sm:px-8 sm:pb-24">{children}</main>
        <TabBar />
        <GentleStop partnerName={bundle.partner?.profile.display_name ?? null} />
        {terms !== "ok" ? <TermsGate firstTime={terms === "first"} /> : roomAsks.length ? <SpotlightAsk asks={roomAsks} names={bundle.members.map((m) => m.profile.real_name ?? m.profile.display_name).join(" & ")} /> : null}
      </GameFlagsProvider>
    </RoomProvider>
  );
}
