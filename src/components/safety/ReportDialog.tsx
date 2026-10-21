"use client";

import { useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { TextArea } from "@/design/Field";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { reportMember, reportPartner } from "@/lib/room/actions";
import { REPORT_LABELS, REPORT_REASONS, type ReportReason } from "@/lib/room/types";

/**
 * Report your partner, or one of their messages. The message is copied server-side at report
 * time; nothing about the report is shown to the partner.
 */
export function ReportDialog({
  open,
  onClose,
  partnerName,
  message,
  onBlockInstead,
  target,
}: {
  open: boolean;
  onClose: () => void;
  partnerName: string;
  /** When reporting one message: its id and a short preview. */
  message?: { id: string; preview: string } | null;
  onBlockInstead?: () => void;
  /** Friend rooms: who is being reported, and where. Couple rooms leave this out (it's the partner). */
  target?: { roomId: string; userId: string };
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function close() {
    onClose();
    // Reset after the closing animation.
    setTimeout(() => {
      setReason(null);
      setDetails("");
      setSent(false);
    }, 250);
  }

  function submit() {
    if (!reason) return;
    start(async () => {
      const input = { reason, details: details || undefined, messageId: message?.id };
      const res = target ? await reportMember({ ...input, roomId: target.roomId, reportedId: target.userId }) : await reportPartner(input);
      if (!res.ok) return void toast.error(res.error);
      setSent(true);
    });
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={sent ? "Thank you for telling us" : message ? "Report this message" : `Report ${partnerName}`}
      description={sent ? undefined : `${partnerName} won't be told. We'll look at it and act if it breaks our rules.`}
    >
      {sent ? (
        <div>
          <p className="text-muted">
            We&apos;ve got your report. If you&apos;re in danger, please contact someone you trust or the emergency services (112 in Nigeria) right away.
          </p>
          {onBlockInstead ? (
            <p className="mt-3 text-muted">
              {target
                ? `You can also block ${partnerName}. Their messages and game invites will be hidden from you.`
                : `You can also block ${partnerName}. You'll leave the room and they won't be able to pair with you again.`}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {onBlockInstead ? (
              <Button
                variant="danger"
                onClick={() => {
                  close();
                  onBlockInstead();
                }}
              >
                Block {partnerName}
              </Button>
            ) : null}
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <div>
          {message ? (
            <blockquote className="mb-4 line-clamp-3 rounded-[12px] border-l-4 border-line-strong bg-raised px-3 py-2 text-[0.9rem]">{message.preview}</blockquote>
          ) : null}
          <fieldset>
            <legend className="text-[0.82rem] font-semibold">What&apos;s wrong?</legend>
            <div className="mt-2 flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <label key={r} className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] px-3.5 py-2.5 text-[0.92rem]", reason === r ? "border-line-strong bg-raised font-semibold" : "border-line")}>
                  <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-[var(--accent)]" />
                  {REPORT_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4">
            <TextArea label="Anything else we should know? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submit} loading={pending} disabled={!reason}>
              Send report
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
