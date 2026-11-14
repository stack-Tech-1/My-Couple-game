"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";

/**
 * Healthy by design: after a long day of games (100 minutes or more on game screens today, on
 * this phone), coming back to the room once brings a gentle "see you tomorrow". Never a block,
 * never a guilt trip, at most once a day. Kept on the phone only.
 */
const LONG = 100 * 60_000;
const day = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Storage blocked: the nicety just doesn't happen.
  }
};

export function GentleStop({ partnerName }: { partnerName: string | null }) {
  const path = usePathname();
  const playing = /\/(play|watch)\//.test(path);
  const [show, setShow] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const last = useRef(Date.now());

  // Count time on game screens while the app is open.
  useEffect(() => {
    if (!playing) return;
    last.current = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        const key = `amah:playtime:${day()}`;
        write(key, String(Number(read(key) ?? 0) + Math.min(now - last.current, 60_000)));
      }
      last.current = now;
    };
    const id = setInterval(tick, 30_000);
    return () => {
      tick();
      clearInterval(id);
    };
  }, [playing]);

  // Back in the room after a long one: say goodnight, once.
  useEffect(() => {
    if (playing) return;
    const played = Number(read(`amah:playtime:${day()}`) ?? 0);
    if (played >= LONG && !read(`amah:gentle:${day()}`)) {
      write(`amah:gentle:${day()}`, "1");
      setMinutes(Math.round(played / 60_000));
      setShow(true);
    }
  }, [playing, path]);

  if (!show) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <div className="fixed inset-0 z-[94] flex items-end justify-center bg-[rgba(28,20,22,.45)] p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="gentle-h">
      <div className="glass w-full max-w-sm rounded-[26px] p-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2a1f4e] text-[#f6d26a]">
          <Icon name="moon" size={30} />
        </span>
        <h2 id="gentle-h" className="display mt-4 text-[1.6rem] leading-tight">
          Good game. That&apos;s a lot of games for one day.
        </h2>
        <p className="mt-2 text-[0.93rem] text-muted">
          {partnerName ? `You and ${partnerName} have` : "You've"} played for {h ? `${h} hour${h === 1 ? "" : "s"}${m ? ` and ${m} minutes` : ""}` : `${m} minutes`} today. Your streak is safe. See you tomorrow?
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={() => setShow(false)}>
            Goodnight
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setShow(false)}>
            One more round
          </Button>
        </div>
      </div>
    </div>
  );
}
