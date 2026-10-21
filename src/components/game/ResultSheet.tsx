"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/design/Button";
import { Confetti } from "@/design/Confetti";
import { toast } from "@/design/toast";
import { gameMeta } from "@/games/catalog";
import { gameApi } from "@/lib/games/client";
import type { SessionRow } from "@/lib/games/types";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { track } from "@/lib/analytics";
import { Modal } from "@/design/Modal";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

const WIN = ["Called it.", "Undefeated (today).", "That's how it's done."];
const LOSE = ["Rematch?", "They got lucky.", "A setback, not a verdict."];

export function ResultSheet({ session, me, names }: { session: SessionRow; me: string; names: Record<string, string> }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const router = useRouter();
  const { send } = useRoom();
  const [busy, setBusy] = useState(false);
  const meta = gameMeta(session.game_id);
  const partnerName = names[session.players.find((p) => p !== me) ?? ""] ?? "Your partner";
  const pick = (arr: string[]) => arr[session.id.charCodeAt(0) % arr.length]!;

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
      sub = iWon ? pick(WIN) : pick(LOSE);
      break;
    case "tie":
      title = "Dead even.";
      sub = "Nobody wins. Nobody sleeps on the couch.";
      break;
    case "coop_win":
      eyebrow = "Cleared";
      title = "You did it. Together.";
      sub = "Teamwork, apparently, does make the dream work.";
      break;
    case "complete":
      eyebrow = "Finished";
      title = "That was a good one.";
      sub = "Saved to your moments.";
      break;
    case "coop_loss":
      title = "Not this time.";
      sub = "Regroup, hydrate, try again.";
      break;
    default:
      title = "Game ended.";
      sub = "Nothing on the record. Pick it back up whenever.";
  }

  async function rematch() {
    setBusy(true);
    try {
      const next = await gameApi.create(session.game_id, { rematchOf: session.id });
      send("game:invite", { sessionId: next.id, gameId: next.game_id, rematch: true });
      track("rematch", { game: session.game_id });
      router.push(`/room/${next.room_id}/play/${next.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start a rematch.");
      setBusy(false);
    }
  }

  return (
    <>
      {iWon ? <Confetti /> : null}
      <motion.section
        role="dialog"
        aria-labelledby="result-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.5 }}
        className="fixed inset-x-0 bottom-0 z-50 border-t-[1.5px] border-line-strong bg-bg px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-[0_-24px_60px_-30px_rgba(28,20,22,.5)] sm:px-8"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-accent-ink">{eyebrow} · {meta?.name}</p>
            <h2 id="result-title" className="display mt-2 text-[clamp(2.4rem,8vw,3.4rem)]">{title}</h2>
            <p className="mt-1 text-muted">{sub}</p>
            <button type="button" onClick={() => setFeedbackOpen(true)} className="mt-2 text-[0.85rem] font-semibold text-muted underline underline-offset-2 hover:text-fg">
              How was that game? Tell us
            </button>
          </div>
          <div className="flex gap-3">
            <Link href={`/room/${session.room_id}`} className="inline-flex h-12 items-center rounded-full px-5 font-semibold hover:bg-sunk">Library</Link>
            <Button size="lg" variant="accent" icon="refresh" loading={busy} onClick={rematch}>Rematch</Button>
          </div>
        </div>
      </motion.section>
      <Modal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="How was it?" description={`Anything about ${meta?.name ?? "this game"}: bugs, ideas, what you loved.`}>
        <FeedbackForm userId={me} compact onSent={() => setFeedbackOpen(false)} />
      </Modal>
    </>
  );
}