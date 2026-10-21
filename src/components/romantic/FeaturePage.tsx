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

/** Library entries that are ongoing room features rather than turn-based sessions. */
export const FEATURES = new Set(["daily-question", "love-notes", "memory-lane", "date-night", "bucket-list"]);

export async function FeaturePage({ gameId, roomId, bundle }: { gameId: string; roomId: string; bundle: RoomBundle }) {
  const meta = gameMeta(gameId)!;
  const cat = CATEGORIES[meta.category];
  const me = bundle.me.profile.id;

  let body: React.ReactNode;
  if (!bundle.partner) body = <p className="text-muted">This one needs two. Invite your person from the room home first.</p>;
  else if (gameId === "daily-question") body = <DailyQuestion daily={await getDaily(roomId, me)} full />;
  else if (gameId === "love-notes") body = <LoveNotes notes={await getNotes(roomId, me)} />;
  else if (gameId === "memory-lane") body = <MemoryLane memories={await getMemories(roomId)} />;
  else if (gameId === "date-night") body = <DateNight ideas={await dateIdeas()} />;
  else body = <BucketList items={await getBucket(roomId)} />;

  return (
    <div className="@container mx-auto max-w-3xl pt-8">
      <Link prefetch={false} href={`/room/${roomId}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} /> Library
      </Link>
      {gameId === "daily-question" ? null : (
        <header className="mb-8 mt-6">
          <p className="eyebrow" style={{ color: cat.ink }}>{cat.label}</p>
          <h1 className="display mt-2 text-[clamp(2.6rem,9vw,4rem)]">{meta.name}</h1>
          <p className="mt-2 text-[1.05rem] text-muted">{meta.tagline}</p>
        </header>
      )}
      <div className={gameId === "daily-question" ? "mt-8" : undefined}>{body}</div>
    </div>
  );
}