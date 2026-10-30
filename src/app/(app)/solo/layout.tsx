import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/design/Logo";
import { Icon } from "@/design/icons";
import { soloContext } from "@/lib/solo/context";

export const metadata: Metadata = { title: "Solo" };
export const dynamic = "force-dynamic";

/** Solo works with or without a room: its own light header, a way back to your room if you have one. */
export default async function SoloLayout({ children }: { children: ReactNode }) {
  const ctx = await soloContext();
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
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">{children}</main>
    </>
  );
}
