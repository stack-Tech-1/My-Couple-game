"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AdireFill, type Motif } from "./adire";
import { Confetti } from "./Confetti";
import { Icon } from "./icons";
import { cn } from "@/lib/cn";

type Look = { motif: Motif; bg: string; ink: string };

/**
 * The end of a game: the board dims and a card springs up in the middle of the screen, with the
 * game's own print across its top and a medal (gold for a win). "See the board" puts it away so
 * the finished board can be looked at; a small button brings it back.
 */
export function ResultPop({
  look,
  win,
  labelledBy,
  children,
  top,
}: {
  look: Look;
  win: boolean;
  labelledBy: string;
  children: ReactNode;
  /** Something to sit on the print instead of the medal (a room game's players). */
  top?: ReactNode;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(true);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!open) return;
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, host]);
  if (!host) return null;

  return createPortal(
    open ? (
      <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
        {win ? <Confetti /> : null}
        <motion.div aria-hidden className="absolute inset-0 bg-[rgba(20,14,16,.58)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} />
        <motion.div
          ref={card}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          initial={{ opacity: 0, y: 40, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.15 }}
          className="cut relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[400px] flex-col overflow-hidden bg-raised text-fg shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] outline-none"
        >
          <div className="relative h-16 shrink-0">
            <AdireFill motif={look.motif} bg={look.bg} ink={look.ink} />
          </div>
          <div className="relative -mt-7 flex shrink-0 justify-center">
            {top ?? (
              <span
                className={cn("flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--bg-raised)]", win ? "bg-marigold text-[#1b1519]" : "bg-sunk text-muted")}
                aria-hidden
              >
                <Icon name={win ? "trophy" : "flag"} size={24} strokeWidth={2} />
              </span>
            )}
          </div>
          <div className="overflow-y-auto px-5 pb-4 pt-3 text-center">
            {children}
            <button type="button" onClick={() => setOpen(false)} className="mt-3 text-[0.88rem] font-semibold text-muted underline underline-offset-4 hover:text-fg">
              See the board
            </button>
          </div>
        </motion.div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cut-sm fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[85] inline-flex -translate-x-1/2 items-center gap-2 bg-fg px-5 py-3 font-bold text-bg shadow-[0_14px_30px_-12px_rgba(0,0,0,.6)]"
      >
        <Icon name={win ? "trophy" : "flag"} size={18} /> Show the result
      </button>
    ),
    host,
  );
}
