"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { answerWaitingPrompt, setSoloHome } from "@/lib/solo/home-actions";

/**
 * Asked once, to people whose partner hasn't joined and who have no friend room: keep waiting
 * (with the invite to hand), play Solo for now, or start a friend room instead.
 */
export function WaitingPrompt({ inviteCode }: { inviteCode: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    void answerWaitingPrompt();
  };

  const shareInvite = async () => {
    if (!inviteCode) return close();
    const url = `${window.location.origin}/join/${inviteCode}`;
    const text = `Come play with me on Amah. Your invite code is ${inviteCode}.`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Invite copied.", "Paste it to your person.");
      }
    } catch {
      // Share sheet closed: nothing to do.
    }
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Still waiting for your person?" description="No wahala. Here's what you can do while they get here.">
      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={pending} onClick={() => void shareInvite()} className="rounded-[16px] border-[1.5px] border-line px-4 py-3 text-left hover:border-line-strong">
          <span className="block font-bold">Keep waiting</span>
          <span className="text-[0.85rem] text-muted">{inviteCode ? `Send them your code again: ${inviteCode}` : "Your invite is on the home screen."}</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setSoloHome(true);
              if (!r.ok) return void toast.error(r.error);
              router.push("/solo");
            })
          }
          className="rounded-[16px] border-[1.5px] border-line px-4 py-3 text-left hover:border-line-strong"
        >
          <span className="block font-bold">Play on my own for now</span>
          <span className="text-[0.85rem] text-muted">Solo games become your home. Your room stays open, and everything connects when they join.</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await answerWaitingPrompt();
              router.push("/room/new");
            })
          }
          className="rounded-[16px] border-[1.5px] border-line px-4 py-3 text-left hover:border-line-strong"
        >
          <span className="block font-bold">Start a friend room instead</span>
          <span className="text-[0.85rem] text-muted">Up to 8 friends, Whot, Ludo and more.</span>
        </button>
      </div>
      <p className="mt-4 text-[0.8rem] text-muted">You can change this any time in Settings.</p>
    </Modal>
  );
}
