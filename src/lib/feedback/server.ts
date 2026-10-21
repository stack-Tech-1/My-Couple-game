import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { FeedbackReply, FeedbackThread } from "./types";

/** The signed-in person's feedback threads, newest first, with replies. RLS limits it to theirs. */
export async function getMyFeedback(): Promise<{ threads: FeedbackThread[]; unread: number }> {
  const supabase = await supabaseServer();
  const { data: rows } = await supabase.from("feedback").select("id, kind, body, status, created_at, updated_at").order("created_at", { ascending: false }).limit(30);
  const threads = (rows ?? []) as Omit<FeedbackThread, "replies">[];
  if (!threads.length) return { threads: [], unread: 0 };
  const [{ data: replies }, unread] = await Promise.all([
    supabase.from("feedback_replies").select("id, feedback_id, from_team, body, created_at").in("feedback_id", threads.map((t) => t.id)).order("created_at"),
    unreadReplies(),
  ]);
  const byThread = new Map<string, FeedbackReply[]>();
  for (const r of (replies ?? []) as (FeedbackReply & { feedback_id: string })[]) byThread.set(r.feedback_id, [...(byThread.get(r.feedback_id) ?? []), r]);
  return { threads: threads.map((t) => ({ ...t, replies: byThread.get(t.id) ?? [] })), unread };
}

/** Team replies the person hasn't seen yet, for the dot on the settings icon. */
export async function unreadReplies(): Promise<number> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;
  const { data: me } = await supabase.from("profiles").select("feedback_seen_at").eq("id", auth.user.id).maybeSingle();
  let q = supabase.from("feedback_replies").select("id", { count: "exact", head: true }).eq("from_team", true);
  if (me?.feedback_seen_at) q = q.gt("created_at", me.feedback_seen_at as string);
  const { count } = await q;
  return count ?? 0;
}
