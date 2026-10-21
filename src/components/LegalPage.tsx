import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/design/Logo";

export function LegalPage({ title, updated, summary, children }: { title: string; updated: string; summary?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative z-[1] mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-8">
      <Link href="/" className="inline-block rounded-md">
        <Logo />
      </Link>
      <h1 className="display mt-16 text-[clamp(2.6rem,7vw,4rem)]">{title}</h1>
      <p className="mt-3 text-[0.9rem] text-muted">Last updated {updated}</p>
      {summary ? (
        <aside aria-label="In short" className="mt-8 rounded-[18px] border-[1.5px] border-line-strong bg-raised p-5 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          <p className="eyebrow text-muted">In short</p>
          <div className="mt-3 text-[0.95rem] leading-relaxed">{summary}</div>
        </aside>
      ) : null}
      <div className="mt-10 space-y-5 leading-relaxed [&_h2]:display [&_h2]:mt-12 [&_h2]:text-[1.7rem] [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:mt-2 [&_li]:text-muted [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_p]:text-muted [&_strong]:text-fg [&_table]:w-full [&_table]:text-[0.9rem] [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td]:text-muted [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </div>
  );
}
