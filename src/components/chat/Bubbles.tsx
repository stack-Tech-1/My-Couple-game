"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { privateUrl, starterUrl } from "@/lib/chat/media";
import { formatDuration, WAVE_BARS, type StickerMedia, type VoiceMedia } from "@/lib/chat/types";

/** Resolve a sticker's address: public for the starter pack, a signed link for the couple's own. */
export function useStickerSrc(media: StickerMedia): string | null {
  const [src, setSrc] = useState<string | null>(() => (media.scope === "starter" ? starterUrl(media.path) : null));
  useEffect(() => {
    if (media.scope === "starter") return setSrc(starterUrl(media.path));
    let live = true;
    void privateUrl(media.path).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [media.scope, media.path]);
  return src;
}

export function StickerImage({ media, size = 132, className, deferred }: { media: StickerMedia; size?: number; className?: string; deferred?: boolean }) {
  // Follows `deferred` as it changes (the data-saver setting loads after the first render).
  const [revealed, setRevealed] = useState(false);
  if (deferred && !revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className={cn("flex flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-line text-[0.75rem] font-semibold text-muted hover:text-fg", className)}
        style={{ width: size, height: size }}
      >
        Sticker
        <span className="font-normal">Tap to show</span>
      </button>
    );
  }
  return <LoadedSticker media={media} size={size} className={className} />;
}

function LoadedSticker({ media, size, className }: { media: StickerMedia; size: number; className?: string }) {
  const src = useStickerSrc(media);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs; next/image would cache them
    <img src={src} alt="Sticker" width={size} height={size} loading="lazy" draggable={false} className={cn("object-contain", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-label="Sticker" role="img" className={cn("block animate-pulse rounded-[14px] bg-sunk", className)} style={{ width: size, height: size }} />
  );
}

// Only one voice note plays at a time, like a phone.
let stopCurrent: (() => void) | null = null;
const SPEEDS = [1, 1.5, 2] as const;

export function VoiceNote({ media, mine, localUrl }: { media: VoiceMedia; mine: boolean; localUrl?: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const duration = media.duration;

  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [],
  );

  // Smooth progress while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (audio.current) setPos(audio.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  async function ensure(): Promise<HTMLAudioElement | null> {
    if (audio.current) return audio.current;
    setLoading(true);
    const url = localUrl ?? (await privateUrl(media.path));
    setLoading(false);
    if (!url) {
      setFailed(true);
      return null;
    }
    const a = new Audio(url);
    a.preload = "auto";
    a.onended = () => {
      setPlaying(false);
      setPos(0);
    };
    a.onerror = () => {
      setPlaying(false);
      setFailed(true);
    };
    audio.current = a;
    return a;
  }

  async function toggle() {
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    const a = await ensure();
    if (!a) return;
    stopCurrent?.();
    stopCurrent = () => {
      a.pause();
      setPlaying(false);
    };
    a.playbackRate = speed;
    try {
      await a.play();
      setFailed(false);
      setPlaying(true);
    } catch {
      setFailed(true);
    }
  }

  async function seek(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    const a = await ensure();
    if (!a) return;
    a.currentTime = t;
    setPos(t);
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  }

  const progress = duration ? pos / duration : 0;
  const peaks = media.peaks.length ? media.peaks : Array.from({ length: WAVE_BARS }, () => 0.3);
  const fg = mine ? "bg-bg" : "bg-fg";

  return (
    <div className="flex w-[min(15rem,62vw)] items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : `Play voice message, ${formatDuration(duration)}`}
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", mine ? "bg-bg text-fg" : "bg-fg text-bg")}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M3.5 2.2v9.6c0 .5.5.8.9.5l7.4-4.8c.4-.2.4-.8 0-1L4.4 1.7c-.4-.3-.9 0-.9.5Z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={-1}
          aria-label="Position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(pos)}
          onPointerDown={seek}
          className="flex h-7 cursor-pointer items-center gap-[2px]"
        >
          {peaks.map((p, i) => (
            <span
              key={i}
              aria-hidden
              className={cn("w-[3px] flex-1 rounded-full transition-opacity", fg, (i + 0.5) / peaks.length <= progress ? "opacity-100" : "opacity-35")}
              style={{ height: `${Math.max(14, p * 100)}%` }}
            />
          ))}
        </div>
        <div className={cn("mt-0.5 flex items-center justify-between text-[0.7rem]", mine ? "text-bg/75" : "text-muted")}>
          <span className="tabular-nums">{failed ? "Couldn't play" : formatDuration(playing || pos ? Math.max(0, duration - pos) : duration)}</span>
          {playing || pos ? (
            <button type="button" onClick={cycleSpeed} className="rounded-full px-1.5 font-semibold tabular-nums" aria-label={`Playback speed ${speed}x`}>
              {speed}×
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
