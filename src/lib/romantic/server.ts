import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { BucketItem, Memory, Note, NotesState, SealedNote } from "./types";

export async function getNotes(roomId: string, me: string): Promise<NotesState> {
  const supabase = await supabaseServer();
  const [{ data: rows }, { data: sealed }] = await Promise.all([
    supabase.from("love_notes").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("sealed_notes"),
  ]);
  const all = (rows ?? []) as Note[];
  return {
    inbox: all.filter((n) => n.recipient_id === me),
    sent: all.filter((n) => n.author_id === me),
    sealed: (sealed ?? []) as SealedNote[],
  };
}

export async function getMemories(roomId: string): Promise<Memory[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("memories").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(60);
  const rows = (data ?? []) as Omit<Memory, "url">[];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage.from("memories").createSignedUrls(rows.map((r) => r.path), 60 * 60);
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, url: urls.get(r.path) ?? null }));
}

export async function getBucket(roomId: string): Promise<BucketItem[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("bucket_items").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as BucketItem[];
}