import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requirePublicEnv, serviceRoleKey } from "@/lib/env";

/** Per-request client acting as the signed-in user. RLS applies. */
export async function supabaseServer(): Promise<SupabaseClient> {
  const env = requirePublicEnv();
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS. Only for trusted server code paths. */
export function supabaseAdmin(): SupabaseClient {
  const env = requirePublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}