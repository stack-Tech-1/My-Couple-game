import { z } from "zod";

export const MAX_CHAT_LENGTH = 2000;
export const CHAT_PAGE = 50;

export const chatMessageSchema = z.object({
  id: z.uuid(),
  room_id: z.uuid(),
  sender_id: z.uuid(),
  body: z.string().min(1).max(MAX_CHAT_LENGTH),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** A message as the sender sees it before the database has confirmed it. */
export type LocalMessage = ChatMessage & { status?: "sending" | "failed" };

/** Merge incoming messages into a list: dedupe by id (the server copy wins), keep time order. */
export function mergeMessages(list: LocalMessage[], incoming: LocalMessage[]): LocalMessage[] {
  if (!incoming.length) return list;
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) {
    const prev = byId.get(m.id);
    // A confirmed copy replaces a pending one; a pending copy never overwrites a confirmed one.
    if (!prev || !m.status || prev.status) byId.set(m.id, m);
  }
  // Parse, don't compare strings: Postgres ("+00:00", microseconds) and the browser ("Z") format differently.
  return [...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || (a.id < b.id ? -1 : 1));
}

/** How many of the partner's messages arrived after I last read the chat. */
export function countUnread(list: ChatMessage[], me: string, readAt: string | null): number {
  const since = readAt ? Date.parse(readAt) : 0;
  return list.filter((m) => m.sender_id !== me && Date.parse(m.created_at) > since).length;
}
