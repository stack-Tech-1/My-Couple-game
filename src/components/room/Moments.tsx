"use client";

import { useRoom } from "@/lib/realtime/RoomProvider";
import type { Moment } from "@/lib/room/types";
import { gameMeta } from "@/games/catalog";

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Moments({ moments }: { moments: Moment[] }) {
  const { bundle } = useRoom();
  const nameOf = (id: string | null) =>
    id === bundle.me.profile.id ? "You" : id === bundle.partner?.profile.id ? bundle.partner.profile.display_name : "Someone";

  const describe = (m: Moment): string => {
    const game = typeof m.payload.gameId === "string" ? gameMeta(m.payload.gameId)?.name : undefined;
    switch (m.kind) {
      case "paired":
        return "You two became a room. Cue the music.";
      case "game_won":
        return `${nameOf(typeof m.payload.winner === "string" ? m.payload.winner : null)} won ${game ?? "a game"}.`;
      case "game_tied":
        return `${game ?? "A game"} ended in a tie. Nobody's happy.`;
      case "coop_cleared":
        return `You cleared ${game ?? "a co-op game"} together.`;
      case "coop_missed":
        return `${game ?? "A co-op game"} got the better of you both. Rematch?`;
      case "game_completed":
        return `You finished a round of ${game ?? "a game"}.`;
      case "note_sent":
        return `${nameOf(m.actor_id)} sent a love note.`;
      case "note_sealed":
        return `${nameOf(m.actor_id)} sealed a love note for later.`;
      case "note_opened":
        return `${nameOf(m.actor_id)} opened a love note.`;
      case "memory_answered":
        return `${nameOf(m.actor_id)} answered a Memory Lane prompt.`;
      case "bucket_done":
        return `Ticked off the bucket list: ${typeof m.payload.title === "string" ? m.payload.title : "something big"}.`;
      case "daily_both":
        return "You both answered today's question.";
      default:
        return `${nameOf(m.actor_id)} did a thing.`;
    }
  };

  return (
    <section aria-labelledby="moments-h">
      <h2 id="moments-h" className="eyebrow border-t-[1.5px] border-line-strong pt-5 text-muted">Recent moments</h2>
      {moments.length === 0 ? (
        <p className="mt-5 leading-relaxed text-muted">
          Nothing here yet. Every win, tie and sealed love note ends up on this little timeline. Go make some history.
        </p>
      ) : (
        <ol className="relative mt-5 space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
          {moments.map((m) => (
            <li key={m.id} className="relative pl-7">
              <span aria-hidden className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-[1.5px] border-line-strong bg-bg" />
              <p className="leading-snug">{describe(m)}</p>
              <p className="mt-0.5 text-[0.8rem] text-muted"><time dateTime={m.created_at}>{relTime(m.created_at)}</time></p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}