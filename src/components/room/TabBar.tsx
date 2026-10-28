"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { cn } from "@/lib/cn";

/**
 * Phones: a floating glass tab bar, like a native app. It steps aside during games (and in After
 * Dark), so the board gets the whole screen.
 */
export function TabBar() {
  const { bundle } = useRoom();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setUnread(Number((e as CustomEvent<number>).detail) || 0);
    window.addEventListener("amah:chat-unread", on);
    return () => window.removeEventListener("amah:chat-unread", on);
  }, []);

  const base = `/room/${bundle.room.id}`;
  if (/\/(play|watch|after-dark)(\/|$)/.test(pathname)) return null;
  const friendsRoom = bundle.room.kind === "friends";
  const at = pathname === base ? "home" : pathname.startsWith(`${base}/games`) ? "games" : pathname.startsWith(`${base}/you`) ? "us" : null;

  return (
    <nav aria-label="Main" className="glass fixed inset-x-3.5 bottom-[max(0.9rem,env(safe-area-inset-bottom))] z-40 flex h-[68px] items-center justify-around rounded-[26px] sm:hidden">
      <Tab href={base} label="Home" on={at === "home"} icon={<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />} />
      <Tab
        href={`${base}/games`}
        label="Games"
        on={at === "games"}
        icon={
          <>
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="8" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="2" />
          </>
        }
      />
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("amah:open-chat"))}
        aria-label={unread ? `Chat, ${unread} unread` : "Chat"}
        className="relative flex w-16 flex-col items-center gap-0.5 text-[0.7rem] font-bold text-muted"
      >
        <Glyph on={false}>
          <path d="M4 5h16v11H9l-5 4z" />
        </Glyph>
        Chat
        {unread ? <span className="absolute -top-1 right-3 rounded-full bg-accent px-1.5 text-[0.62rem] font-extrabold text-on-accent">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      <Tab
        href={`${base}/you`}
        label={friendsRoom ? "You" : "Us"}
        on={at === "us"}
        icon={
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </>
        }
      />
    </nav>
  );
}

function Tab({ href, label, on, icon }: { href: string; label: string; on: boolean; icon: ReactNode }) {
  return (
    <Link prefetch={false} href={href} aria-current={on ? "page" : undefined} className={cn("flex w-16 flex-col items-center gap-0.5 text-[0.7rem] font-bold", on ? "text-fg" : "text-muted")}>
      <Glyph on={on}>{icon}</Glyph>
      {label}
    </Link>
  );
}

function Glyph({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={23} height={23} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={on ? 0 : 2} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </svg>
  );
}
