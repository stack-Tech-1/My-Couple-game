"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/design/Logo";
import { Icon } from "@/design/icons";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/stickers", label: "Stickers" },
  { href: "/admin/announcements", label: "Announcements" },
];

export function AdminNav({ inbox = 0 }: { inbox?: number }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-8">
        <Link href="/admin" className="flex items-center gap-2.5 rounded-md">
          <LogoMark size={26} />
          <span className="display text-[1.25rem]">Amah</span>
          <span className="rounded-full bg-fg px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-bg">Admin</span>
        </Link>
        <Link href="/room" className="ml-auto flex items-center gap-1.5 text-[0.85rem] font-semibold text-muted hover:text-fg">
          My room <Icon name="arrowRight" size={14} />
        </Link>
      </div>
      <nav aria-label="Admin sections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 sm:px-7">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold", active ? "bg-fg text-bg" : "text-muted hover:bg-sunk hover:text-fg")}
            >
              {l.label}
              {l.href === "/admin/inbox" && inbox ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[0.72rem] text-on-accent">{inbox}</span> : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
