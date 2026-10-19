import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

const PROTECTED = ["/room", "/onboarding", "/account", "/join"];
const APP_PREFIXES = [...PROTECTED, "/sign-in", "/auth"];

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isApp = APP_PREFIXES.some((p) => path.startsWith(p));
  const env = publicEnv();

  if (env) {
    const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && PROTECTED.some((p) => path.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
      response = NextResponse.redirect(url);
    }
  }

  if (isApp) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}