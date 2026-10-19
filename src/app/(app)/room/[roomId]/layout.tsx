import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMyRoom } from "@/lib/room/server";
import { RoomProvider } from "@/lib/realtime/RoomProvider";
import { RoomHeader } from "@/components/room/RoomHeader";
import { ConnectionBanner } from "@/components/room/ConnectionBanner";
import { InviteListener } from "@/components/game/InviteListener";

export const dynamic = "force-dynamic";

export default async function RoomLayout({ children, params }: { children: ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const bundle = await getMyRoom();
  if (!bundle) redirect("/room");
  // A room URL that isn't yours just takes you home: no hint the other room exists.
  if (bundle.room.id !== roomId) redirect(`/room/${bundle.room.id}`);

  return (
    <RoomProvider bundle={bundle}>
      <RoomHeader />
      <ConnectionBanner />
      <InviteListener />
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">{children}</main>
    </RoomProvider>
  );
}