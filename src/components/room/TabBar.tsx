"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { Logo } from "@/design/Logo";
import { AdireFill } from "@/design/adire";
import { INDIGO_LOOK } from "@/games/look";
import { cn } from "@/lib/cn";

type Where = "home" | "games" | "us" | "place" | null;

function useNav() {
  const { bundle } = useRoom();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setUnread(Number((e as CustomEvent<number>).detail) || 0);
    window.addEventListener("amah:chat-unread", on);
    return () => window.removeEventListener("amah:chat-unread", on);
  }, []);
  const base = `/room/${bundle.room.id}`;
  const hidden = /\/(play|watch|after-dark)(\/|$)/.test(pathname);
  const at: Where =
    pathname === base ? "home" : pathname.startsWith(`${base}/games`) ? "games" : pathname.startsWith(`${base}/you`) ? "us" : pathname.startsWith(`${base}/place`) ? "place" : null;
  return { bundle, base, hidden, at, unread, friendsRoom: bundle.room.kind === "friends" };
}

const openChat = () => window.dispatchEvent(new Event("amah:open-chat"));

const ICONS = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  games: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  us: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  solo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.5l5 3.5-5 3.5z" />
    </>
  ),
  place: (
    <>
      <path d="M4 20V9l8-5 8 5v11z" />
      <rect x="9.5" y="12" width="5" height="8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
} as const;

/**
 * Phones: a floating tab bar in the room's indigo, like a native app. It steps aside during games
 * (and in After Dark), so the board gets the whole screen. Computers get the side rail instead.
 */
export function TabBar() {
  const { base, hidden, at, unread, friendsRoom } = useNav();
  if (hidden) return null;

  return (
    <>
      <nav aria-label="Main" className="cut fixed inset-x-3.5 bottom-[max(0.9rem,env(safe-area-inset-bottom))] z-40 flex h-[66px] items-center justify-around bg-indigo text-[#c9c6df] shadow-[0_16px_34px_-18px_rgba(18,22,50,.8)] sm:hidden">
        <Tab href={base} label="Home" on={at === "home"} icon={ICONS.home} />
        <Tab href={`${base}/games`} label="Games" on={at === "games"} icon={ICONS.games} />
        <button type="button" onClick={openChat} aria-label={unread ? `Chat, ${unread} unread` : "Chat"} className="relative flex w-16 flex-col items-center gap-0.5 text-[0.7rem] font-bold">
          <Glyph on={false}>{ICONS.chat}</Glyph>
          Chat
          {unread ? <span className="absolute -top-1 right-3 rounded-full bg-marigold px-1.5 text-[0.62rem] font-extrabold text-[#1b1519]">{unread > 9 ? "9+" : unread}</span> : null}
        </button>
        <Tab href={`${base}/you`} label={friendsRoom ? "You" : "Us"} on={at === "us"} icon={ICONS.us} />
      </nav>
      <SideRail />
    </>
  );
}

function Tab({ href, label, on, icon }: { href: string; label: string; on: boolean; icon: ReactNode }) {
  return (
    <Link prefetch={false} href={href} aria-current={on ? "page" : undefined} className={cn("flex w-16 flex-col items-center gap-0.5 text-[0.7rem] font-bold", on && "text-marigold")}>
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

/**
 * Computers: the menu lives in an indigo rail down the left, with a strip of the room's cloth at
 * its foot. The page beside it moves over (see `.rail-pad` in globals.css).
 */
function SideRail() {
  const { base, at, unread, friendsRoom } = useNav();
  const item = "flex items-center gap-3 py-2.5 pl-6 pr-4 text-[0.95rem] font-bold";
  const on = "mr-4 rounded-r-[22px] bg-bg text-fg";
  const off = "text-[#d6d3ea] hover:text-white";
  const links: { href: string; label: string; key: keyof typeof ICONS; here: boolean }[] = [
    { href: base, label: "Home", key: "home", here: at === "home" },
    { href: `${base}/games`, label: "Games", key: "games", here: at === "games" },
    { href: "/solo", label: "On your own", key: "solo", here: false },
    { href: `${base}/you`, label: friendsRoom ? "You" : "Us", key: "us", here: at === "us" },
    ...(friendsRoom ? [] : [{ href: `${base}/place`, label: "Our place", key: "place" as const, here: at === "place" }]),
  ];
  return (
    <nav id="amah-rail" aria-label="Main" className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col overflow-hidden bg-indigo lg:flex">
      <Link prefetch={false} href={base} className="px-6 pb-6 pt-6 text-white">
        <Logo />
      </Link>
      <ul className="flex flex-col gap-1">
        {links.map((l) => (
          <li key={l.key}>
            <Link prefetch={false} href={l.href} aria-current={l.here ? "page" : undefined} className={cn(item, l.here ? on : off)}>
              <Glyph on={l.here}>{ICONS[l.key]}</Glyph>
              {l.label}
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={openChat} className={cn(item, off, "w-full")} aria-label={unread ? `Chat, ${unread} unread` : "Chat"}>
            <Glyph on={false}>{ICONS.chat}</Glyph>
            Chat
            {unread ? <span className="rounded-full bg-marigold px-1.5 text-[0.7rem] font-extrabold text-[#1b1519]">{unread > 9 ? "9+" : unread}</span> : null}
          </button>
        </li>
      </ul>
      <div className="relative mt-auto h-44 shrink-0">
        <AdireFill motif="agbole" bg={INDIGO_LOOK.bg} ink={INDIGO_LOOK.ink} />
      </div>
    </nav>
  );
}
