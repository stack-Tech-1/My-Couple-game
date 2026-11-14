"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { PosterStudio } from "@/components/poster/PosterStudio";
import type { Poster } from "@/lib/poster/model";
import { posterDataFromRoom } from "@/lib/poster/fromRoom";
import type { PosterData } from "@/lib/poster/styles";

/** "Share" that opens the poster studio: four styles for a WhatsApp status, drawn on the phone. */
export function SharePoster({ roomId, label = "Share as a poster", variant = "ghost" }: { roomId: string; label?: string; variant?: ButtonProps["variant"] }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PosterData | null>(null);
  const [loading, setLoading] = useState(false);

  async function make() {
    setOpen(true);
    if (data) return;
    setLoading(true);
    try {
      const res = await fetch(`/room/${roomId}/poster?format=json`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 429 ? "Too many posters for now. Try again in a bit." : "The poster didn't load.");
      setData(posterDataFromRoom((await res.json()) as Poster));
    } catch (e) {
      setOpen(false);
      toast.error(e instanceof Error ? e.message : "The poster didn't load.", "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const two = (data?.people.length ?? 0) > 1;
  return (
    <>
      <Button variant={variant} size="sm" icon="link" onClick={() => void make()}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Your poster" description="Swipe for a style. Made for your WhatsApp status, or anywhere you like.">
        {data ? (
          <PosterStudio data={data} fileName="my-amah" shareText={two ? "Come play with us on Amah:" : "Come play with me on Amah:"} />
        ) : (
          <p className="py-16 text-center text-[0.9rem] text-muted">{loading ? "Getting your numbers…" : ""}</p>
        )}
      </Modal>
    </>
  );
}
