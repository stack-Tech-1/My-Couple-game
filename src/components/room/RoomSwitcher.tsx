"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/design/icons";
import { LogoMark } from "@/design/Logo";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";

/**
 * The room name in the header. With two or more rooms it opens a list to jump between them;
 * with one, it's just a link home (couples who only have each other never see the extra menu).
 */
export function RoomSwitcher() {
  const { bundle } = useRoom();
  const { room, rooms } = bundle;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const title = (
    <>
      <LogoMark size={26} />
      <span className="display truncate text-[1.25rem]">{room.name}</span>
    </>
  );

  if (rooms.length < 2) {
    return (
      <Link href={`/room/${room.id}`} className="flex min-w-0 items-center gap-2.5 rounded-md" aria-label={`${room.name}: room home`}>
        {title}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${room.name}: switch room`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-2.5 rounded-md"
      >
        {title}
        <Icon name="chevronDown" size={18} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div role="menu" aria-label="Your rooms" className="absolute left-0 top-[calc(100%+10px)] z-50 w-72 overflow-hidden rounded-[16px] border-[1.5px] border-line-strong bg-bg shadow-[0_18px_40px_-20px_rgba(28,20,22,.45)]">
          <ul className="max-h-[60vh] overflow-y-auto py-1.5">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link
                  role="menuitem"
                  href={`/room/${r.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={r.id === room.id ? "page" : undefined}
                  className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-sunk", r.id === room.id && "bg-sunk")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line">
                    <Icon name={r.kind === "couple" ? "heart" : "user"} size={17} className={r.kind === "couple" ? "text-accent" : "text-muted"} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.name}</span>
                    <span className="block text-[0.78rem] text-muted">{r.kind === "couple" ? "Couple room" : `Friend room · ${r.members} ${r.members === 1 ? "person" : "people"}`}</span>
                  </span>
                  {r.id === room.id ? <Icon name="check" size={16} className="text-muted" /> : null}
                </Link>
              </li>
            ))}
          </ul>
          <Link role="menuitem" href="/room/new" onClick={() => setOpen(false)} className="flex items-center gap-3 border-t border-line px-4 py-3 font-semibold hover:bg-sunk">
            <Icon name="plus" size={18} /> New room, or join one
          </Link>
        </div>
      ) : null}
    </div>
  );
}
