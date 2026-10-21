"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { currentSubscription, enablePush, pushSupport } from "@/lib/push/client";

const KEY = "amah:notify-dismissed";
const SNOOZE_DAYS = 10;

/**
 * Invites people to turn on notifications, once the browser can actually show them (on iPhone
 * that means after Amah is on the Home Screen, which the install card handles). Stays out of the
 * way while the install card is offering an install.
 */
export function NotifyPrompt({ publicKey }: { publicKey: string | null }) {
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!publicKey || pushSupport() !== "ok" || Notification.permission !== "default") return;
    if ((window as Window & { __amahInstall?: Event }).__amahInstall) return;
    try {
      if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) < SNOOZE_DAYS * 86_400_000) return;
    } catch {
      // storage blocked: just ask
    }
    void currentSubscription().then((s) => setShow(!s));
  }, [publicKey]);

  function later() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // storage blocked: it'll ask again next visit
    }
    setShow(false);
  }

  function enable() {
    start(async () => {
      const res = await enablePush(publicKey!);
      setShow(false);
      if (res.ok) toast.success("Notifications are on.", "Change what you get any time in Settings.");
      else if (res.reason === "denied") later();
    });
  }

  return (
    <AnimatePresence>
      {show ? (
        <motion.section
          aria-label="Turn on notifications"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="mt-6 flex flex-wrap items-center gap-4 rounded-[18px] border-[1.5px] border-line-strong bg-raised p-4 sm:flex-nowrap"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-fg text-bg">
            <Icon name="bolt" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Know when it&apos;s your turn</p>
            <p className="text-[0.88rem] text-muted">Game invites, your move, new messages and nudges, only when you&apos;re not already here.</p>
          </div>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button variant="ghost" size="sm" onClick={later}>
              Not now
            </Button>
            <Button size="sm" onClick={enable} loading={pending}>
              Turn on
            </Button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
