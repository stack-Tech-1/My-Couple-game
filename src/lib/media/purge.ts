import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

const CHAT_BUCKET = "chat-media";
const FOLDERS = ["voice", "stickers"] as const;

async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const admin = supabaseAdmin();
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (!data?.length) break;
    out.push(...data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`));
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * Storage doesn't cascade with the database. After a room is deleted (or someone leaves it),
 * remove that room's chat files nothing points at any more: voice notes whose message is gone and
 * stickers no longer in the tray or in any message. Best effort; never throws.
 */
export async function purgeRoomMedia(roomId: string): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const { data: room } = await admin.from("rooms").select("id").eq("id", roomId).maybeSingle();
    const files = (await Promise.all(FOLDERS.map((f) => listAll(CHAT_BUCKET, `${roomId}/${f}`)))).flat();
    if (!files.length) return;

    let keep = new Set<string>();
    if (room) {
      const [{ data: msgs }, { data: stickers }] = await Promise.all([
        admin.from("chat_messages").select("media").eq("room_id", roomId).in("kind", ["voice", "sticker"]),
        admin.from("stickers").select("path").eq("room_id", roomId),
      ]);
      keep = new Set([
        ...(msgs ?? []).map((m) => (m.media as { path?: string } | null)?.path).filter((p): p is string => !!p),
        ...(stickers ?? []).map((s) => s.path as string),
      ]);
    }
    const doomed = files.filter((f) => !keep.has(f));
    for (let i = 0; i < doomed.length; i += 500) await admin.storage.from(CHAT_BUCKET).remove(doomed.slice(i, i + 500));
  } catch {
    // Orphaned files only cost storage; never fail the user's action over them.
  }
}
