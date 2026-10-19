"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

const COLORS = ["#e8563a", "#b8893b", "#5b1a2b", "#8a9a7b", "#f6efe6", "#1c1416"];

/** Paper-scrap confetti. Fires once on mount. Reserved for real wins. */
export function Confetti({ pieces = 140 }: { pieces?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const canvas = ref.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const W = (canvas.width = window.innerWidth * dpr);
    const H = (canvas.height = window.innerHeight * dpr);

    const bits = Array.from({ length: pieces }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 22 * dpr,
      vy: (-Math.random() * 22 - 8) * dpr,
      w: (6 + Math.random() * 8) * dpr,
      h: (3 + Math.random() * 5) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    }));

    let raf = 0;
    const start = performance.now();
    const frame = (t: number) => {
      c.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.vy += 0.55 * dpr;
        b.vx *= 0.985;
        b.vy *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.r);
        c.scale(1, Math.cos(b.r * 3));
        c.fillStyle = b.color;
        c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        c.restore();
      }
      if (t - start < 4200) raf = requestAnimationFrame(frame);
      else c.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pieces, reduce]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[95] h-full w-full" />;
}