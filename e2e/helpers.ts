import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const admin: SupabaseClient = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function makeUser(tag: string) {
  const email = `twain-e2e-${tag}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email };
}

/** A one-time sign-in link the app's /auth/confirm route accepts (no inbox needed). */
export async function signInPath(email: string, next: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
}

/** A Supabase client signed in as this user, for direct RLS probing. */
export async function clientAs(email: string): Promise<SupabaseClient> {
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.verifyOtp({ type: "magiclink", token_hash: data.properties!.hashed_token });
  if (error) throw error;
  return c;
}

export async function cleanup(userIds: string[]) {
  const { data: rooms } = await admin.from("room_members").select("room_id").in("user_id", userIds);
  const roomIds = [...new Set((rooms ?? []).map((r) => r.room_id as string))];
  if (roomIds.length) await admin.from("rooms").delete().in("id", roomIds);
  await admin.from("rooms").delete().in("created_by", userIds);
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
}