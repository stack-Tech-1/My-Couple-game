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
import { AdireFill } from "@/design/adire";
import { Avatar } from "@/design/Avatar";
import { INDIGO_LOOK } from "@/games/look";
import { cn } from "@/lib/cn";

const WIN = ["Called it.", "Undefeated (today).", "That's how it's done."];
const LOSE = ["Rematch?", "They got lucky.", "A setback, not a verdict."];

export function ResultSheet({ session, me, names }: { session: SessionRow; me: string; names: Record<string, string> }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const router = useRouter();
  const { send, bundle } = useRoom();
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
      send("game:invite", { sessionId: next.id, gameId: next.game_id, rematch: true, to: next.players.filter((p) => p !== me) });
      track("rematch", { game: session.game_id });
      router.push(`/room/${next.room_id}/play/${next.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start a rematch.");
      setBusy(false);
    }
  }

  // Big moments get the adire celebration: indigo printed with dundun (celebration and joy).
  const celebrate = !spicy && (session.outcome === "win" || session.outcome === "tie" || session.outcome === "coop_win");
  const profileOf = (id: string) => bundle.members.find((m) => m.profile.id === id)?.profile;

  return (
    <>
      {iWon ? <Confetti /> : null}
      <motion.section
        role="dialog"
        aria-labelledby="result-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.5 }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 overflow-hidden px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-[0_-24px_60px_-30px_rgba(28,20,22,.5)] sm:px-8",
          celebrate ? "rounded-t-[28px] text-[#f6efe6]" : "border-t-[1.5px] border-line-strong bg-bg",
        )}
      >
        {celebrate ? (
          <>
            <AdireFill motif="dundun" bg={INDIGO_LOOK.bg} ink={INDIGO_LOOK.ink} />
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(24,32,63,.35), rgba(24,32,63,.9) 70%)" }} />
          </>
        ) : null}
        {celebrate ? (
          <div className="relative mx-auto mb-4 flex max-w-3xl items-end justify-center gap-4 sm:justify-start">
            {session.players.map((id) => {
              const p = profileOf(id);
              if (!p) return null;
              const star = session.outcome === "coop_win" || session.winner === id;
              return (
                <span key={id} className="flex flex-col items-center gap-1">
                  <span className="rounded-full p-[3px]" style={{ background: star ? "#f2b705" : "rgba(246,239,230,.6)", boxShadow: star ? "0 0 0 6px rgba(242,183,5,.2)" : undefined }}>
                    <Avatar name={p.display_name} motif={p.avatar_key} hue={p.avatar_hue} size={star ? 64 : 46} />
                  </span>
                  <span className="max-w-[6rem] truncate text-[0.82rem] font-bold">{id === me ? "You" : p.display_name}</span>
                </span>
              );
            })}
          </div>
        ) : null}
        <div className="relative mx-auto flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={cn("eyebrow", celebrate ? "text-[#ffd65c]" : "text-accent-ink")}>{eyebrow} · {meta?.name}</p>
            <h2 id="result-title" className="display mt-2 text-[clamp(2.4rem,8vw,3.4rem)]">{title}</h2>
            <p className={cn("mt-1", celebrate ? "opacity-85" : "text-muted")}>{sub}</p>
            <button type="button" onClick={() => setFeedbackOpen(true)} className={cn("mt-2 text-[0.85rem] font-semibold underline underline-offset-2", celebrate ? "opacity-75 hover:opacity-100" : "text-muted hover:text-fg")}>
              How was that game? Tell us
            </button>
          </div>
          <div className="flex gap-3">
            <Link prefetch={false} href={`/room/${session.room_id}`} className={cn("inline-flex h-12 items-center rounded-full px-5 font-semibold", celebrate ? "hover:bg-[rgba(246,239,230,.12)]" : "hover:bg-sunk")}>Library</Link>
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