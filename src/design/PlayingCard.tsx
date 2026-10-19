"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A two-sided card that flips with weight. Used by Whot, Memory Match,
 * Truth or Dare and anything else that deals.
 */
export function PlayingCard({
  faceUp,
  front,
  back,
  width = 88,
  ratio = 1.42,
  onClick,
  label,
  selected,
  disabled,
  className,
}: {
  faceUp: boolean;
  front: ReactNode;
  back?: ReactNode;
  width?: number;
  ratio?: number;
  onClick?: () => void;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const Tag = onClick ? motion.button : motion.div;

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={label}
      aria-pressed={onClick && selected !== undefined ? selected : undefined}
      className={cn("relative shrink-0 [perspective:900px] disabled:cursor-not-allowed", className)}
      style={{ width, height: width * ratio }}
      animate={{ y: selected ? -14 : 0 }}
      whileHover={onClick && !disabled && !reduce ? { y: selected ? -16 : -6 } : undefined}
      whileTap={onClick && !disabled && !reduce ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 18, mass: 1.2 }}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-[10px] border-[1.5px] border-ink bg-[#fbf7f1] text-ink shadow-[0_2px_0_rgba(28,20,22,.35)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          {front}
        </div>
        <div
          className="absolute inset-0 overflow-hidden rounded-[10px] border-[1.5px] border-ink shadow-[0_2px_0_rgba(28,20,22,.35)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {back ?? <CardBack />}
        </div>
      </motion.div>
    </Tag>
  );
}

/** Default back: wine field, brass lattice, a small knot in the middle. */
export function CardBack() {
  return (
    <svg viewBox="0 0 88 125" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="88" height="125" fill="#5b1a2b" />
      <defs>
        <pattern id="lattice" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 5.5h11M5.5 0v11" stroke="#b8893b" strokeOpacity=".35" strokeWidth=".8" />
        </pattern>
      </defs>
      <rect x="6" y="6" width="76" height="113" rx="5" fill="url(#lattice)" stroke="#b8893b" strokeWidth="1.2" />
      <g transform="translate(44 62.5)" fill="none" stroke="#e9c98a" strokeWidth="1.6" strokeLinecap="round">
        <path d="M-10-6c8 0 8 12 16 12M-10 6c8 0 8-12 16-12M-10-6a6 6 0 0 0 0 12M6-6a6 6 0 0 1 0 12" />
      </g>
    </svg>
  );
}