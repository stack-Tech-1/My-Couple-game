"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/design/Button";
import { TextArea } from "@/design/Field";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { sendFeedback } from "@/lib/feedback/actions";
import { FEEDBACK_KIND_LABEL, FEEDBACK_KINDS, type FeedbackKind } from "@/lib/feedback/types";
import { isDataSaverOn } from "@/lib/dataSaver";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Shrinks a screenshot to something small enough to send over mobile data. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.8));
}

/** Facts that help reproduce a problem. Never anything anyone wrote. */
function deviceMeta(): Record<string, string> {
  const n = navigator as Navigator & { connection?: { effectiveType?: string } };
  return {
    page: location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id"),
    browser: n.userAgent.slice(0, 300),
    screen: `${innerWidth}x${innerHeight}`,
    installed: String(matchMedia("(display-mode: standalone)").matches),
    network: n.connection?.effectiveType ?? "unknown",
    dataSaver: String(isDataSaverOn()),
    version: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
  };
}

export function FeedbackForm({ userId, onSent, defaultKind = "idea", compact }: { userId: string; onSent?: () => void; defaultKind?: FeedbackKind; compact?: boolean }) {
  const [kind, setKind] = useState<FeedbackKind>(defaultKind);
  const [body, setBody] = useState("");
  const [shot, setShot] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      let screenshotPath: string | undefined;
      if (shot) {
        try {
          const blob = await shrink(shot);
          const path = `${userId}/${crypto.randomUUID()}.jpg`;
          const { error } = await supabaseBrowser().storage.from("feedback").upload(path, blob, { contentType: "image/jpeg" });
          if (error) throw error;
          screenshotPath = path;
        } catch {
          return void toast.error("The screenshot didn't upload.", "Send it without one, or try a different picture.");
        }
      }
      const res = await sendFeedback({ kind, body, screenshotPath, meta: deviceMeta() });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Thank you. We read every one.", "You'll see our reply here, under “Your messages”.");
      setBody("");
      setShot(null);
      onSent?.();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset>
        <legend className="text-[0.82rem] font-semibold">What&apos;s it about?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FEEDBACK_KINDS.map((k) => (
            <label key={k} className={cn("cursor-pointer rounded-full border-[1.5px] px-3.5 py-1.5 text-[0.85rem] font-semibold", kind === k ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg")}>
              <input type="radio" name="feedback-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {FEEDBACK_KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <TextArea
        label={kind === "bug" ? "What happened, and what did you expect?" : "Tell us"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={compact ? 3 : 4}
        required
        placeholder={kind === "bug" ? "I tapped Rematch and nothing happened…" : kind === "idea" ? "It would be amazing if…" : ""}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setShot(e.target.files?.[0] ?? null)} />
          {shot ? (
            <span className="inline-flex items-center gap-2 text-[0.85rem]">
              <Icon name="camera" size={16} /> {shot.name.slice(0, 28)}
              <button type="button" onClick={() => setShot(null)} className="font-semibold text-accent-ink underline underline-offset-2">
                Remove
              </button>
            </span>
          ) : (
            <Button type="button" variant="ghost" size="sm" icon="camera" onClick={() => fileRef.current?.click()}>
              Add a screenshot
            </Button>
          )}
        </div>
        <Button type="submit" loading={pending} disabled={body.trim().length < 3}>
          Send
        </Button>
      </div>
      <p className="text-[0.78rem] text-muted">We also send your page, device and app version to help fix things. Never your messages or anything else in your room.</p>
    </form>
  );
}
