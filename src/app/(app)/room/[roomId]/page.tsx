import type { Metadata } from "next";
import { getMyRoom, getRecentMoments } from "@/lib/room/server";
import { InvitePanel } from "@/components/room/InvitePanel";
import { HeadToHead } from "@/components/room/HeadToHead";
import { PlayNext } from "@/components/room/PlayNext";
import { Moments } from "@/components/room/Moments";
import { Library } from "@/components/room/Library";
import { Greeting } from "@/components/room/Greeting";

export const metadata: Metadata = { title: "Your room" };

export default async function RoomHome({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const bundle = await getMyRoom();
  if (!bundle) return null;
  const moments = await getRecentMoments(roomId);
  const paired = !!bundle.partner;

  return (
    <div className="pt-8 sm:pt-12">
      <Greeting />
      {!paired ? <InvitePanel /> : null}

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[1.25fr_1fr]">
        <HeadToHead />
        <PlayNext />
      </div>

      <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-[1fr_2.2fr]">
        <Moments moments={moments} />
        <Library />
      </div>
    </div>
  );
}