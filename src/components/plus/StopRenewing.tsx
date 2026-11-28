"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { cancelRenewal } from "@/lib/plus/actions";

/** Stop a card plan renewing (outside a room, where PlusManage can't go). Plus runs to the end. */
export function StopRenewing({ endsOn }: { endsOn: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="mt-4">
      <Button variant="ghost" onClick={() => setOpen(true)}>Stop renewing</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Stop renewing?" description={endsOn ? `Plus stays on until ${endsOn}, then your card isn't charged again.` : "Your card won't be charged again."}>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await cancelRenewal();
                if (!r.ok) return void toast.error(r.error);
                setOpen(false);
                toast.success("Done. It won't renew.");
                router.refresh();
              })
            }
          >
            Stop renewing
          </Button>
        </div>
      </Modal>
    </div>
  );
}
