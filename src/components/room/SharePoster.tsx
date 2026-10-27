"use client";

import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";

const CAPTION = "Come play with us on Amah: playamah.app";

/** "Share" that makes a poster (level, streak, score, the link) sized for a WhatsApp status. */
export function SharePoster({ roomId, label = "Share as a poster", variant = "ghost" }: { roomId: string; label?: string; variant?: ButtonProps["variant"] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  async function make() {
    setOpen(true);
    if (file) return;
    setLoading(true);
    try {
      const res = await fetch(`/room/${roomId}/poster`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 429 ? "Too many posters for now. Try again in a bit." : "The poster didn't load.");
      const blob = await res.blob();
      setFile(new File([blob], "my-amah.png", { type: "image/png" }));
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      setOpen(false);
      toast.error(e instanceof Error ? e.message : "The poster didn't load.", "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const canShareFile = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: CAPTION });
    } catch {
      // share sheet dismissed
    }
  }

  return (
    <>
      <Button variant={variant} size="sm" icon="link" onClick={() => void make()}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Your poster" description="Made for your WhatsApp status, or anywhere you like.">
        <div className="flex flex-col items-center gap-4">
          <div className="flex aspect-[9/16] w-full max-w-[260px] items-center justify-center overflow-hidden rounded-[16px] border border-line bg-sunk">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
            {url ? <img src={url} alt="Your Amah poster" className="h-full w-full object-cover" /> : <span className="text-[0.9rem] text-muted">{loading ? "Making your poster…" : ""}</span>}
          </div>
          <div className="flex w-full flex-wrap justify-center gap-2">
            {canShareFile ? (
              <Button icon="link" onClick={() => void share()}>
                Share
              </Button>
            ) : null}
            {url ? (
              <a href={url} download="my-amah.png" className="inline-flex h-11 items-center rounded-full border-[1.5px] border-line px-5 font-semibold hover:border-line-strong">
                Save image
              </a>
            ) : null}
          </div>
          <p className="text-center text-[0.8rem] text-muted">Only your names and numbers are on it. Pet names stay private.</p>
        </div>
      </Modal>
    </>
  );
}
