"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { regenerateInvite } from "@/lib/room/actions";

export function InvitePanel() {
  const { bundle } = useRoom();
  const friends = bundle.room.kind === "friends";
  const seats = 8 - bundle.members.length;
  const [code, setCode] = useState(bundle.room.invite_code ?? "");
  const [pending, start] = useTransition();
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.", "Now send it somewhere they'll actually look.");
    } catch {
      toast.error("Couldn't reach your clipboard.", link);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: friends ? `Join ${bundle.room.name} on Amah` : "Come play with me", text: friends ? `Come play with us. Code ${code}.` : `I made us a room. Code ${code}.`, url: link });
      } catch {
        // dismissed share sheet; nothing to do
      }
    } else {
      await copy();
    }
  }

  return (
    <section aria-labelledby="invite-h" className="mt-8 overflow-hidden rounded-[22px] border-[1.5px] border-line-strong">
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          {friends ? (
            <>
              <p className="eyebrow text-accent-ink">{seats} {seats === 1 ? "seat" : "seats"} left</p>
              <h2 id="invite-h" className="display mt-3 text-[clamp(2rem,6vw,3rem)]">Bring your people.</h2>
              <p className="mt-3 max-w-lg text-muted">
                Up to eight in a friend room. The code keeps working until you make a new one, so only share it with people you want in.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow text-accent-ink">One seat left</p>
              <h2 id="invite-h" className="display mt-3 text-[clamp(2rem,6vw,3rem)]">Your room is ready. It&apos;s missing someone.</h2>
              <p className="mt-3 max-w-lg text-muted">
                Send them the link, or read the code out loud. As soon as they join, the room locks to the two of you and this card disappears.
              </p>
            </>
          )}
        </div>
        <div>
          <p className="sr-only">Invite code: {code.split("").join(" ")}</p>
          <div aria-hidden className="flex gap-1.5">
            {code.split("").map((ch, i) => (
              <motion.span
                key={`${code}-${i}`}
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                className="display tabular flex h-14 w-11 items-center justify-center rounded-[8px] border-[1.5px] border-line-strong bg-raised text-[1.9rem]"
              >
                {ch}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-line bg-raised px-6 py-4 sm:px-8">
        <Button variant="accent" icon="link" onClick={share}>Send the invite</Button>
        <Button variant="outline" icon="copy" onClick={copy}>Copy link</Button>
        <Button
          variant="ghost"
          icon="refresh"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await regenerateInvite(bundle.room.id);
              if (res.ok) {
                setCode(res.data);
                toast.info("Fresh code.", "The old one no longer works.");
              } else toast.error(res.error);
            })
          }
        >
          New code
        </Button>
      </div>
    </section>
  );
}