import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/design/Logo";
import { SoloBar } from "@/components/solo/SoloBar";
import { soloContext } from "@/lib/solo/context";
import { SoloLimitsProvider } from "@/components/solo/SoloLimits";

export const metadata: Metadata = { title: "Solo" };
export const dynamic = "force-dynamic";

/** Solo works with or without a room: its own light header, a way back to your room if you have one. */
export default async function SoloLayout({ children }: { children: ReactNode }) {
  const ctx = await soloContext();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-3 sm:px-8">
          <Link prefetch={false} href="/solo" aria-label="Solo home">
            <Logo />
          </Link>
          <SoloBar soundOn={ctx.soundOn} homeRoomId={ctx.homeRoomId} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
        <SoloLimitsProvider
          value={{
            // Plus belongs to a room, so someone with no room starts one first.
            // Plus belongs to the person: with a room it's managed there, without one in Solo.
            plusHref: ctx.homeRoomId ? `/room/${ctx.homeRoomId}/settings/plus` : "/solo/plus",
            me: { name: ctx.profile.display_name, motif: ctx.profile.avatar_key ?? "fig", hue: ctx.profile.avatar_hue ?? 12 },
            openNow: [
              { label: "Ọ̀rọ̀ of the Day", hint: "Today's word. Never limited.", href: "/solo/oro" },
              { label: "Other Solo games", hint: "Each game has its own free plays", href: "/solo" },
              ...(ctx.homeRoomId ? [{ label: "Your room", hint: "Chat, today's question and love notes", href: `/room/${ctx.homeRoomId}` }] : []),
            ],
          }}
        >
          {children}
        </SoloLimitsProvider>
      </main>
    </>
  );
}
