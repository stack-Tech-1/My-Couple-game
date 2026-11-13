"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PEGS, NOZZLES, RING_COLORS, RING_R, RINGS, STEP, TANK_H, TANK_W, TIME_LIMIT, hung, newPump, pump, pumpScore, stepPump, upright, type PumpState, type Ring } from "@/lib/solo/games/pump";
import type { SoloApi } from "../SoloShell";

/** Little things that only exist on screen: bubbles and the water bursts. */
type Bubble = { x: number; y: number; r: number; vy: number; wob: number; life: number };
type Jet = { side: 0 | 1; t: number };

// The toy is drawn in a 358 × 560 box; the water window sits at (22, 42), 314 × 400.
const BOX_W = 358;
const BOX_H = 560;
const WIN_X = 22;
const WIN_Y = 42;

function drawRing(c: CanvasRenderingContext2D, r: Ring, part: "all" | "back" | "front") {
  const [light, dark] = RING_COLORS[r.color % RING_COLORS.length]!;
  const ry = RING_R * Math.max(0.16, upright(r));
  const [a0, a1] = part === "back" ? [Math.PI, Math.PI * 2] : part === "front" ? [0, Math.PI] : [0, Math.PI * 2];
  c.save();
  c.translate(r.x, r.y);
  c.rotate(r.tilt);
  c.lineCap = "round";
  // Shadow, rim, face, then a glint along the top.
  c.strokeStyle = "rgba(10,40,70,.28)";
  c.lineWidth = 9;
  c.beginPath();
  c.ellipse(1.5, 2.5, RING_R, ry, 0, a0, a1);
  c.stroke();
  c.strokeStyle = dark;
  c.lineWidth = 9;
  c.beginPath();
  c.ellipse(0, 0, RING_R, ry, 0, a0, a1);
  c.stroke();
  c.strokeStyle = light;
  c.lineWidth = 5.5;
  c.beginPath();
  c.ellipse(0, -0.6, RING_R, ry, 0, a0, a1);
  c.stroke();
  if (part !== "back") {
    c.strokeStyle = "rgba(255,255,255,.85)";
    c.lineWidth = 2.2;
    c.beginPath();
    c.ellipse(0, -1.5, RING_R * 0.92, ry * 0.9, 0, Math.PI * 1.15, Math.PI * 1.55);
    c.stroke();
  }
  c.restore();
}

function drawPeg(c: CanvasRenderingContext2D, p: (typeof PEGS)[number]) {
  const g = c.createLinearGradient(p.x - 9, 0, p.x + 9, 0);
  g.addColorStop(0, "#d69a1f");
  g.addColorStop(0.5, "#fbe08a");
  g.addColorStop(1, "#b37d10");
  c.fillStyle = g;
  c.strokeStyle = "#8a5a0a";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(p.x - 8, p.base);
  c.lineTo(p.x - 2.5, p.tip + 6);
  c.quadraticCurveTo(p.x, p.tip, p.x + 2.5, p.tip + 6);
  c.lineTo(p.x + 8, p.base);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,.7)";
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(p.x - 4, p.base - 4);
  c.lineTo(p.x - 1, p.tip + 12);
  c.stroke();
  const b = c.createRadialGradient(p.x, p.base, 2, p.x, p.base, 22);
  b.addColorStop(0, "#f6c453");
  b.addColorStop(1, "#b37d10");
  c.fillStyle = b;
  c.beginPath();
  c.ellipse(p.x, p.base, 20, 6, 0, 0, Math.PI * 2);
  c.fill();
}

function draw(c: CanvasRenderingContext2D, s: PumpState, bubbles: Bubble[], jets: Jet[], clock: number, calm: boolean) {
  // Water.
  const w = c.createLinearGradient(0, 0, 0, TANK_H);
  w.addColorStop(0, "#c8f0fb");
  w.addColorStop(0.35, "#6cc6ea");
  w.addColorStop(1, "#1f74b0");
  c.fillStyle = w;
  c.fillRect(0, 0, TANK_W, TANK_H);
  // Moving light in the water.
  c.strokeStyle = "rgba(255,255,255,.2)";
  c.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y0 = 80 + i * 38;
    c.beginPath();
    for (let x = 0; x <= TANK_W; x += 12) {
      const y = y0 + Math.sin(x / 26 + clock * (calm ? 0 : 1.3) + i) * 5;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  // Surface.
  c.fillStyle = "rgba(255,255,255,.5)";
  c.beginPath();
  c.moveTo(0, 0);
  for (let x = 0; x <= TANK_W; x += 10) c.lineTo(x, 18 + Math.sin(x / 30 + clock * 2) * 3);
  c.lineTo(TANK_W, 0);
  c.closePath();
  c.fill();

  // Water bursts.
  for (const j of jets) {
    const age = clock - j.t;
    if (age > 0.7) continue;
    const x = NOZZLES[j.side].x;
    const h = 120 + age * 300;
    const a = 0.35 * (1 - age / 0.7);
    const g = c.createLinearGradient(0, TANK_H, 0, TANK_H - h);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 10, TANK_H);
    c.bezierCurveTo(x - 40, TANK_H - h * 0.4, x - 46, TANK_H - h * 0.8, x - 18, TANK_H - h);
    c.bezierCurveTo(x, TANK_H - h * 0.9, x + 20, TANK_H - h * 1.05, x + 30, TANK_H - h * 0.95);
    c.bezierCurveTo(x + 46, TANK_H - h * 0.6, x + 28, TANK_H - h * 0.3, x + 10, TANK_H);
    c.closePath();
    c.fill();
  }

  // Bubbles.
  for (const b of bubbles) {
    c.fillStyle = "rgba(255,255,255,.14)";
    c.strokeStyle = "rgba(255,255,255,.7)";
    c.lineWidth = 0.9;
    c.beginPath();
    c.arc(b.x + Math.sin(b.wob) * 2, b.y, b.r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // Pegs with their rings threaded on: back of each ring, the peg, then the front.
  PEGS.forEach((p, i) => {
    const on = s.rings.filter((r) => r.peg === i).sort((a, b) => a.y - b.y);
    on.forEach((r) => drawRing(c, r, "back"));
    drawPeg(c, p);
    on.forEach((r) => drawRing(c, r, "front"));
  });
  // Floating rings.
  s.rings.filter((r) => r.peg === null).forEach((r) => drawRing(c, r, "all"));

  // Nozzles and the glass.
  c.fillStyle = "#3a3a3a";
  for (const n of NOZZLES) c.fillRect(n.x - 14, TANK_H - 10, 28, 12);
  const glass = c.createLinearGradient(0, 0, TANK_W, 0);
  glass.addColorStop(0, "rgba(255,255,255,.5)");
  glass.addColorStop(0.08, "rgba(255,255,255,0)");
  glass.addColorStop(0.88, "rgba(255,255,255,0)");
  glass.addColorStop(1, "rgba(255,255,255,.22)");
  c.fillStyle = glass;
  c.fillRect(0, 0, TANK_W, TANK_H);
}

/** The red plastic toy around the water. */
function Casing() {
  return (
    <svg viewBox={`0 0 ${BOX_W} ${BOX_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="pump-case" x1="0" x2="1">
          <stop offset="0" stopColor="#c8361c" />
          <stop offset=".12" stopColor="#f06a48" />
          <stop offset=".5" stopColor="#e8563a" />
          <stop offset=".9" stopColor="#c03a20" />
          <stop offset="1" stopColor="#9c2a14" />
        </linearGradient>
      </defs>
      <rect x="8" y="14" width="342" height="536" rx="40" fill="url(#pump-case)" stroke="#7a2010" strokeWidth="2" />
      <path d="M30 22 Q20 120 22 300" stroke="rgba(255,255,255,.45)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <text x="179" y="34" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="900" fontSize="15" fill="#fbe7a6" letterSpacing="1">
        PUMP AM
      </text>
      <rect x={WIN_X - 2} y={WIN_Y - 2} width={TANK_W + 4} height={TANK_H + 4} rx="27" fill="#7a2010" />
    </svg>
  );
}

function PumpButton({ side, onPress, pressed }: { side: 0 | 1; onPress: () => void; pressed: boolean }) {
  const [hi, mid, lo, text] = side === 0 ? ["#ffd27a", "#e9b13c", "#a8740c", "#5a3a06"] : ["#9fd0ff", "#3f74d8", "#1e3f8a", "#e8f2ff"];
  return (
    <button
      type="button"
      aria-label={side === 0 ? "Left pump" : "Right pump"}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="absolute grid touch-none select-none place-items-center rounded-full"
      style={{
        left: `${((side === 0 ? 86 : 272) / BOX_W) * 100}%`,
        top: `${(494 / BOX_H) * 100}%`,
        width: `${(84 / BOX_W) * 100}%`,
        aspectRatio: "1",
        transform: `translate(-50%, -50%) translateY(${pressed ? 3 : 0}px)`,
        background: "#7a2010",
        boxShadow: pressed ? "0 2px 0 rgba(0,0,0,.35)" : "0 7px 0 rgba(0,0,0,.35)",
        transition: "transform 80ms, box-shadow 80ms",
      }}
    >
      <span
        className="grid h-[84%] w-[84%] place-items-center rounded-full font-black"
        style={{ background: `radial-gradient(circle at 40% 35%, ${hi}, ${mid} 55%, ${lo})`, color: text, fontFamily: "Fraunces, serif", fontSize: "clamp(0.85rem, 3.6vw, 1.05rem)", boxShadow: "inset 0 -4px 8px rgba(0,0,0,.25), inset 0 6px 10px rgba(255,255,255,.35)" }}
      >
        Pump
      </span>
    </button>
  );
}

export function PumpAm({ api }: { api: SoloApi<PumpState> }) {
  const [s, setS] = useState<PumpState>(() => api.saved ?? newPump(api.seed));
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubbles = useRef<Bubble[]>([]);
  const jets = useRef<Jet[]>([]);
  const clock = useRef(0);
  const tilt = useRef(0);
  const [tiltOn, setTiltOn] = useState(false);
  const [pressed, setPressed] = useState<[boolean, boolean]>([false, false]);
  const [said, setSaid] = useState("");
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const press = useCallback(
    (side: 0 | 1) => {
      const a = apiRef.current;
      if (a.paused || state.current.over) return;
      state.current = pump(a.seed, state.current, side);
      jets.current.push({ side, t: clock.current });
      const n = calm ? 4 : 16;
      for (let i = 0; i < n; i++)
        bubbles.current.push({ x: NOZZLES[side].x + (Math.random() - 0.5) * 34, y: TANK_H - 8 - Math.random() * 30, r: 1.5 + Math.random() * 4, vy: 60 + Math.random() * 120, wob: Math.random() * 6, life: 1 });
      a.sound("tap");
      setPressed((p) => (side === 0 ? [true, p[1]] : [p[0], true]));
      setTimeout(() => setPressed((p) => (side === 0 ? [false, p[1]] : [p[0], false])), 120);
    },
    [calm],
  );

  // Fixed-step physics; drawing every frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let steps = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const a = apiRef.current;
      if (!a.paused && !state.current.over) {
        acc += dt;
        clock.current += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          state.current = stepPump(state.current, tilt.current);
          steps++;
          if (state.current.landed) {
            a.sound("drop");
            navigator.vibrate?.(25);
            setSaid(`Ring on. ${hung(state.current)} of ${RINGS}.`);
            changed = true;
          }
          if (steps % 30 === 0) changed = true;
          if (state.current.over) break;
        }
        // Bubbles rise and fade; a few drift up all the time.
        if (!calm && Math.random() < dt * 3) bubbles.current.push({ x: 20 + Math.random() * (TANK_W - 40), y: TANK_H - 4, r: 1 + Math.random() * 2.5, vy: 30 + Math.random() * 40, wob: 0, life: 1 });
        bubbles.current = bubbles.current.filter((b) => {
          b.y -= b.vy * dt;
          b.wob += dt * 6;
          return b.y > 14;
        });
        jets.current = jets.current.filter((j) => clock.current - j.t < 0.8);
        if (changed) setS(state.current);
      } else acc = 0;
      const ctx = canvas.current?.getContext("2d");
      if (ctx) {
        const k = canvas.current!.width / TANK_W;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        draw(ctx, state.current, bubbles.current, jets.current, clock.current, calm);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm]);

  // Canvas resolution follows its size on screen.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    api.save(s);
    if (s.over && !ended.current) {
      ended.current = true;
      const n = hung(s);
      api.sound(n === RINGS ? "win" : "lose");
      api.end(pumpScore(s), { rings: n, seconds: Math.round(s.time) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        e.preventDefault();
        press(0);
      } else if (["ArrowRight", "l", "L", "d", "D"].includes(e.key)) {
        e.preventDefault();
        press(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  // Tilting the phone sways the water (asks permission on iPhone).
  useEffect(() => {
    if (!tiltOn) {
      tilt.current = 0;
      return;
    }
    const on = (e: DeviceOrientationEvent) => {
      tilt.current = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30));
    };
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, [tiltOn]);
  const toggleTilt = async () => {
    if (tiltOn) return setTiltOn(false);
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (D?.requestPermission) {
      try {
        if ((await D.requestPermission()) !== "granted") return;
      } catch {
        return;
      }
    }
    setTiltOn(true);
  };

  const n = hung(s);
  const left = Math.max(0, Math.ceil(TIME_LIMIT - s.time));
  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">
          {n} <span className="text-[1rem] text-muted">of {RINGS}</span>
        </p>
        <p className="display text-[1.6rem] leading-none tabular" aria-label={`${left} seconds left`}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div data-tour="pump-tank" className="relative mt-3 w-full" style={{ aspectRatio: `${BOX_W} / ${BOX_H}` }}>
        <Casing />
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Pump Am. ${n} of ${RINGS} rings on the pegs. Press the pumps to move the water.`}
          className="absolute rounded-[7%/5%]"
          style={{ left: `${(WIN_X / BOX_W) * 100}%`, top: `${(WIN_Y / BOX_H) * 100}%`, width: `${(TANK_W / BOX_W) * 100}%`, height: `${(TANK_H / BOX_H) * 100}%` }}
        />
        <div data-tour="pump-buttons">
          <PumpButton side={0} onPress={() => press(0)} pressed={pressed[0]} />
          <PumpButton side={1} onPress={() => press(1)} pressed={pressed[1]} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[0.82rem] text-muted">Each pump pushes the water up on its side. Rings that land flat over a peg stay on.</p>
        <button type="button" onClick={toggleTilt} aria-pressed={tiltOn} className="glass shrink-0 rounded-full px-3.5 py-2 text-[0.82rem] font-semibold">
          {tiltOn ? "Tilt on" : "Tilt: off"}
        </button>
      </div>
    </div>
  );
}
