import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getSnapshot, ApiError } from "@/lib/games/server";
import { GameHost } from "@/components/game/GameHost";

export const metadata: Metadata = { title: "Playing" };
export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) notFound();
  try {
    const snapshot = await getSnapshot(sessionId);
    return <GameHost key={sessionId} initial={snapshot} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}