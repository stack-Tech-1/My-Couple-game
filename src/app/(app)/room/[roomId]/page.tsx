import type { Metadata } from "next";
import { getMyRoom, getRecentMoments } from "@/lib/room/server";
import { InvitePanel } from "@/components/room/InvitePanel";
import { HeadToHead } from "@/components/room/HeadToHead";
import { PlayNext } from "@/components/room/PlayNext";
import { Moments } from "@/components/room/Moments";
import { Library } from "@/components/room/Library";
import { Greeting } from "@/components/room/Greeting";
import { InstallPrompt } from "@/components/room/InstallPrompt";
import { NotifyPrompt } from "@/components/room/NotifyPrompt";
import { vapidKeys } from "@/lib/push/server";
import { ActiveGames } from "@/components/room/ActiveGames";
import { activeSessions, scoreboard } from "@/lib/games/server";
import { getDaily } from "@/lib/daily/server";
import { DailyQuestion } from "@/components/room/DailyQuestion";

export const metadata: Metadata = { title: "Your room" };

export default async function RoomHome({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const bundle = await getMyRoom();
  if (!bundle) return null;
  const [moments, board, active, daily, keys] = await Promise.all([
    getRecentMoments(roomId),
    scoreboard(roomId),
    activeSessions(roomId),
    bundle.partner ? getDaily(roomId, bundle.me.profile.id) : Promise.resolve(null),
    vapidKeys(),
  ]);
  const mine = board.totals[bundle.me.profile.id] ?? 0;
  const theirs = bundle.partner ? (board.totals[bundle.partner.profile.id] ?? 0) : 0;
  const paired = !!bundle.partner;

  return (
    <div className="pt-8 sm:pt-12">
      <Greeting />
      <InstallPrompt />
      {paired ? <NotifyPrompt publicKey={keys?.publicKey ?? null} /> : null}
      {!paired ? <InvitePanel /> : null}
      <ActiveGames sessions={active} />

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-10">
          <HeadToHead mine={mine} theirs={theirs} />
          {daily ? <DailyQuestion daily={daily} /> : null}
        </div>
        <PlayNext />
      </div>

      <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-[1fr_2.2fr]">
        <Moments moments={moments} />
        <Library />
      </div>
    </div>
  );
}