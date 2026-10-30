import "server-only";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * The admin activity log: who did what, to whom, and when. Never throws: a log hiccup must never
 * undo or block the action itself.
 */
export async function audit(admin: Pick<User, "id" | "email">, action: string, target?: string | null, detail: Record<string, unknown> = {}) {
  try {
    await supabaseAdmin()
      .from("admin_audit")
      .insert({ admin_id: admin.id, admin_email: admin.email ?? null, action, target: target ?? null, detail });
  } catch {
    // Logged nowhere is better than a failed refund.
  }
}

/** Health checks: record that a job or webhook ran fine, or failed. Never throws. */
export async function health(key: string, ok: boolean, info?: string) {
  try {
    const now = new Date().toISOString();
    const admin = supabaseAdmin();
    const { data } = await admin.from("app_health").select("key").eq("key", key).maybeSingle();
    const patch = ok ? { last_ok_at: now, detail: info?.slice(0, 500) ?? null } : { last_error_at: now, last_error: (info ?? "failed").slice(0, 500) };
    if (data) await admin.from("app_health").update({ ...patch, updated_at: now }).eq("key", key);
    else await admin.from("app_health").insert({ key, ...patch, updated_at: now });
  } catch {
    // Health checks are best effort.
  }
}
