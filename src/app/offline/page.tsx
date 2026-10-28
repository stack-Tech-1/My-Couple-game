import type { Metadata } from "next";
import { Logo } from "@/design/Logo";
import { PatternLayer } from "@/components/landing/PatternLayer";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="relative isolate z-[1] mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5 sm:px-8 max-md:text-[#f6efe6]">
      {/* Phones: a night-sky indigo with dundun stars, while the network naps. */}
      <PatternLayer motif="dundun" bg="#18203f" ink="#222c55" glow="radial-gradient(60% 40% at 80% 20%, rgba(242,183,5,.18), transparent 70%)" />
      <Logo />
      <div className="flex flex-1 flex-col justify-center">
        <p className="eyebrow text-accent-ink max-md:text-[#ffb59f]">No connection</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,9vw,4rem)]">The Wi-Fi has wandered off.</h1>
        <p className="mt-4 text-muted max-md:text-[#f6efe6]/85">Your games and scores are safe on our side. As soon as you&apos;re back online, pick up exactly where you left off.</p>
        {/* A full reload is the point here: client-side navigation would just hit the same dead network. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/room" className="mt-8 inline-flex h-12 w-fit items-center rounded-full bg-fg px-6 font-semibold text-bg max-md:bg-accent max-md:text-on-accent">
          Try again
        </a>
      </div>
    </div>
  );
}