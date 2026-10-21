"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/design/icons";
import { toast, useToasts } from "@/design/toast";
import { cn } from "@/lib/cn";
import { sendNudge } from "@/lib/push/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";

const COOLDOWN_MS = 8_000;

/** A shower of hearts rising from the bottom of the screen. Decorative. */
function Hearts({ show }: { show: number }) {
  const [burst, setBurst] = useState<number | null>(null);
  useEffect(() => {
    if (!show) return;
    setBurst(show);
    const t = setTimeout(() => setBurst(null), 2600);
    return () => clearTimeout(t);
  }, [show]);
  return (
    <AnimatePresence>
      {burst ? (
        <div key={burst} aria-hidden className="pointer-events-none fixed inset-0 z-[96] overflow-hidden">
          {Array.from({ length: 14 }, (_, i) => {
            const x = (i * 37) % 100;
            return (
              <motion.span
                key={i}
                className="absolute bottom-0 text-accent"
                style={{ left: `${x}%` }}
                initial={{ y: 40, opacity: 0, scale: 0.6 }}
                animate={{ y: -(window.innerHeight * (0.55 + ((i * 13) % 40) / 100)), opacity: [0, 1, 1, 0], scale: 1 + ((i * 7) % 5) / 10, rotate: ((i * 23) % 40) - 20 }}
                transition={{ duration: 2.2, delay: (i % 7) * 0.08, ease: "easeOut" }}
              >
                <Icon name="heart" size={22 + ((i * 11) % 18)} strokeWidth={0} className="fill-current" />
              </motion.span>
            );
          })}
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/** "Thinking of you": send a heart. Lives in the room header. */
export function NudgeButton() {
  const { bundle, send, on } = useRoom();
  const partner = bundle.partner?.profile;
  const [cooling, setCooling] = useState(false);
  const [sent, setSent] = useState(0);
  const [got, setGot] = useState(0);
  const last = useRef(0);

  const nudge = useCallback(async () => {
    if (!partner || Date.now() - last.current < COOLDOWN_MS) return;
    last.current = Date.now();
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
    setSent((n) => n + 1);
    send("nudge", {});
    const res = await sendNudge();
    if (!res.ok) toast.info(res.error);
  }, [partner, send]);

  useEffect(
    () =>
      on("nudge", () => {
        setGot((n) => n + 1);
        const store = useToasts.getState();
        store.toasts.filter((t) => t.title.endsWith("is thinking of you")).forEach((t) => store.dismiss(t.id));
        store.push({ tone: "invite", icon: "heart", duration: 6000, title: `${partner?.display_name ?? "Your partner"} is thinking of you`, action: { label: "Send one back", onClick: () => void nudge() } });
      }),
    [on, partner?.display_name, nudge],
  );

  if (!partner) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => void nudge()}
        disabled={cooling}
        aria-label={`Send ${partner.display_name} a heart: thinking of you`}
        className={cn("relative flex h-10 w-10 items-center justify-center rounded-full text-accent-ink transition-transform hover:bg-sunk active:scale-90", cooling && "opacity-60")}
      >
        <motion.span key={sent} initial={sent ? { scale: 1.6 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 12 }}>
          <Icon name="heart" size={20} />
        </motion.span>
      </button>
      <Hearts show={got} />
    </>
  );
}
