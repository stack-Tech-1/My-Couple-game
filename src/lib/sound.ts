"use client";

import type { SoundName } from "@/games/_engine/types";

/**
 * Tiny synthesised UI sounds. No audio files: everything is a few oscillator
 * notes shaped with an envelope. Callers check the member's sound preference.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Note = { f: number; t: number; d: number; type?: OscillatorType; v?: number; slide?: number };

const SOUNDS: Record<SoundName, Note[]> = {
  tap: [{ f: 660, t: 0, d: 0.05, type: "triangle", v: 0.08 }],
  drop: [{ f: 320, t: 0, d: 0.12, type: "sine", v: 0.16, slide: 140 }],
  flip: [{ f: 900, t: 0, d: 0.04, type: "triangle", v: 0.06 }, { f: 600, t: 0.03, d: 0.05, type: "triangle", v: 0.05 }],
  roll: [0, 0.05, 0.1, 0.16, 0.24].map((t, i) => ({ f: 220 + i * 40, t, d: 0.04, type: "square" as const, v: 0.03 })),
  win: [523, 659, 784, 1047].map((f, i) => ({ f, t: i * 0.09, d: 0.22, type: "triangle" as const, v: 0.1 })),
  lose: [392, 330, 262].map((f, i) => ({ f, t: i * 0.12, d: 0.25, type: "sine" as const, v: 0.08 })),
  tick: [{ f: 1200, t: 0, d: 0.02, type: "square", v: 0.03 }],
  invite: [{ f: 784, t: 0, d: 0.12, type: "sine", v: 0.1 }, { f: 1047, t: 0.1, d: 0.18, type: "sine", v: 0.1 }],
};

export function playSound(name: SoundName): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const n of SOUNDS[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.f, now + n.t);
    if (n.slide) osc.frequency.exponentialRampToValueAtTime(n.slide, now + n.t + n.d);
    gain.gain.setValueAtTime(0, now + n.t);
    gain.gain.linearRampToValueAtTime(n.v ?? 0.08, now + n.t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.02);
  }
}