"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { challengeOptions, sendChallenge, type ChallengeOptions } from "@/lib/solo/challenge-actions";
import { makePoster, sharePoster, type PosterInput } from "./poster";

type Props = {
  open: boolean;
  onClose: () => void;
  scoreId: string;
  poster: Omit<PosterInput, "challenge" | "headline">;
};

/**
 * "Beat my score": someone in your rooms (they get a notification), or a link for someone who
 * isn't on Amah yet. A link always lands them in a friend room you pick, never your couple room.
 */
export function ChallengeSheet({ open, onClose, scoreId, poster }: Props) {
  const [opts, setOpts] = useState<ChallengeOptions | null>(null);
  const [step, setStep] = useState<"who" | "room">("who");
  const [room, setRoom] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || opts) return;
    void challengeOptions().then((r) => (r.ok ? setOpts(r.data) : toast.error(r.error)));
  }, [open, opts]);

  const close = () => {
    setStep("who");
    setRoom(null);
    onClose();
  };

  const sendTo = (id: string, name: string) =>
    start(async () => {
      const r = await sendChallenge({ scoreId, to: id });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Challenge sent to ${name}.`, "We'll tell you how they do.");
      close();
    });

  const sendLink = () =>
    start(async () => {
      if (!room) return;
      const r = await sendChallenge({ scoreId, room });
      if (!r.ok) return void toast.error(r.error);
      const blob = await makePoster({ ...poster, challenge: true, headline: `Beat ${poster.name}` });
      const how = await sharePoster(blob, r.data.text, r.data.url);
      if (how === "copied") toast.success("Poster saved and link copied.", "Paste it anywhere.");
      close();
    });

  const roomsWithSpace = opts?.rooms.filter((r) => !r.full) ?? [];

  return (
    <Modal open={open} onClose={close} title={step === "who" ? "Challenge someone" : "Where should they land?"} description={step === "who" ? `Can anyone beat ${poster.scoreText}?` : "Someone new joins one of your friend rooms when they play. Never your couple room."}>
      {!opts ? (
        <p className="text-muted">One moment…</p>
      ) : step === "who" ? (
        <div className="flex flex-col gap-2">
          {opts.people.length ? (
            <ul className="flex flex-col gap-2">
              {opts.people.map((p) => (
                <li key={p.id}>
                  <button type="button" disabled={pending} onClick={() => sendTo(p.id, p.name)} className="flex w-full items-center gap-3 rounded-[14px] border-[1.5px] border-line px-3 py-2.5 text-left font-semibold hover:border-line-strong">
                    <Avatar name={p.name} motif={p.avatar_key} hue={p.avatar_hue} size={32} />
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.9rem] text-muted">Nobody in your rooms yet.</p>
          )}
          <Button size="lg" variant="outline" className="mt-2" onClick={() => setStep("room")}>
            Someone not on Amah yet
          </Button>
        </div>
      ) : (
        <div>
          <div role="radiogroup" aria-label="Friend room" className="flex flex-col gap-2">
            {roomsWithSpace.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={room === r.id} onClick={() => setRoom(r.id)} className={cn("rounded-[14px] border-[1.5px] px-3.5 py-2.5 text-left", room === r.id ? "border-line-strong bg-raised" : "border-line")}>
                <span className="block font-semibold">{r.name}</span>
                <span className="text-[0.8rem] text-muted">{r.members} of 8 people</span>
              </button>
            ))}
            {opts.canStartRoom ? (
              <button type="button" role="radio" aria-checked={room === "new"} onClick={() => setRoom("new")} className={cn("rounded-[14px] border-[1.5px] px-3.5 py-2.5 text-left", room === "new" ? "border-line-strong bg-raised" : "border-line")}>
                <span className="block font-semibold">Start a new friend room</span>
                <span className="text-[0.8rem] text-muted">Just you two to begin with</span>
              </button>
            ) : null}
          </div>
          {opts.rooms.some((r) => r.full) ? <p className="mt-2 text-[0.8rem] text-muted">Full rooms (8 people) aren&apos;t shown.</p> : null}
          {!roomsWithSpace.length && !opts.canStartRoom ? <p className="mt-2 text-[0.9rem] text-muted">{opts.startRoomNote ?? "There's no friend room with space."}</p> : null}
          {!opts.canStartRoom && opts.startRoomNote && roomsWithSpace.length ? <p className="mt-2 text-[0.8rem] text-muted">{opts.startRoomNote}</p> : null}
          <div className="mt-4 flex justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep("who")}>Back</Button>
            <Button loading={pending} disabled={!room} onClick={sendLink}>Share the challenge</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
