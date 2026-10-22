import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getSnapshot, ApiError } from "@/lib/games/server";
import { GameHost } from "@/components/game/GameHost";
import { AfterDarkShell } from "@/components/afterdark/AfterDarkShell";
import { isSpicy } from "@/games/after-dark/logic";
import { getMyRoom } from "@/lib/room/server";
import { getAfterDark } from "@/lib/afterdark/server";
import { GAME_LOGIC } from "@/games/logic";

export const metadata: Metadata = { title: "Playing" };
export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) notFound();
  try {
    const snapshot = await getSnapshot(sessionId);
    const rules = GAME_LOGIC[snapshot.session.game_id]?.rules;
    if (isSpicy(snapshot.session.game_id)) {
      const bundle = await getMyRoom();
      const ad = bundle ? await getAfterDark(bundle) : null;
      return (
        <AfterDarkShell hasPin={!!ad?.me.hasPin}>
          <GameHost key={sessionId} initial={snapshot} rules={rules} />
        </AfterDarkShell>
      );
    }
    return <GameHost key={sessionId} initial={snapshot} rules={rules} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}