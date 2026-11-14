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

export const MAX_POLL_OPTIONS = 6;
export const pollSchema = z.object({ options: z.array(z.string().min(1).max(60)).min(2).max(MAX_POLL_OPTIONS) });
export type Poll = z.infer<typeof pollSchema>;

const base = {
  id: z.uuid(),
  room_id: z.uuid(),
  sender_id: z.uuid(),
  created_at: z.string(),
  /** The message this one answers (0033_chat_more.sql). */
  reply_to: z.uuid().nullish(),
  /** People tagged with @ (friend rooms). */
  mentions: z.array(z.uuid()).max(8).nullish(),
  edited_at: z.string().nullish(),
};
const live = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("text"), body: z.string().min(1).max(MAX_CHAT_LENGTH), media: z.null().optional(), deleted_at: z.null().optional() }),
  z.object({ ...base, kind: z.literal("sticker"), body: z.null().optional(), media: stickerMediaSchema, deleted_at: z.null().optional() }),
  z.object({ ...base, kind: z.literal("voice"), body: z.null().optional(), media: voiceMediaSchema, deleted_at: z.null().optional() }),
  z.object({ ...base, kind: z.literal("poll"), body: z.string().min(1).max(200), media: z.null().optional(), poll: pollSchema, deleted_at: z.null().optional() }),
]);
/** Deleted for everyone: the row stays so replies still point somewhere; the content is gone. */
const deleted = z.object({ ...base, kind: z.enum(["text", "sticker", "voice", "poll"]), body: z.null().optional(), media: z.null().optional(), deleted_at: z.string() });
export const chatMessageSchema = z.union([deleted, live]);
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type LiveMessage = z.infer<typeof live>;
export const isDeleted = (m: ChatMessage): m is z.infer<typeof deleted> => !!m.deleted_at;

/** Your own text can be edited for 15 minutes after sending. */
export const EDIT_WINDOW_MS = 15 * 60_000;
export const canEdit = (m: ChatMessage, me: string, now = Date.now()) => m.sender_id === me && m.kind === "text" && !m.deleted_at && now - Date.parse(m.created_at) < EDIT_WINDOW_MS;

/** Quick reactions, in order. */
export const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "🔥"] as const;

/**
 * A message as the sender sees it before the database has confirmed it. `localUrl` lets a voice
 * note play straight from the recording while it uploads.
 */
export type LocalMessage = ChatMessage & { status?: "sending" | "failed"; localUrl?: string };

/** One-line summary for previews and screen readers. */
export function describe(m: ChatMessage): string {
  if (isDeleted(m)) return "This message was deleted";
  if (m.kind === "sticker") return "Sticker";
  if (m.kind === "voice") return `Voice message, ${formatDuration(m.media.duration)}`;
  if (m.kind === "poll") return `Poll: ${m.body}`;
  return m.body;
}

/** The people tagged in a message that still has their @name in it (for sending). */
export function mentionsIn(text: string, people: { id: string; name: string }[]): string[] {
  return people.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id).slice(0, 8);
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
