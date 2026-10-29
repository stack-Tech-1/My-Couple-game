import Link from "next/link";
import { CATEGORIES, gameMeta } from "@/games/catalog";
import { Icon } from "@/design/icons";
import type { RoomBundle } from "@/lib/room/types";
import { getDaily } from "@/lib/daily/server";
import { getBucket, getMemories, getNotes } from "@/lib/romantic/server";
import { DailyQuestion } from "@/components/room/DailyQuestion";
import { LoveNotes } from "./LoveNotes";
import { MemoryLane } from "./MemoryLane";
import { DateNight } from "./DateNight";
import { BucketList } from "./BucketList";
import { dateIdeas } from "@/lib/content/server";
import { GameBackdrop } from "@/components/game/GameBackdrop";
import { PlusGate } from "@/components/plus/PlusGate";

/** Library entries that are ongoing room features rather than turn-based sessions. */
export const FEATURES = new Set(["daily-question", "love-notes", "memory-lane", "date-night", "bucket-list"]);

export async function FeaturePage({ gameId, roomId, bundle, needsPlus }: { gameId: string; roomId: string; bundle: RoomBundle; needsPlus?: boolean }) {
  const meta = gameMeta(gameId)!;
  const cat = CATEGORIES[meta.category];
  const me = bundle.me.profile.id;

  let body: React.ReactNode;
  if (needsPlus) body = <PlusGate bundle={bundle} game={meta} />;
  else if (!bundle.partner) body = <p className="text-muted">This one needs two. Invite your person from the room home first.</p>;
  else if (gameId === "daily-question") body = <DailyQuestion daily={await getDaily(roomId, me)} full />;
  else if (gameId === "love-notes") body = <LoveNotes notes={await getNotes(roomId, me)} />;
  else if (gameId === "memory-lane") body = <MemoryLane memories={await getMemories(roomId)} />;
  else if (gameId === "date-night") body = <DateNight ideas={await dateIdeas()} />;
  else body = <BucketList items={await getBucket(roomId)} />;

  return (
    <div className="@container relative isolate mx-auto max-w-3xl pt-6 sm:pt-8">
      {/* Each keepsake sits on its own colour and adire motif, like the games. */}
      <GameBackdrop gameId={gameId} category={meta.category} />
      <Link prefetch={false} href={`/room/${roomId}/games`} className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-semibold">
        <Icon name="arrowLeft" size={16} /> Games
      </Link>
      {gameId === "daily-question" ? null : (
        <header className="glass mb-4 mt-5 rounded-[28px] p-5 sm:mb-6 sm:p-7">
          <p className="eyebrow" style={{ color: cat.ink }}>{cat.label}</p>
          <h1 className="display mt-2 text-[clamp(2.6rem,9vw,4rem)]">{meta.name}</h1>
          <p className="mt-2 text-[1.05rem] text-muted">{meta.tagline}</p>
        </header>
      )}
      <div className={gameId === "daily-question" ? "mt-6" : "glass rounded-[28px] p-4 sm:p-6"}>{body}</div>
    </div>
  );
}