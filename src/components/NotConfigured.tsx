import { Logo } from "@/design/Logo";

/** Shown when Supabase env vars are missing, so a fresh clone explains itself instead of crashing. */
export function NotConfigured() {
  return (
    <div className="relative z-[1] mx-auto max-w-xl px-4 py-16 sm:px-8">
      {/* Plain <a>, not next/link: this renders inside the (app) layout, and pulling Link into that
          layout's bundle makes Next attribute Link to it, dragging the app's client chunks onto every
          page that links anywhere (including the landing page). */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/"><Logo /></a>
      <h1 className="display mt-14 text-[3rem]">The room isn&apos;t wired up yet.</h1>
      <p className="mt-4 leading-relaxed text-muted">
        This copy of the app doesn&apos;t have its Supabase keys. Copy <code className="font-mono">.env.example</code> to{" "}
        <code className="font-mono">.env.local</code>, fill in your project URL and keys, run the migrations in{" "}
        <code className="font-mono">supabase/migrations</code>, then restart the dev server. The README walks through it.
      </p>
    </div>
  );
}