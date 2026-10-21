import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TERMS_VERSION } from "../src/lib/legal";

function readEnv(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

/**
 * Tests run against the TEST project only (.env.test.local). They create and delete users,
 * flip global switches and post announcements, so pointing them at the live project is refused.
 */
export function loadEnv(): Record<string, string> {
  const env = readEnv(".env.test.local");
  if (!env.NEXT_PUBLIC_SUPABASE_URL) throw new Error(".env.test.local is missing: e2e tests only run against the test project.");
  const live = readEnv(".env.local").NEXT_PUBLIC_SUPABASE_URL;
  if (live && live === env.NEXT_PUBLIC_SUPABASE_URL) throw new Error(".env.test.local points at the LIVE project. Refusing to run.");
  return env;
}

const env = loadEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const admin: SupabaseClient = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function makeUser(tag: string) {
  const email = `amah-e2e-${tag}-${Date.now()}@example.com`;
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

/** Two onboarded users already paired in a room, without clicking through onboarding. */
export async function pairedRoom(names: [string, string]) {
  const a = await makeUser(names[0].toLowerCase());
  const b = await makeUser(names[1].toLowerCase());
  const ca = await clientAs(a.email);
  const cb = await clientAs(b.email);
  const now = new Date().toISOString();
  const agreed = { adult_confirmed_at: now, terms_version: TERMS_VERSION, terms_accepted_at: now };
  // tour: "done" keeps the welcome tour out of the way; its own test turns it back on.
  await ca.from("profiles").update({ display_name: names[0], avatar_key: "fig", avatar_hue: 12, onboarded_at: now, tour: "done", ...agreed }).eq("id", a.id);
  await cb.from("profiles").update({ display_name: names[1], avatar_key: "moon", avatar_hue: 200, onboarded_at: now, tour: "done", ...agreed }).eq("id", b.id);
  const { data: room, error } = await ca.rpc("create_room", { room_name: "E2E" });
  if (error) throw error;
  const { error: joinErr } = await cb.rpc("join_room", { code: room.invite_code });
  if (joinErr) throw joinErr;
  return { a, b, roomId: room.id as string };
}

/** An onboarded user (terms accepted) with a signed-in client. */
export async function onboardedUser(name: string, avatar = "fig") {
  const u = await makeUser(name.toLowerCase());
  const c = await clientAs(u.email);
  const now = new Date().toISOString();
  await c.from("profiles").update({ display_name: name, avatar_key: avatar, avatar_hue: 40, onboarded_at: now, tour: "done", adult_confirmed_at: now, terms_version: TERMS_VERSION, terms_accepted_at: now }).eq("id", u.id);
  return { ...u, c };
}

/** A friend room owned by the first user, with the others joined by invite code. */
export async function friendRoom(owner: { c: SupabaseClient }, others: { c: SupabaseClient }[], name = "The Crew") {
  const { data: room, error } = await owner.c.rpc("create_room", { room_name: name, p_kind: "friends" });
  if (error) throw error;
  for (const o of others) {
    const { error: e } = await o.c.rpc("join_room", { code: room.invite_code });
    if (e) throw e;
  }
  return room as { id: string; invite_code: string };
}

export async function cleanup(userIds: string[]) {
  const { data: rooms } = await admin.from("room_members").select("room_id").in("user_id", userIds);
  const roomIds = [...new Set((rooms ?? []).map((r) => r.room_id as string))];
  // Chat files aren't removed by the database cascade.
  for (const rid of roomIds) {
    for (const folder of ["voice", "stickers"]) {
      const { data: files } = await admin.storage.from("chat-media").list(`${rid}/${folder}`);
      if (files?.length) await admin.storage.from("chat-media").remove(files.map((f) => `${rid}/${folder}/${f.name}`));
    }
  }
  if (roomIds.length) await admin.from("rooms").delete().in("id", roomIds);
  await admin.from("rooms").delete().in("created_by", userIds);
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
}