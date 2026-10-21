import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { watchSnapshot, ApiError } from "@/lib/games/server";
import { Spectator } from "@/components/game/Spectator";

export const metadata: Metadata = { title: "Watching" };
export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ roomId: string; sessionId: string }> }) {
  const { roomId, sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) notFound();
  try {
    const snapshot = await watchSnapshot(sessionId);
    if (snapshot.session.room_id !== roomId) notFound();
    return <Spectator initial={snapshot} />;
  } catch (e) {
    // You're in it: go and play instead.
    if (e instanceof ApiError && e.status === 409) redirect(`/room/${roomId}/play/${sessionId}`);
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
