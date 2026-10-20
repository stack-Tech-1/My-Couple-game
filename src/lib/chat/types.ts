import { z } from "zod";

export const MAX_CHAT_LENGTH = 2000;
export const CHAT_PAGE = 50;
export const MAX_VOICE_SECONDS = 180;
/** Bars drawn for a voice note's waveform. */
export const WAVE_BARS = 40;

export const stickerMediaSchema = z.object({
  sticker_id: z.uuid(),
  path: z.string().min(1).max(300),
  scope: z.enum(["starter", "room"]),
  animated: z.boolean().optional(),
});
export type StickerMedia = z.infer<typeof stickerMediaSchema>;

export const voiceMediaSchema = z.object({
  path: z.string().min(1).max(300),
  duration: z.number().min(0.3).max(MAX_VOICE_SECONDS),
  mime: z.string().max(60),
  /** Loudness per bar, 0..1, sampled while recording. */
  peaks: z.array(z.number().min(0).max(1)).max(WAVE_BARS),
});
export type VoiceMedia = z.infer<typeof voiceMediaSchema>;

const base = {
  id: z.uuid(),
  room_id: z.uuid(),
  sender_id: z.uuid(),
  created_at: z.string(),
};
export const chatMessageSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("text"), body: z.string().min(1).max(MAX_CHAT_LENGTH), media: z.null().optional() }),
  z.object({ ...base, kind: z.literal("sticker"), body: z.null().optional(), media: stickerMediaSchema }),
  z.object({ ...base, kind: z.literal("voice"), body: z.null().optional(), media: voiceMediaSchema }),
]);
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * A message as the sender sees it before the database has confirmed it. `localUrl` lets a voice
 * note play straight from the recording while it uploads.
 */
export type LocalMessage = ChatMessage & { status?: "sending" | "failed"; localUrl?: string };

/** One-line summary for previews and screen readers. */
export function describe(m: ChatMessage): string {
  if (m.kind === "sticker") return "Sticker";
  if (m.kind === "voice") return `Voice message, ${formatDuration(m.media.duration)}`;
  return m.body;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Squash a stream of loudness samples into a fixed number of bars, normalised to the loudest. */
export function toPeaks(samples: number[], bars = WAVE_BARS): number[] {
  if (!samples.length) return [];
  const out: number[] = [];
  const per = samples.length / bars;
  for (let i = 0; i < bars; i++) {
    const slice = samples.slice(Math.floor(i * per), Math.max(Math.floor(i * per) + 1, Math.floor((i + 1) * per)));
    out.push(slice.length ? Math.max(...slice) : 0);
  }
  const max = Math.max(...out, 0.0001);
  return out.map((v) => Math.round(Math.min(1, v / max) * 100) / 100);
}

/** Merge incoming messages into a list: dedupe by id (the server copy wins), keep time order. */
export function mergeMessages(list: LocalMessage[], incoming: LocalMessage[]): LocalMessage[] {
  if (!incoming.length) return list;
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) {
    const prev = byId.get(m.id);
    // A confirmed copy replaces a pending one (keeping the local recording so playback doesn't
    // reload); a pending copy never overwrites a confirmed one.
    if (!prev) byId.set(m.id, m);
    else if (!m.status) byId.set(m.id, prev.localUrl && !m.localUrl ? { ...m, localUrl: prev.localUrl } : m);
    else if (prev.status) byId.set(m.id, m);
  }
  // Parse, don't compare strings: Postgres ("+00:00", microseconds) and the browser ("Z") format differently.
  return [...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || (a.id < b.id ? -1 : 1));
}

/** How many of the partner's messages arrived after I last read the chat. */
export function countUnread(list: ChatMessage[], me: string, readAt: string | null): number {
  const since = readAt ? Date.parse(readAt) : 0;
  return list.filter((m) => m.sender_id !== me && Date.parse(m.created_at) > since).length;
}
