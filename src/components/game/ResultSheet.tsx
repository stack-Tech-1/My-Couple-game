"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { gameMeta } from "@/games/catalog";
import { gameApi } from "@/lib/games/client";
import type { SessionRow } from "@/lib/games/types";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { track } from "@/lib/analytics";
import { Modal } from "@/design/Modal";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { ResultPop } from "@/design/ResultPop";
import { Avatar } from "@/design/Avatar";
import { CATEGORY_LOOKS, lookFor } from "@/games/look";

export function ResultSheet({ session, me, names }: { session: SessionRow; me: string; names: Record<string, string> }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const router = useRouter();
  const { send, bundle } = useRoom();
  const [busy, setBusy] = useState(false);
  const meta = gameMeta(session.game_id);
  const partnerName = names[session.players.find((p) => p !== me) ?? ""] ?? "Your partner";

  let eyebrow = "Game over";
  let title: string;
  let sub: string;
  const iWon = session.outcome === "win" && session.winner === me;
  const spicy = meta?.category === "spicy";
  switch (spicy ? "spicy" : session.outcome) {
    case "spicy":
      eyebrow = "After dark";
      title = "Session ended.";
      sub = "";
      break;
    case "win":
      title = iWon ? "You won." : `${partnerName} won.`;
      sub = "";
      break;
    case "tie":
      title = "Dead even.";
      sub = "";
      break;
    case "coop_win":
      eyebrow = "Cleared";
      title = "You did it. Together.";
      sub = "";
      break;
    case "complete":
      eyebrow = "Finished";
      title = "That was a good one.";
      sub = "Saved to your moments.";
      break;
    case "coop_loss":
      title = "Not this time.";
      sub = "";
      break;
    default:
      title = "Game ended.";
      sub = "Nothing on the record.";
  }

  async function rematch() {
    setBusy(true);
    try {
      const next = await gameApi.create(session.game_id, { rematchOf: session.id });
      send("game:invite", { sessionId: next.id, gameId: next.game_id, rematch: true, to: next.players.filter((p) => p !== me) });
      track("rematch", { game: session.game_id });
      router.push(`/room/${next.room_id}/play/${next.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start a rematch.");
      setBusy(false);
    }
  }

  // Wins and ties get the gold; the card wears the game's own print (After Dark keeps its dark one).
  const celebrate = !spicy && (session.outcome === "win" || session.outcome === "tie" || session.outcome === "coop_win");
  const profileOf = (id: string) => bundle.members.find((m) => m.profile.id === id)?.profile;
  const look = spicy ? CATEGORY_LOOKS.spicy : meta ? lookFor(meta.id, meta.category) : CATEGORY_LOOKS.competitive;
  const players = (
    <div className="flex items-end justify-center gap-3">
      {session.players.map((id) => {
        const p = profileOf(id);
        if (!p) return null;
        const star = celebrate && (session.outcome !== "win" || session.winner === id);
        return (
          <span key={id} className="flex flex-col items-center gap-1">
            <span className="rounded-full border-4 border-[var(--bg-raised)]" style={{ boxShadow: star ? "0 0 0 3px #f0a928" : undefined }}>
              <Avatar name={p.display_name} motif={p.avatar_key} hue={p.avatar_hue} size={star ? 52 : 44} />
            </span>
            <span className="max-w-[6rem] truncate text-[0.8rem] font-bold">{id === me ? "You" : p.display_name}</span>
          </span>
        );
      })}
    </div>
  );

  return (
    <>
      <ResultPop look={look} win={iWon || session.outcome === "coop_win"} labelledBy="result-title" top={spicy ? undefined : players}>
        <p className="eyebrow text-muted">{eyebrow} · {meta?.name}</p>
        <h2 id="result-title" className="display mt-1 text-[2rem] leading-none">{title}</h2>
        {sub ? <p className="mt-2 text-[0.92rem] font-semibold text-muted">{sub}</p> : null}
        <div className="mt-5 flex flex-col gap-2.5">
          <Button size="lg" variant="accent" icon="refresh" loading={busy} onClick={rematch}>Rematch</Button>
          <Link prefetch={false} href={`/room/${session.room_id}/games`} className="mt-1 text-[0.92rem] font-semibold underline underline-offset-4">
            Back to games
          </Link>
          <button type="button" onClick={() => setFeedbackOpen(true)} className="text-[0.85rem] font-semibold text-muted underline underline-offset-2 hover:text-fg">
            How was that game? Tell us
          </button>
        </div>
      </ResultPop>
      <Modal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="How was it?" description={`Anything about ${meta?.name ?? "this game"}: bugs, ideas, what you loved.`}>
        <FeedbackForm userId={me} compact onSent={() => setFeedbackOpen(false)} />
      </Modal>
    </>
  );
}