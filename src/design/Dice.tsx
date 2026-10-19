"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/** Rotation that brings face N to the front. Faces: 1 front, 6 back, 2 right, 5 left, 3 top, 4 bottom. */
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

const FACE_TRANSFORM = (size: number): Record<number, string> => ({
  1: `translateZ(${size / 2}px)`,
  6: `rotateY(180deg) translateZ(${size / 2}px)`,
  2: `rotateY(90deg) translateZ(${size / 2}px)`,
  5: `rotateY(-90deg) translateZ(${size / 2}px)`,
  3: `rotateX(90deg) translateZ(${size / 2}px)`,
  4: `rotateX(-90deg) translateZ(${size / 2}px)`,
});

/**
 * A real 3D die. Change `value` together with an incremented `rollId` and it tumbles,
 * extra full turns first, then settles with weight. `faces` replaces pips (Spicy Dice).
 */
export function Dice({
  value,
  rollId = 0,
  size = 72,
  faces,
  tone = "paper",
  label,
  className,
}: {
  value: number;
  rollId?: number;
  size?: number;
  faces?: ReactNode[];
  tone?: "paper" | "ember" | "wine";
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [spin, setSpin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const target = FACE_ROT[value] ?? FACE_ROT[1]!;
    // Each roll adds whole extra turns so the die visibly tumbles.
    const turns = reduce ? 0 : 2 + (rollId % 2);
    setSpin({ x: target.x + 360 * turns * (rollId > 0 ? 1 : 0), y: target.y + 360 * turns * (rollId > 0 ? 1 : 0) });
  }, [value, rollId, reduce]);

  const colors = {
    paper: { face: "#fbf7f1", edge: "#1c1416", pip: "#1c1416" },
    ember: { face: "#e8563a", edge: "#5b1a2b", pip: "#fff3ea" },
    wine: { face: "#5b1a2b", edge: "#2a0b14", pip: "#f3d9a6" },
  }[tone];

  const tf = FACE_TRANSFORM(size);

  return (
    <div
      className={cn("inline-block", className)}
      style={{ width: size, height: size, perspective: size * 6 }}
      role="img"
      aria-label={label ?? `Die showing ${value}`}
      aria-live="polite"
    >
      <motion.div
        key={rollId}
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={reduce || rollId === 0 ? false : { rotateX: spin.x - 200, rotateY: spin.y - 260, y: -size * 0.5 }}
        animate={{ rotateX: spin.x, rotateY: spin.y, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 11, mass: 1.1 }}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[18%]"
            style={{
              transform: tf[n],
              background: colors.face,
              border: `2px solid ${colors.edge}`,
              backfaceVisibility: "hidden",
              boxShadow: "inset 0 -6px 12px rgba(0,0,0,.12)",
            }}
          >
            {faces ? (
              <span className="px-1 text-center text-[0.7rem] font-bold leading-tight" style={{ color: colors.pip }}>
                {faces[n - 1]}
              </span>
            ) : (
              <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                {PIPS[n]!.map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r={9} fill={colors.pip} />
                ))}
              </svg>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
}