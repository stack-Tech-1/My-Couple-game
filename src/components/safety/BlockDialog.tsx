"use client";

import { useTransition } from "react";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { blockPartner } from "@/lib/room/actions";

export function BlockDialog({ open, onClose, partnerName }: { open: boolean; onClose: () => void; partnerName: string }) {
  const [pending, start] = useTransition();

  function block() {
    start(async () => {
      const res = await blockPartner();
      if (!res.ok) return void toast.error(res.error);
      // A full navigation: the room is no longer ours, and realtime would race a soft one.
      window.location.assign("/room?blocked=1");
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Block ${partnerName}?`}
      description={`You'll leave this room straight away and ${partnerName} won't be able to pair with you again. They keep the room and its history, and they aren't told why you left.`}
    >
      <p className="text-[0.9rem] text-muted">If they&apos;ve broken our rules, reporting them too helps us keep Amah safe.</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={block} loading={pending}>
          Block and leave
        </Button>
      </div>
    </Modal>
  );
}
