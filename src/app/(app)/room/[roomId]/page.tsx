import type { Metadata } from "next";
import { getMyProfile, getRoom, getRecentMoments, startChecklist } from "@/lib/room/server";
import { WelcomeTour } from "@/components/room/WelcomeTour";
import { GettingStarted } from "@/components/room/GettingStarted";
import { FriendRoomHome } from "@/components/friends/FriendRoomHome";
import { InvitePanel } from "@/components/room/InvitePanel";
import { PlayNext } from "@/components/room/PlayNext";
import { Moments } from "@/components/room/Moments";
import { Library } from "@/components/room/Library";
import { RoomHero } from "@/components/room/RoomHero";
import { GamesPeek } from "@/components/room/GamesPeek";
import { Birthdays } from "@/components/room/Birthdays";
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
import { SoloHomeCard } from "@/components/solo/SoloHomeCard";
import { WaitingPrompt } from "@/components/solo/WaitingPrompt";
import { TodayCard } from "@/components/room/TodayCard";
import { getToday } from "@/lib/engage/today";
import { PlaceCard } from "@/components/place/PlaceCard";

export const metadata: Metadata = { title: "Your room" };

export default async function RoomHome({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const bundle = await getRoom(roomId);
  if (!bundle) return null;
  if (bundle.room.kind === "friends") return <FriendRoomHome roomId={roomId} />;
  const [moments, board, active, daily, keys, progress, week, together, checklist, today] = await Promise.all([
    getRecentMoments(roomId),
    scoreboard(roomId),
    activeSessions(roomId),
    bundle.partner ? getDaily(roomId, bundle.me.profile.id) : Promise.resolve(null),
    vapidKeys(),
    bundle.partner ? getProgress(roomId) : Promise.resolve(null),
    bundle.partner ? getLastWeek(roomId) : Promise.resolve(null),
    bundle.partner ? getTogether(roomId) : Promise.resolve(null),
    startChecklist(bundle),
    bundle.partner ? getToday(bundle) : Promise.resolve(null),
  ]);
  const mine = board.totals[bundle.me.profile.id] ?? 0;
  const theirs = bundle.partner ? (board.totals[bundle.partner.profile.id] ?? 0) : 0;
  const paired = !!bundle.partner;
  const profile = paired ? null : await getMyProfile();

  return (
    <div className="relative isolate pt-0 sm:pt-8">
      <RoomHero mine={mine} theirs={theirs} stats={progress} />
      <Birthdays />
      <InstallPrompt />
      {paired ? <NotifyPrompt publicKey={keys?.publicKey ?? null} /> : null}
      {!paired ? <InvitePanel /> : null}
      {/* Asked once, a day or more after the room was made: still waiting, play Solo, or friends? */}
      {!paired && !profile?.waiting_prompt_at && !bundle.rooms.some((r) => r.kind === "friends") && Date.now() - Date.parse(bundle.room.created_at) > 864e5 ? (
        <WaitingPrompt inviteCode={bundle.room.invite_code} />
      ) : null}
      {/* While your person hasn't joined, Solo is the main thing to do. */}
      {!paired ? (
        <div className="mt-6">
          <SoloHomeCard big />
        </div>
      ) : null}
      <GettingStarted roomId={roomId} items={checklist} />
      <WelcomeTour />
      <ActiveGames sessions={active} />
      {paired && today ? (
        <div className="mt-8">
          <TodayCard roomId={roomId} today={today} streak={progress?.streak ?? 0} restUsed={!!progress?.rest_used} week={progress?.week} />
        </div>
      ) : null}

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
        <div className="flex flex-col gap-10">
          {/* Tonight first: something to play and today's question. */}
          <PlayNext />
          {daily ? <DailyQuestion daily={daily} /> : null}
          {paired ? <SoloHomeCard big={false} /> : null}
          {progress ? <UsPanel roomId={roomId} stats={progress} /> : null}
          {together ? <ChallengeCard challenge={together.challenge} /> : null}
          {week ? <WeeklyRecap week={week} /> : null}
        </div>
        <div className="flex flex-col gap-6 lg:self-start">
          {progress ? <PlaceCard roomId={roomId} stats={progress} /> : null}
          {together ? <MoodCard moods={together.moods} /> : null}
          {together ? <TogetherCard countdowns={together.countdowns} /> : null}
          {together ? <TogetherSync /> : null}
        </div>
      </div>

      {/* min-w-0: the swipeable games row must scroll inside its own box, not widen the page. */}
      <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-[1fr_2.2fr] [&>*]:min-w-0">
        <Moments moments={moments} />
        {/* Phones get a peek here; the full shelf lives in the Games tab. */}
        <GamesPeek />
        <div className="hidden sm:block">
          <Library />
        </div>
      </div>
    </div>
  );
}