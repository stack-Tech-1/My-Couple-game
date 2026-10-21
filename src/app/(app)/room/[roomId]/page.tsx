import type { Metadata } from "next";
import { getRoom, getRecentMoments, startChecklist } from "@/lib/room/server";
import { WelcomeTour } from "@/components/room/WelcomeTour";
import { GettingStarted } from "@/components/room/GettingStarted";
import { FriendRoomHome } from "@/components/friends/FriendRoomHome";
import { InvitePanel } from "@/components/room/InvitePanel";
import { HeadToHead } from "@/components/room/HeadToHead";
import { PlayNext } from "@/components/room/PlayNext";
import { Moments } from "@/components/room/Moments";
import { Library } from "@/components/room/Library";
import { Greeting } from "@/components/room/Greeting";
import { InstallPrompt } from "@/components/room/InstallPrompt";
import { NotifyPrompt } from "@/components/room/NotifyPrompt";
import { vapidKeys } from "@/lib/push/server";
import { getLastWeek, getProgress } from "@/lib/progress/server";
import { UsPanel } from "@/components/room/UsPanel";
import { WeeklyRecap } from "@/components/room/WeeklyRecap";
import { getTogether } from "@/lib/together/server";
import { ChallengeCard, MoodCard, TogetherCard, TogetherSync } from "@/components/room/TogetherCards";
import { ActiveGames } from "@/components/room/ActiveGames";
import { activeSessions, scoreboard } from "@/lib/games/server";
import { getDaily } from "@/lib/daily/server";
import { DailyQuestion } from "@/components/room/DailyQuestion";

export const metadata: Metadata = { title: "Your room" };

export default async function RoomHome({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const bundle = await getRoom(roomId);
  if (!bundle) return null;
  if (bundle.room.kind === "friends") return <FriendRoomHome roomId={roomId} />;
  const [moments, board, active, daily, keys, progress, week, together, checklist] = await Promise.all([
    getRecentMoments(roomId),
    scoreboard(roomId),
    activeSessions(roomId),
    bundle.partner ? getDaily(roomId, bundle.me.profile.id) : Promise.resolve(null),
    vapidKeys(),
    bundle.partner ? getProgress(roomId) : Promise.resolve(null),
    bundle.partner ? getLastWeek(roomId) : Promise.resolve(null),
    bundle.partner ? getTogether(roomId) : Promise.resolve(null),
    startChecklist(bundle),
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
      <GettingStarted roomId={roomId} items={checklist} />
      <WelcomeTour />
      <ActiveGames sessions={active} />

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-10">
          <HeadToHead mine={mine} theirs={theirs} />
          {progress ? <UsPanel roomId={roomId} stats={progress} /> : null}
          {daily ? <DailyQuestion daily={daily} /> : null}
          {together ? <ChallengeCard challenge={together.challenge} /> : null}
          {week ? <WeeklyRecap week={week} /> : null}
        </div>
        <div className="flex flex-col gap-6 lg:self-start">
          <PlayNext />
          {together ? <MoodCard moods={together.moods} /> : null}
          {together ? <TogetherCard countdowns={together.countdowns} /> : null}
          {together ? <TogetherSync /> : null}
        </div>
      </div>

      <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-[1fr_2.2fr]">
        <Moments moments={moments} />
        <Library />
      </div>
    </div>
  );
}