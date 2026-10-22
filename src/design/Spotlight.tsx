"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

/** One stop: the element marked data-tour="<target>" (or a plain centred card), and what to say. */
export type SpotlightStep = { target?: string; title: string; body: string | string[] };

const PAD = 8;

/**
 * A step-by-step overlay that dims the page and rings one element at a time. Back, Next/Done and
 * Skip; Escape skips. Steps whose target isn't on screen show as a centred card instead.
 */
export function Spotlight({ steps, onFinish, eyebrow }: { steps: SpotlightStep[]; onFinish: () => void; eyebrow?: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const target = step?.target;

  // Follow the target as the page scrolls or resizes (only re-measures when it actually moved).
  useLayoutEffect(() => {
    setRect(null);
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    let raf = 0;
    let last = "";
    const track = () => {
      const r = el.getBoundingClientRect();
      const sig = `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}`;
      if (sig !== last) {
        last = sig;
        setRect(r);
      }
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [target, i]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFinish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  if (!step) return null;

  const vw = typeof window === "undefined" ? 390 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const lines = Array.isArray(step.body) ? step.body : [step.body];
  const cardH = 150 + lines.length * 34;
  const below = !rect || rect.bottom + cardH < vh || rect.top < vh / 2;
  const cardTop = rect ? (below ? Math.min(rect.bottom + PAD + 10, vh - cardH - 12) : Math.max(rect.top - PAD - 10 - cardH, 12)) : Math.max(vh / 2 - cardH / 2, 12);
  const last = i === steps.length - 1;
  const width = Math.min(vw - 32, 380);
  const left = rect && vw > 412 ? Math.min(Math.max(rect.left, 16), vw - 396) : (vw - width) / 2;

  return createPortal(
    <div className="fixed inset-0 z-[95]" aria-live="polite">
      {/* Dims everything except the spot being explained; tapping outside does nothing. */}
      <div className="absolute inset-0" style={rect ? undefined : { background: "rgba(18,12,14,.58)" }} onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[16px] transition-[top,left,width,height] duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 3px var(--accent), 0 0 0 9999px rgba(18,12,14,.58)",
          }}
        />
      ) : null}
      <div
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute rounded-[18px] border-[1.5px] border-line-strong bg-bg p-5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)]"
        style={{ top: cardTop, left, width }}
      >
        <p className="eyebrow tabular text-muted">
          {eyebrow ? `${eyebrow} · ` : ""}
          {i + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="display mt-1.5 text-[1.5rem] leading-tight">{step.title}</h2>
        <div id="tour-body" className="mt-2 space-y-1.5 text-[0.92rem] leading-relaxed text-muted">
          {lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={onFinish}>Skip tour</Button>
          <span className="flex gap-2">
            {i > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setI(i - 1)}>Back</Button>
            ) : null}
            <Button ref={nextRef} size="sm" variant="accent" onClick={() => (last ? onFinish() : setI(i + 1))}>
              {last ? "Done" : "Next"}
            </Button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
