"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";
import { useToasts, type ToastTone } from "./toast";

const toneIcon: Record<ToastTone, IconName> = { info: "chat", success: "check", error: "bolt", invite: "dice" };
const toneColor: Record<ToastTone, string> = {
  info: "var(--fg)",
  success: "var(--sage-ink)",
  error: "var(--accent-ink)",
  invite: "var(--accent)",
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  const reduce = useReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[16px] border border-line bg-bg px-4 py-3",
              "shadow-[0_1px_0_var(--line),0_18px_40px_-24px_rgba(28,20,22,.55)]",
            )}
          >
            <span className="mt-0.5" style={{ color: toneColor[t.tone] }}>
              <Icon name={t.icon ?? toneIcon[t.tone]} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[0.88rem] text-muted">{t.body}</p> : null}
            </div>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[0.85rem] font-bold text-on-accent"
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 rounded-full p-1 text-muted hover:text-fg"
            >
              <Icon name="close" size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}