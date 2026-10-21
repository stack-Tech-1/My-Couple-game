"use client";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { toPeaks, MAX_VOICE_SECONDS } from "./types";

export const PRIVATE_BUCKET = "chat-media";
export const STARTER_BUCKET = "stickers";

// ---- URLs ---------------------------------------------------------------------------------------

const SIGN_FOR = 60 * 60; // seconds
const signed = new Map<string, { url: Promise<string | null>; until: number }>();

/** A short-lived link to a private chat file. Cached and shared, renewed before it expires. */
export function privateUrl(path: string): Promise<string | null> {
  const hit = signed.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const url = supabaseBrowser()
    .storage.from(PRIVATE_BUCKET)
    .createSignedUrl(path, SIGN_FOR)
    .then(({ data }) => data?.signedUrl ?? null)
    .catch(() => null);
  signed.set(path, { url, until: Date.now() + (SIGN_FOR - 300) * 1000 });
  void url.then((u) => {
    if (!u) signed.delete(path); // let the next render try again
  });
  return url;
}

export function starterUrl(path: string): string {
  return supabaseBrowser().storage.from(STARTER_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---- voice recording ----------------------------------------------------------------------------

/** Best format this browser can record that the other partner's browser can also play. */
function pickMime(): string {
  const options = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export const canRecord = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export type Recording = { blob: Blob; mime: string; duration: number; peaks: number[] };

export type Recorder = {
  /** Live loudness 0..1 for the meter. */
  level: () => number;
  elapsed: () => number;
  stop: () => Promise<Recording | null>;
  cancel: () => void;
};

export async function startRecording(onLimit: () => void, bitrate = 48_000): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: bitrate } : { audioBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  // Loudness sampling for the waveform.
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  const samples: number[] = [];
  let current = 0;
  const sampler = setInterval(() => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    current = Math.min(1, Math.sqrt(sum / buf.length) * 3);
    samples.push(current);
  }, 60);

  const started = performance.now();
  const limit = setTimeout(onLimit, MAX_VOICE_SECONDS * 1000);
  rec.start(250);

  const teardown = () => {
    clearInterval(sampler);
    clearTimeout(limit);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  return {
    level: () => current,
    elapsed: () => (performance.now() - started) / 1000,
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
      teardown();
    },
    stop: () =>
      new Promise((resolve) => {
        const duration = Math.min(MAX_VOICE_SECONDS, (performance.now() - started) / 1000);
        rec.onstop = () => {
          teardown();
          const type = (rec.mimeType || mime || "audio/webm").split(";")[0]!;
          const blob = new Blob(chunks, { type });
          resolve(duration < 0.5 || !blob.size ? null : { blob, mime: type, duration, peaks: toPeaks(samples) });
        };
        if (rec.state !== "inactive") rec.stop();
        else rec.onstop(new Event("stop"));
      }),
  };
}

export const extFor = (mime: string) => ({ "audio/mp4": "m4a", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac" })[mime] ?? "audio";

// ---- stickers -----------------------------------------------------------------------------------

const STICKER_PX = 512;
const MAX_STICKER_BYTES = 1024 * 1024;

/** Is this WebP animated? (An "ANIM" chunk means yes.) */
export async function isAnimatedWebp(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const text = String.fromCharCode(...head);
  return text.startsWith("RIFF") && text.includes("ANIM");
}

/**
 * Turn any picture into a sticker. Animated GIF/WebP files are kept exactly as they are (a canvas
 * would freeze them), as long as they're small enough. Everything else is fitted into a 512px
 * square with a transparent background, like WhatsApp's own stickers.
 */
export async function makeSticker(file: File): Promise<{ blob: Blob; type: string; animated: boolean }> {
  const animated = file.type === "image/gif" || (file.type === "image/webp" && (await isAnimatedWebp(file)));
  if (animated) {
    if (file.size > MAX_STICKER_BYTES) throw new Error("Animated stickers need to be under 1 MB.");
    return { blob: file, type: file.type, animated: true };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(STICKER_PX / bitmap.width, STICKER_PX / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = STICKER_PX;
  canvas.height = STICKER_PX;
  canvas.getContext("2d")!.drawImage(bitmap, (STICKER_PX - w) / 2, (STICKER_PX - h) / 2, w, h);
  bitmap.close();
  // Safari can't encode WebP and quietly hands back PNG; either is fine.
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
  if (!blob) throw new Error("Couldn't read that picture.");
  return { blob, type: blob.type || "image/png", animated: false };
}

export const imageExt = (type: string) => ({ "image/webp": "webp", "image/png": "png", "image/gif": "gif" })[type] ?? "img";
