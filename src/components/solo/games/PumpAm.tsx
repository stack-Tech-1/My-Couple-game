"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PEGS, NOZZLES, RING_COLORS, RING_R, RINGS, STEP, TANK_H, TANK_W, TIME_LIMIT, clockText, hung, newPump, pump, pumpScore, stepPump, upright, type PumpState, type Ring } from "@/lib/solo/games/pump";
import { GameAudio } from "@/lib/game-audio";
import type { SoloApi } from "../SoloShell";

/** Little things that only exist on screen: bubbles, water bursts, sparkles and the "+100"s. */
type Bubble = { x: number; y: number; r: number; vy: number; wob: number; life: number };
type Jet = { side: 0 | 1; t: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Pop = { x: number; y: number; text: string; t: number };
type Fx = { bubbles: Bubble[]; jets: Jet[]; sparks: Spark[]; pops: Pop[]; glow: [number, number] };

const SOUNDS = ["pa-pump", "pa-ring", "pa-tick", "pa-win", "pa-lose"];
const POP_S = 0.9;

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

function draw(c: CanvasRenderingContext2D, s: PumpState, fx: Fx, clock: number, calm: boolean) {
  const { bubbles, jets } = fx;
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

  // A peg that just caught a ring glows for a moment.
  PEGS.forEach((p, i) => {
    const age = clock - fx.glow[i]!;
    if (age < 0 || age > 0.6) return;
    const g = c.createRadialGradient(p.x, p.tip + 20, 4, p.x, p.tip + 20, 70);
    g.addColorStop(0, `rgba(255,240,170,${0.75 * (1 - age / 0.6)})`);
    g.addColorStop(1, "rgba(255,240,170,0)");
    c.fillStyle = g;
    c.fillRect(p.x - 70, p.tip - 50, 140, 140);
  });

  // Pegs with their rings threaded on: back of each ring, the peg, then the front.
  PEGS.forEach((p, i) => {
    const on = s.rings.filter((r) => r.peg === i).sort((a, b) => a.y - b.y);
    on.forEach((r) => drawRing(c, r, "back"));
    drawPeg(c, p);
    on.forEach((r) => drawRing(c, r, "front"));
  });
  // Floating rings.
  s.rings.filter((r) => r.peg === null).forEach((r) => drawRing(c, r, "all"));

  // Sparkles, then the "+100"s floating up.
  for (const k of fx.sparks) {
    c.globalAlpha = Math.max(0, k.life);
    c.fillStyle = k.color;
    c.beginPath();
    c.arc(k.x, k.y, 1.5 + k.life * 2.5, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  c.textAlign = "center";
  c.lineJoin = "round";
  for (const p of fx.pops) {
    const age = (clock - p.t) / POP_S;
    if (age < 0 || age > 1) continue;
    const grow = calm ? 1 : Math.min(1, 0.6 + age * 4);
    c.globalAlpha = age < 0.7 ? 1 : (1 - age) / 0.3;
    c.font = `900 ${Math.round(19 * grow)}px Fraunces, serif`;
    const y = p.y - age * 34;
    c.strokeStyle = "#1f3f6a";
    c.lineWidth = 4;
    c.strokeText(p.text, p.x, y);
    c.fillStyle = "#fff6d6";
    c.fillText(p.text, p.x, y);
  }
  c.globalAlpha = 1;

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
  const fx = useRef<Fx>({ bubbles: [], jets: [], sparks: [], pops: [], glow: [-9, -9] });
  const clock = useRef(0);
  const lastTick = useRef(0);
  const settle = useRef(0);
  const audio = useRef<GameAudio | null>(null);
  const tilt = useRef(0);
  const [tiltOn, setTiltOn] = useState(false);
  const [pressed, setPressed] = useState<[boolean, boolean]>([false, false]);
  const [said, setSaid] = useState("");
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the game
  }, []);

  /** A ring just went on peg `p`: a glow, sparkles in its colour, "+100", and a clink. */
  const caught = useCallback(
    (r: Ring, p: number, count: number) => {
      const f = fx.current;
      const peg = PEGS[p]!;
      f.glow[p] = clock.current;
      const color = RING_COLORS[r.color % RING_COLORS.length]![0];
      const n = calm ? 4 : 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const v = 50 + Math.random() * 90;
        f.sparks.push({ x: peg.x, y: peg.tip + 16, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 1, color: i % 3 ? color : "#fff6d6" });
      }
      f.pops.push({ x: peg.x, y: peg.tip - 6, text: count === RINGS - 1 ? "One more!" : count === RINGS ? "All ten!" : "+100", t: clock.current });
      audio.current?.sfx("pa-ring", { rate: 1 + count * 0.045, volume: 0.9 });
    },
    [calm],
  );

  const press = useCallback(
    (side: 0 | 1) => {
      const a = apiRef.current;
      if (a.paused || state.current.over) return;
      state.current = pump(a.seed, state.current, side);
      fx.current.jets.push({ side, t: clock.current });
      const n = calm ? 4 : 16;
      for (let i = 0; i < n; i++)
        fx.current.bubbles.push({ x: NOZZLES[side].x + (Math.random() - 0.5) * 34, y: TANK_H - 8 - Math.random() * 30, r: 1.5 + Math.random() * 4, vy: 60 + Math.random() * 120, wob: Math.random() * 6, life: 1 });
      audio.current?.wake();
      audio.current?.sfx("pa-pump", { rate: (side ? 1.1 : 0.92) * (0.96 + Math.random() * 0.08), volume: 0.8 });
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
      const playing = !a.paused && !state.current.over;
      if (playing) {
        acc += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          const before = state.current;
          state.current = stepPump(state.current, tilt.current);
          steps++;
          if (state.current.landed) {
            const count = hung(state.current);
            state.current.rings.forEach((r, i) => {
              if (r.peg !== null && before.rings[i]!.peg === null) caught(r, r.peg, count);
            });
            navigator.vibrate?.(25);
            setSaid(`Ring on. ${count} of ${RINGS}.`);
            changed = true;
          }
          if (steps % 30 === 0) changed = true;
          if (state.current.over) break;
        }
        // The last ten seconds tick.
        const left = Math.ceil(TIME_LIMIT - state.current.time);
        if (left <= 10 && left > 0 && left !== lastTick.current) {
          lastTick.current = left;
          audio.current?.sfx("pa-tick", { volume: 0.8 });
        }
        if (changed) setS(state.current);
      } else acc = 0;
      // Effects keep moving after the last ring, so the finish can be seen.
      if (playing || state.current.over) {
        clock.current += dt;
        if (!playing) {
          // After the end, the rings still settle: the last one slides down its peg. Looks only;
          // the score is already settled.
          settle.current += dt;
          while (settle.current >= STEP) {
            settle.current -= STEP;
            const end = state.current;
            const next = stepPump({ ...end, over: false }, 0);
            // Only rings already on a peg move, so nothing can land after the whistle.
            state.current = { ...next, rings: next.rings.map((r, i) => (end.rings[i]!.peg === null ? end.rings[i]! : r)), time: end.time, over: true, landed: 0 };
          }
        }
        const f = fx.current;
        if (!calm && playing && Math.random() < dt * 3) f.bubbles.push({ x: 20 + Math.random() * (TANK_W - 40), y: TANK_H - 4, r: 1 + Math.random() * 2.5, vy: 30 + Math.random() * 40, wob: 0, life: 1 });
        f.bubbles = f.bubbles.filter((b) => {
          b.y -= b.vy * dt;
          b.wob += dt * 6;
          return b.y > 14;
        });
        f.sparks = f.sparks.filter((k) => {
          k.x += k.vx * dt;
          k.y += k.vy * dt;
          k.vy += 60 * dt;
          k.vx *= 0.97;
          k.life -= dt * 1.4;
          return k.life > 0;
        });
        f.jets = f.jets.filter((j) => clock.current - j.t < 0.8);
        f.pops = f.pops.filter((p) => clock.current - p.t < POP_S);
      }
      const ctx = canvas.current?.getContext("2d");
      if (ctx) {
        const k = canvas.current!.width / TANK_W;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        draw(ctx, state.current, fx.current, clock.current, calm);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm, caught]);

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
      audio.current?.sfx(n === RINGS ? "pa-win" : "pa-lose", { volume: 0.9 });
      if (n === RINGS) {
        // All ten: the tank fizzes up with bubbles and every colour sparkles.
        const f = fx.current;
        const many = calm ? 12 : 90;
        for (let i = 0; i < many; i++) f.bubbles.push({ x: 10 + Math.random() * (TANK_W - 20), y: TANK_H - Math.random() * 60, r: 2 + Math.random() * 6, vy: 90 + Math.random() * 160, wob: Math.random() * 6, life: 1 });
        if (!calm)
          for (let i = 0; i < 40; i++)
            f.sparks.push({ x: TANK_W / 2 + (Math.random() - 0.5) * 120, y: 120 + Math.random() * 60, vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 120, life: 1.4, color: RING_COLORS[i % RING_COLORS.length]![0] });
      }
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
  const on = s.rings.filter((r) => r.peg !== null).map((r) => r.color);
  const hurry = left <= 10 && !s.over;
  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="flex items-end gap-3">
          <p className="display text-[2rem] leading-none tabular">
            {n} <span className="text-[1rem] text-muted">of {RINGS}</span>
          </p>
          {/* A slot for every ring, filled in its colour once it's on. */}
          <svg viewBox="0 0 140 30" className="mb-0.5 h-[26px] w-auto" aria-hidden>
            {Array.from({ length: RINGS }, (_, i) => {
              const x = 7 + (i % 5) * 28;
              const y = i < 5 ? 8 : 22;
              const c = on[i];
              const [light, dark] = c === undefined ? ["none", "rgba(28,20,22,.22)"] : RING_COLORS[c % RING_COLORS.length]!;
              return (
                <g key={i} className={c !== undefined ? "pa-slot" : undefined}>
                  <ellipse cx={x + 7} cy={y} rx="9" ry="5" fill="none" stroke={dark} strokeWidth={c === undefined ? 1.6 : 4} />
                  {c !== undefined ? <ellipse cx={x + 7} cy={y - 0.5} rx="9" ry="5" fill="none" stroke={light} strokeWidth="2.2" /> : null}
                </g>
              );
            })}
          </svg>
        </div>
        <p className={`display text-[1.6rem] leading-none tabular ${hurry ? "pa-hurry text-[#c0361c]" : ""}`} aria-label={`${left} seconds left`}>
          {clockText(left)}
        </p>
      </div>
      <style>{`
        .pa-slot { animation: pa-slot .35s cubic-bezier(.3,1.6,.5,1) both; transform-box: fill-box; transform-origin: center; }
        @keyframes pa-slot { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .pa-hurry { animation: pa-hurry 1s ease-in-out infinite; }
        @keyframes pa-hurry { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.14); } }
        @media (prefers-reduced-motion: reduce) { .pa-slot, .pa-hurry { animation: none; } }
      `}</style>
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
