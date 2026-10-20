import type { Metadata } from "next";
import { Logo } from "@/design/Logo";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="relative z-[1] mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5 sm:px-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center">
        <p className="eyebrow text-accent-ink">No connection</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,9vw,4rem)]">The Wi-Fi has wandered off.</h1>
        <p className="mt-4 text-muted">Your games and scores are safe on our side. As soon as you&apos;re back online, pick up exactly where you left off.</p>
        {/* A full reload is the point here: client-side navigation would just hit the same dead network. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/room" className="mt-8 inline-flex h-12 w-fit items-center rounded-full bg-fg px-6 font-semibold text-bg">
          Try again
        </a>
      </div>
    </div>
  );
}