import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/design/Logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="relative z-[1] mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-8">
      <Link href="/" className="inline-block rounded-md">
        <Logo />
      </Link>
      <h1 className="display mt-16 text-[clamp(2.6rem,7vw,4rem)]">{title}</h1>
      <p className="mt-3 text-[0.9rem] text-muted">Last updated {updated}</p>
      <div className="mt-10 space-y-5 leading-relaxed [&_h2]:display [&_h2]:mt-12 [&_h2]:text-[1.7rem] [&_p]:text-muted">
        {children}
      </div>
    </div>
  );
}

/** Marks text the owner still has to write. Deliberately visible. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[10px] border border-dashed border-brass bg-raised p-4 text-[0.92rem] !text-brass-ink">
      <b>To be written:</b> {children}
    </p>
  );
}