import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/design/Logo";
import { Icon } from "@/design/icons";
import { soloContext } from "@/lib/solo/context";
import { SoloLimitsProvider } from "@/components/solo/SoloLimits";
import { currentSpotlight } from "@/lib/engage/spotlight";
import { SpotlightTicker } from "@/components/spotlight/SpotlightTicker";
import { themeOn } from "@/lib/engage/themes";
import { lagosDate } from "@/lib/engage/rotation";

export const metadata: Metadata = { title: "Solo" };
export const dynamic = "force-dynamic";

/** Solo works with or without a room: its own light header, a way back to your room if you have one. */
export default async function SoloLayout({ children }: { children: ReactNode }) {
  const [ctx, winners] = await Promise.all([soloContext(), currentSpotlight()]);
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-8">
          <Link prefetch={false} href="/solo" aria-label="Solo home">
            <Logo />
          </Link>
          <span className="ml-auto" />
          {ctx.homeRoomId ? (
            <Link prefetch={false} href={`/room/${ctx.homeRoomId}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.88rem] font-semibold hover:bg-sunk">
              Your room <Icon name="arrowRight" size={14} />
            </Link>
          ) : (
            <Link prefetch={false} href="/onboarding?step=room" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.88rem] font-semibold hover:bg-sunk">
              Start a room <Icon name="arrowRight" size={14} />
            </Link>
          )}
        </div>
      </header>
      <SpotlightTicker winners={winners} theme={themeOn(lagosDate())} />
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
        <SoloLimitsProvider
          value={{
            // Plus belongs to a room, so someone with no room starts one first.
            plusHref: ctx.homeRoomId ? `/room/${ctx.homeRoomId}/settings/plus` : "/room/new",
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
