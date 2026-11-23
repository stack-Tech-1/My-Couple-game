"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { updateMyPrefs } from "@/lib/room/actions";

/**
 * The buttons on Solo's bar: game sound on or off in one tap, light or dark, and settings. Solo
 * works without a room, so these are the only settings some players ever see.
 */
export function SoloBar({ soundOn, homeRoomId }: { soundOn: boolean; homeRoomId: string | null }) {
  const router = useRouter();
  const [sound, setSound] = useState(soundOn);
  const [, start] = useTransition();

  const flipSound = () => {
    const next = !sound;
    setSound(next);
    start(async () => {
      const r = await updateMyPrefs({ sound_enabled: next });
      if (!r.ok) {
        setSound(!next);
        return void toast.error(r.error);
      }
      // The games read the setting when they open: refresh so the next one hears it.
      router.refresh();
    });
  };

  return (
    <div className="ml-auto flex items-center gap-0.5">
      <button
        type="button"
        onClick={flipSound}
        aria-pressed={sound}
        aria-label={sound ? "Game sound on. Turn it off" : "Game sound off. Turn it on"}
        title={sound ? "Sound on" : "Sound off"}
        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunk"
      >
        <Icon name={sound ? "soundOn" : "soundOff"} size={20} className={sound ? undefined : "text-muted"} />
      </button>
      <ThemeToggle />
      <Link prefetch={false} href="/solo/settings" aria-label="Settings" title="Settings" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunk">
        <Icon name="settings" size={20} />
      </Link>
      {homeRoomId ? (
        <Link prefetch={false} href={`/room/${homeRoomId}`} className="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[0.88rem] font-semibold hover:bg-sunk">
          Your room <Icon name="arrowRight" size={14} />
        </Link>
      ) : (
        <Link prefetch={false} href="/onboarding?step=room" className="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[0.88rem] font-semibold hover:bg-sunk">
          Start a room <Icon name="arrowRight" size={14} />
        </Link>
      )}
    </div>
  );
}
