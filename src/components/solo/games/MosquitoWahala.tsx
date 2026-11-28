"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameAudio, type LoopHandle } from "@/lib/game-audio";
import { BED_Y, CAN_Y, H, ROOMS, STEP, START_BITES, W, isGear, newMosquito, nightOfMode, nightSpec, stepMosquito, takings, type Boss, type Mosquito, type MosquitoState, type Power, type Puddle } from "@/lib/solo/games/mosquito";
import type { SoloApi } from "../SoloShell";

type Pop = { x: number; y: number; text: string; sub: string; life: number };
type Splat = { x: number; y: number; life: number; big: boolean };
type Mark = { x: number; y: number; r: number };

/** Each room's paint. Room -1 is All Night, in the original bedroom. */
const THEMES = [
  { top: "#1b2140", low: "#2e2547", floor: "#3a2a4e", frame: "#6b5a8a", bed: "#4b3a6b", wrap: "#b5382f", dot: "#f2b632" },
  { top: "#20362f", low: "#35402c", floor: "#3d3226", frame: "#7d7350", bed: "#5a4630", wrap: "#2f6d8f", dot: "#f6efe6" },
  { top: "#1d3346", low: "#2b3f55", floor: "#37404f", frame: "#6d8498", bed: "#47566b", wrap: "#7a3f8f", dot: "#f6c453" },
  { top: "#0f3540", low: "#17474c", floor: "#4a3a28", frame: "#8a6e48", bed: "#5c452c", wrap: "#c8572c", dot: "#f6efe6" },
  { top: "#1a2333", low: "#27313f", floor: "#2d3540", frame: "#66727f", bed: "#404a58", wrap: "#2f7d5b", dot: "#f2b632" },
] as const;

function bed(c: CanvasRenderingContext2D, x: number, w: number, t: (typeof THEMES)[number]) {
  c.fillStyle = t.bed;
  c.beginPath();
  c.roundRect(x, BED_Y - 6, w, 54, 10);
  c.fill();
  c.fillStyle = "#f3e9d8";
  c.beginPath();
  c.ellipse(x + 40, BED_Y - 12, 32, 12, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#6a3d2a";
  c.beginPath();
  c.arc(x + 46, BED_Y - 21, 13, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = t.wrap;
  c.beginPath();
  c.roundRect(x + 56, BED_Y - 26, w - 66, 34, 15);
  c.fill();
  c.fillStyle = t.dot;
  for (let d = x + 74; d < x + w - 20; d += 23) {
    c.beginPath();
    c.moveTo(d, BED_Y - 18);
    c.lineTo(d + 7, BED_Y - 9);
    c.lineTo(d, BED_Y);
    c.lineTo(d - 7, BED_Y - 9);
    c.closePath();
    c.fill();
  }
}

function windowAt(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: string, moon: boolean) {
  c.fillStyle = "#0d1028";
  c.strokeStyle = frame;
  c.lineWidth = 5;
  c.beginPath();
  c.roundRect(x, y, w, h, 6);
  c.fill();
  c.stroke();
  if (moon) {
    c.fillStyle = "#f6d67a";
    c.beginPath();
    c.arc(x + w * 0.68, y + h * 0.3, 17, 0, Math.PI * 2);
    c.fill();
  }
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(x + w / 2, y);
  c.lineTo(x + w / 2, y + h);
  c.moveTo(x, y + h / 2);
  c.lineTo(x + w, y + h / 2);
  c.stroke();
}

/** The room, painted once per size. */
function paintRoom(k: number, room: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  const c = cv.getContext("2d")!;
  c.scale(k, k);
  const t = THEMES[Math.max(0, room)]!;
  const wall = c.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, t.top);
  wall.addColorStop(1, t.low);
  c.fillStyle = wall;
  c.fillRect(0, 0, W, H);

  if (room === 1) {
    // Face-me-I-face-you: a door to the corridor, tired paint and a washing line.
    c.fillStyle = "rgba(255,255,255,.05)";
    for (const [x, y, r] of [[60, 210, 34], [310, 300, 26], [150, 90, 20]]) {
      c.beginPath();
      c.ellipse(x!, y!, r!, r! * 0.7, 0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#4d3a25";
    c.strokeStyle = t.frame;
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(236, 120, 92, 280, 4);
    c.fill();
    c.stroke();
    c.fillStyle = "#d9b45a";
    c.beginPath();
    c.arc(316, 270, 5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#c9c0a8";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, 74);
    c.quadraticCurveTo(110, 96, 226, 66);
    c.stroke();
    for (const [x, col] of [[46, "#b5382f"], [104, "#e9b13c"], [164, "#3f7a8f"]] as const) {
      c.fillStyle = col;
      c.beginPath();
      c.roundRect(x, 84, 36, 52, 4);
      c.fill();
    }
  } else if (room === 2) {
    // The hostel: a window, lockers and a timetable on the wall.
    windowAt(c, 120, 36, 118, 110, t.frame, true);
    c.fillStyle = "#56697f";
    for (const x of [14, 62]) {
      c.beginPath();
      c.roundRect(x, 190, 42, 150, 3);
      c.fill();
    }
    c.fillStyle = "#f3e9d8";
    c.fillRect(268, 178, 66, 84);
    c.fillStyle = "#8496a8";
    for (let y = 192; y < 252; y += 12) c.fillRect(276, y, 50, 3);
  } else if (room === 3) {
    // The lagoon: plank walls, and water through both windows.
    c.strokeStyle = "rgba(0,0,0,.16)";
    c.lineWidth = 1.5;
    for (let y = 30; y < 456; y += 34) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    for (const x of [18, 244]) {
      windowAt(c, x, 60, 96, 120, t.frame, x > 100);
      c.fillStyle = "rgba(70,150,170,.55)";
      c.fillRect(x + 4, 136, 88, 40);
    }
  } else if (room === 4) {
    // A rainy night: a wet window, a leak stain and a bucket.
    windowAt(c, 196, 40, 124, 134, t.frame, false);
    c.strokeStyle = "rgba(170,200,230,.55)";
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 26; i++) {
      const x = 202 + (i * 41) % 112;
      const y = 46 + (i * 67) % 112;
      c.moveTo(x, y);
      c.lineTo(x - 3, y + 12);
    }
    c.stroke();
    c.fillStyle = "rgba(0,0,0,.16)";
    c.beginPath();
    c.ellipse(90, 18, 74, 44, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    windowAt(c, 214, 40, 110, 130, t.frame, true);
    c.fillStyle = "#fff";
    for (const [x, y] of [[226, 52], [250, 140], [300, 150], [236, 120], [312, 128], [258, 64]]) c.fillRect(x!, y!, 1.5, 1.5);
  }

  // A soft lamp.
  const lamp = c.createRadialGradient(60, 300, 0, 60, 300, 150);
  lamp.addColorStop(0, "rgba(255,220,140,.38)");
  lamp.addColorStop(1, "rgba(255,220,140,0)");
  c.fillStyle = lamp;
  c.fillRect(0, 140, 220, 320);

  c.fillStyle = t.floor;
  c.fillRect(0, 456, W, H - 456);
  c.fillStyle = "rgba(0,0,0,.2)";
  c.fillRect(0, 456, W, 4);
  if (room === 2) {
    bed(c, -10, 172, t);
    bed(c, 196, 172, t);
  } else bed(c, -10, 300, t);
  return cv;
}

/** The KILL AM can. */
function paintCan(k: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.round(80 * k);
  cv.height = Math.round(130 * k);
  const c = cv.getContext("2d")!;
  c.scale(k, k);
  c.translate(40, 26);
  const body = c.createLinearGradient(-30, 0, 30, 0);
  body.addColorStop(0, "#2d6b2d");
  body.addColorStop(0.35, "#7cd36b");
  body.addColorStop(0.6, "#3f9a3a");
  body.addColorStop(1, "#1f4d1f");
  c.fillStyle = body;
  c.strokeStyle = "#123012";
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(-30, 0, 60, 96, 8);
  c.fill();
  c.stroke();
  const metal = c.createLinearGradient(-18, 0, 18, 0);
  metal.addColorStop(0, "#7d7d7d");
  metal.addColorStop(0.4, "#f0f0f0");
  metal.addColorStop(1, "#6a6a6a");
  c.fillStyle = metal;
  c.strokeStyle = "#444";
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(-18, -14, 36, 16, 5);
  c.fill();
  c.stroke();
  c.fillStyle = "#e8563a";
  c.strokeStyle = "#1c1416";
  c.beginPath();
  c.roundRect(-6, -22, 12, 10, 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#f6c453";
  c.beginPath();
  c.roundRect(-26, 26, 52, 40, 5);
  c.fill();
  c.font = "900 15px Fraunces, serif";
  c.textAlign = "center";
  c.fillStyle = "#1c1416";
  c.fillText("KILL", 0, 45);
  c.fillStyle = "#e8563a";
  c.fillText("AM", 0, 60);
  c.fillStyle = "rgba(255,255,255,.35)";
  c.beginPath();
  c.roundRect(-24, 4, 6, 86, 3);
  c.fill();
  return cv;
}

function drawBody(c: CanvasRenderingContext2D, id: number, clock: number, belly: string, wide: number) {
  c.strokeStyle = "#1c1416";
  c.lineWidth = 0.9;
  c.lineCap = "round";
  c.beginPath();
  for (const [x1, y1, x2, y2, x3, y3] of [[-2, 2, -14, 12, -20, 26], [0, 3, -4, 17, -6, 33], [2, 2, 12, 14, 16, 28], [-2, -2, -16, -4, -24, -12], [2, -2, 16, -6, 24, -16]]) {
    c.moveTo(x1!, y1!);
    c.lineTo(x2!, y2!);
    c.lineTo(x3!, y3!);
  }
  c.stroke();
  // Wings, a blur of flapping.
  const flap = Math.sin(clock * 60 + id) * 0.5;
  for (const side of [-1, 1]) {
    c.save();
    c.rotate(side * (0.5 + flap));
    c.fillStyle = "rgba(220,235,255,.5)";
    c.strokeStyle = "rgba(255,255,255,.7)";
    c.lineWidth = 0.6;
    c.beginPath();
    c.ellipse(side * 8, -9, 13, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }
  // Body: striped abdomen, thorax, head, proboscis.
  c.fillStyle = belly;
  c.beginPath();
  c.ellipse(0, 8, wide, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#d9cfc4";
  c.lineWidth = 0.8;
  c.beginPath();
  for (const v of [2, 6, 10, 14]) {
    c.moveTo(-wide + 0.2, v);
    c.lineTo(wide - 0.2, v);
  }
  c.stroke();
  c.fillStyle = "#2a1d18";
  c.beginPath();
  c.ellipse(0, -3, 3.2, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1c1416";
  c.beginPath();
  c.arc(0, -8.5, 2.6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#1c1416";
  c.lineWidth = 1.1;
  c.beginPath();
  c.moveTo(0, -10);
  c.lineTo(0, -20);
  c.stroke();
}

function drawBug(c: CanvasRenderingContext2D, b: Mosquito, clock: number) {
  const s = b.big ? 1.5 : 1.1;
  c.save();
  // Quiet Ones only show themselves when they're close to the bed.
  if (b.kind === "quiet") c.globalAlpha = Math.max(0.16, Math.min(1, (b.y - 170) / 150));
  c.translate(b.x, b.y);
  c.rotate(Math.sin(b.phase) * 0.35);
  c.scale(s, s);
  drawBody(c, b.id, clock, b.big ? "#a3262a" : b.kind === "sharp" ? "#1f7a72" : "#3a2a22", b.big ? 5 : 2.6);
  if (b.big && b.hp > 1) {
    c.fillStyle = "#f6efe6";
    c.font = "800 7px Manrope, sans-serif";
    c.textAlign = "center";
    c.fillText("×" + b.hp, 0, 28);
  }
  c.restore();
}

/** Each boss wears something of their own. */
function drawBoss(c: CanvasRenderingContext2D, b: Boss, room: number, clock: number, hurt: number) {
  c.save();
  c.translate(b.x + (hurt > 0 ? Math.sin(clock * 90) * 2.5 : 0), b.y);
  c.rotate(b.move === "dive" ? 0 : Math.sin(b.phase * 2) * 0.12);
  c.scale(3, 3);
  drawBody(c, b.id, clock, ["#a3262a", "#54402a", "#1f7a72", "#2c5f8f", "#6a2a7a"][room] ?? "#a3262a", 6);
  if (room === 0) {
    c.fillStyle = "#d9307a";
    c.beginPath();
    c.ellipse(0, -12, 7, 3.6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f2b632";
    c.fillRect(-6, -12, 12, 1);
  } else if (room === 1) {
    c.fillStyle = "#b5382f";
    c.beginPath();
    c.roundRect(-5, -14.5, 10, 5, 2);
    c.fill();
    c.fillRect(0, -11, 9, 1.6);
  } else if (room === 2) {
    c.strokeStyle = "#f6efe6";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, -9, 4.6, Math.PI, 0);
    c.stroke();
    c.fillStyle = "#e8563a";
    c.fillRect(-5.8, -9.5, 2.2, 3.4);
    c.fillRect(3.6, -9.5, 2.2, 3.4);
  } else if (room === 3) {
    c.fillStyle = "#f6c453";
    for (const x of [-4, -1.4, 1.4, 4]) {
      c.beginPath();
      c.arc(x, -3 + Math.abs(x) * 0.25, 1, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    c.fillStyle = "#f2b632";
    c.beginPath();
    c.moveTo(-6, -11);
    c.lineTo(-7, -17);
    c.lineTo(-3, -13.5);
    c.lineTo(0, -18);
    c.lineTo(3, -13.5);
    c.lineTo(7, -17);
    c.lineTo(6, -11);
    c.closePath();
    c.fill();
  }
  c.restore();
}

const POWER_LOOK: Record<Power["kind"], [string, string]> = { coil: ["#3f7a2f", "Coil"], net: ["#f6efe6", "Net"], double: ["#e9b13c", "×2 spray"] };

function drawPower(c: CanvasRenderingContext2D, p: Power, clock: number) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(Math.sin(clock * 3 + p.x) * 0.2);
  c.fillStyle = "rgba(255,255,255,.95)";
  c.strokeStyle = "#1c1416";
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, 15, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  if (p.kind === "coil") {
    c.strokeStyle = "#3f7a2f";
    c.lineWidth = 2.4;
    c.beginPath();
    for (let a = 0; a < 14; a += 0.3) c[a ? "lineTo" : "moveTo"](Math.cos(a) * (2 + a * 0.75), Math.sin(a) * (2 + a * 0.75));
    c.stroke();
  } else if (p.kind === "net") {
    c.strokeStyle = "#7a8aa0";
    c.lineWidth = 1;
    c.beginPath();
    for (let i = -9; i <= 9; i += 4.5) {
      c.moveTo(i, -9);
      c.lineTo(i, 9);
      c.moveTo(-9, i);
      c.lineTo(9, i);
    }
    c.stroke();
  } else {
    c.fillStyle = "#3f9a3a";
    c.fillRect(-9, -6, 7, 13);
    c.fillRect(2, -6, 7, 13);
  }
  c.fillStyle = "#f6efe6";
  c.font = "800 9px Manrope, sans-serif";
  c.textAlign = "center";
  c.fillText(POWER_LOOK[p.kind][1], 0, 27);
  c.restore();
}

function drawPuddle(c: CanvasRenderingContext2D, p: Puddle, clock: number) {
  c.fillStyle = "rgba(110,170,210,.55)";
  c.strokeStyle = "rgba(210,235,250,.7)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(p.x, p.y, 30, 11, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = `rgba(230,245,255,${0.35 + Math.sin(clock * 5 + p.id) * 0.2})`;
  c.beginPath();
  c.ellipse(p.x, p.y, 15 + ((clock * 14 + p.id) % 14), 5 + ((clock * 5 + p.id) % 5), 0, 0, Math.PI * 2);
  c.stroke();
  if (p.clear > 0) {
    c.fillStyle = "#7cd36b";
    c.fillRect(p.x - 24, p.y + 15, 48 * Math.min(1, p.clear / 0.55), 4);
  }
}

/** How wide the torch reaches at this height. */
const torchHalf = (y: number) => 16 + Math.max(0, CAN_Y - 26 - y) * 0.235;

const say = (s: MosquitoState) => {
  const spec = s.night ? nightSpec(s.night) : null;
  return spec ? (spec.boss ? ROOMS[spec.room]!.boss : `Wave ${s.wave} of ${spec.waves}`) : `Wave ${s.wave}`;
};

export function MosquitoWahala({ api }: { api: SoloApi<MosquitoState> }) {
  const night = nightOfMode(api.mode) ?? 0;
  const spec = useMemo(() => (night ? nightSpec(night) : null), [night]);
  const room = spec ? spec.room : -1;
  const [s, setS] = useState<MosquitoState>(() => {
    const fresh = newMosquito(api.seed, night ? { night, gear: (api.extras?.owned ?? []).filter(isGear) } : undefined);
    return api.saved ? { ...fresh, ...api.saved } : fresh;
  });
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const paint = useRef<HTMLCanvasElement | null>(null);
  const can = useRef<HTMLCanvasElement | null>(null);
  const shade = useRef<HTMLCanvasElement | null>(null);
  const target = useRef(s.can);
  const keys = useRef({ left: false, right: false });
  const pops = useRef<Pop[]>([]);
  const splats = useRef<Splat[]>([]);
  const marks = useRef<Mark[]>([]);
  const banner = useRef<{ text: string; life: number } | null>({ text: spec ? (spec.boss ? ROOMS[spec.room]!.boss : `Night ${night}`) : "Wave 1", life: 1.8 });
  const flash = useRef(0);
  const shake = useRef(0);
  const fogFx = useRef(0);
  const hurt = useRef(0);
  const dim = useRef(s.dark > 0 ? 1 : 0);
  const askFog = useRef(false);
  const [said, setSaid] = useState("");
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const audio = useRef<GameAudio | null>(null);
  const buzz = useRef<LoopHandle | null>(null);
  const hiss = useRef<LoopHandle | null>(null);
  const calm = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(["mq-buzz", "mq-spray", "mq-splat", "mq-bite", "mq-light-off", "mq-up-nepa", "mq-crow"]);
    buzz.current = au.loop("mq-buzz", { volume: 0 });
    hiss.current = au.loop("mq-spray", { volume: 0 });
    return () => {
      buzz.current = null;
      hiss.current = null;
      au.dispose();
      audio.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one sound engine per game
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      paint.current = paintRoom(el.width / W, room);
      can.current = paintCan(el.width / W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [room]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let clock = 0;
    let steps = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const a = apiRef.current;
      const au = audio.current;
      const running = !a.paused && !state.current.over;
      if (running) {
        clock += dt;
        if (keys.current.left) target.current -= 380 * dt;
        if (keys.current.right) target.current += 380 * dt;
        target.current = Math.max(0, Math.min(W, target.current));
        acc += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          const wasReady = state.current.fog >= 1;
          const r = stepMosquito(a.seed, state.current, target.current, { fog: askFog.current });
          askFog.current = false;
          state.current = r.state;
          steps++;
          if (steps === 40 && spec?.boss) au?.sfx("mq-boss");
          for (const h of r.ev.hits) {
            if (h.killed) {
              au?.sfx("mq-splat", { volume: 0.8, rate: 0.9 + Math.random() * 0.25 });
              splats.current.push({ x: h.x, y: h.y, life: 1, big: h.points > 40 });
              if (h.y < BED_Y - 20) {
                marks.current.push({ x: h.x, y: h.y, r: 2 + Math.random() * 3 });
                if (marks.current.length > 30) marks.current.shift();
              }
              pops.current.push({ x: h.x, y: Math.max(40, h.y - 14), text: ["Kpa!", "Gbam!"][Math.floor(Math.random() * 2)]!, sub: `+${h.points}`, life: 1 });
              changed = true;
            } else au?.sfx("mq-puff-hit", { volume: 0.6 });
          }
          if (r.ev.bitten) {
            au?.sfx("mq-bite");
            au?.voice("mq-ouch", 2);
            navigator.vibrate?.(80);
            flash.current = 1;
            shake.current = 1;
            setSaid(state.current.bites > 0 ? `Bitten! ${state.current.bites} bites left.` : "Too many bites. Goodnight.");
            changed = true;
          }
          if (r.ev.blocked) au?.sfx("mq-blocked", { volume: 0.7 });
          if (r.ev.power) {
            au?.sfx("mq-power");
            setSaid(r.ev.power === "coil" ? "Coil lit: they slow down." : r.ev.power === "net" ? "Net up: no bites for a while." : "Double spray.");
            changed = true;
          }
          if (r.ev.wave) {
            au?.sfx("mq-wave");
            banner.current = { text: say(state.current), life: 1.8 };
            setSaid(`Wave ${r.ev.wave - 1} cleared.`);
            changed = true;
          }
          if (r.ev.light === "off") {
            au?.sfx("mq-light-off");
            banner.current = { text: "NEPA don take light!", life: 2 };
            setSaid("The light has gone. Your torch shows what's above the can.");
            changed = true;
          } else if (r.ev.light === "on") {
            au?.sfx("mq-up-nepa");
            au?.voice("mq-up-nepa", 6);
            banner.current = { text: "Up NEPA!", life: 1.8 };
            setSaid("The light is back.");
            changed = true;
          }
          if (r.ev.fog) {
            au?.sfx("mq-fog");
            fogFx.current = 1;
            setSaid("Big Spray!");
            changed = true;
          }
          if (!wasReady && state.current.fog >= 1) {
            au?.sfx("mq-fog-ready", { volume: 0.8 });
            setSaid("Big Spray is ready.");
            changed = true;
          }
          if (r.ev.bossHit) {
            hurt.current = 0.12;
            if (steps % 6 === 0) au?.sfx("mq-boss-hit", { volume: 0.6 });
          }
          if (r.ev.dive) {
            au?.sfx("mq-dive");
            banner.current = { text: "Spray am! It's diving!", life: 1.4 };
            setSaid("The boss is diving at the bed. Get under it.");
            changed = true;
          }
          if (r.ev.bossDown) {
            au?.sfx("mq-boss-down");
            shake.current = 1;
            changed = true;
          }
          if (r.ev.puddle) au?.sfx("mq-puddle", { volume: 0.8 });
          if (r.ev.won) {
            au?.sfx("mq-crow");
            banner.current = { text: "Morning don come!", life: 3 };
            changed = true;
          }
          if (steps % 20 === 0) changed = true;
          if (state.current.over) break;
        }
        pops.current = pops.current.filter((p) => ((p.y -= 30 * dt), (p.life -= dt), p.life > 0));
        splats.current = splats.current.filter((p) => ((p.life -= dt * 1.5), p.life > 0));
        if (banner.current) banner.current.life -= dt;
        flash.current = Math.max(0, flash.current - dt * 2);
        shake.current = Math.max(0, shake.current - dt * 3.5);
        fogFx.current = Math.max(0, fogFx.current - dt * 1.1);
        hurt.current = Math.max(0, hurt.current - dt);
        dim.current += ((state.current.dark > 0 ? 1 : 0) - dim.current) * Math.min(1, dt * 7);
        if (changed) setS(state.current);
      } else acc = 0;

      // The buzz follows the closest mosquito from ear to ear. Quiet Ones make no sound.
      const st = state.current;
      const loud = st.bugs.filter((b) => b.kind !== "quiet" && b.y > 0);
      const near = loud.reduce<Mosquito | null>((best, b) => (!best || b.y > best.y ? b : best), null);
      const boss = st.bosses[0];
      const bx = near?.x ?? boss?.x;
      const closeness = near ? Math.min(1, near.y / BED_Y) : boss ? 0.35 : 0;
      buzz.current?.setVolume(running ? 0.1 + closeness * closeness * 0.55 : 0);
      if (bx != null) buzz.current?.setPan((bx / W) * 1.8 - 0.9);
      buzz.current?.setRate(boss && !near ? 0.6 : 0.92 + closeness * 0.18);
      hiss.current?.setVolume(running ? 0.3 : 0);

      const el = canvas.current;
      const c = el?.getContext("2d");
      if (el && c) {
        const k = el.width / W;
        const jolt = calm ? 0 : shake.current * 5;
        const dx = jolt ? (Math.random() - 0.5) * jolt : 0;
        const dy = jolt ? (Math.random() - 0.5) * jolt : 0;
        c.setTransform(1, 0, 0, 1, 0, 0);
        if (paint.current) c.drawImage(paint.current, dx * k, dy * k);
        c.setTransform(k, 0, 0, k, dx * k, dy * k);
        // Splats stay on the wall all night.
        c.fillStyle = "rgba(120,20,24,.5)";
        for (const m of marks.current) {
          c.beginPath();
          c.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          c.fill();
        }
        for (const p of st.puddles) drawPuddle(c, p, clock);
        // Mosquito coil smoke, curling up from the floor.
        if (st.coil > 0) {
          c.strokeStyle = "#3f7a2f";
          c.lineWidth = 3.4;
          c.beginPath();
          for (let a2 = 0; a2 < 18; a2 += 0.3) c[a2 ? "lineTo" : "moveTo"](310 + Math.cos(a2) * (2 + a2 * 0.7), 478 + Math.sin(a2) * (1 + a2 * 0.3));
          c.stroke();
          c.strokeStyle = "rgba(230,230,240,.35)";
          c.lineWidth = 4;
          c.beginPath();
          for (let y = 470; y > 300; y -= 6) c.lineTo(312 + Math.sin(y / 18 + clock * 2) * 8, y);
          c.stroke();
        }
        // Net over the bed.
        if (st.net > 0 || st.shield > 0) {
          c.fillStyle = st.net > 0 ? "rgba(246,239,230,.18)" : "rgba(246,239,230,.07)";
          c.strokeStyle = "rgba(246,239,230,.45)";
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(-10, BED_Y + 10);
          c.quadraticCurveTo(160, BED_Y - 140, W + 10, BED_Y + 10);
          c.closePath();
          c.fill();
          c.save();
          c.clip();
          c.beginPath();
          for (let x = -10; x < W + 10; x += 6) {
            c.moveTo(x, BED_Y - 150);
            c.lineTo(x, BED_Y + 20);
          }
          for (let y = BED_Y - 150; y < BED_Y + 20; y += 6) {
            c.moveTo(-10, y);
            c.lineTo(W + 10, y);
          }
          c.stroke();
          c.restore();
        }
        // Spray mist.
        for (const p of st.puffs) {
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.6);
          g.addColorStop(0, `rgba(235,245,255,${0.75 * p.life})`);
          g.addColorStop(1, "rgba(235,245,255,0)");
          c.fillStyle = g;
          c.beginPath();
          c.arc(p.x, p.y, p.r * 1.6, 0, Math.PI * 2);
          c.fill();
        }
        for (const sp of splats.current) {
          c.fillStyle = `rgba(160,22,26,${sp.life * 0.7})`;
          const spread = (sp.big ? 9 : 5) + (1 - sp.life) * (sp.big ? 16 : 8);
          for (let i = 0; i < 6; i++) {
            const a2 = (i / 6) * Math.PI * 2 + sp.x;
            c.beginPath();
            c.arc(sp.x + Math.cos(a2) * spread, sp.y + Math.sin(a2) * spread, sp.big ? 3 : 2, 0, Math.PI * 2);
            c.fill();
          }
        }
        for (const b of st.bugs) drawBug(c, b, clock);
        for (const b of st.bosses) drawBoss(c, b, room, clock, hurt.current);

        // Blackout: everything goes dark except what the torch reaches.
        if (dim.current > 0.02) {
          const sh = (shade.current ??= Object.assign(document.createElement("canvas"), { width: W, height: H }));
          const d = sh.getContext("2d")!;
          d.globalCompositeOperation = "source-over";
          d.clearRect(0, 0, W, H);
          d.fillStyle = `rgba(3,4,14,${0.96 * dim.current})`;
          d.fillRect(0, 0, W, H);
          d.globalCompositeOperation = "destination-out";
          const top = torchHalf(-10);
          const cone = d.createLinearGradient(0, CAN_Y - 26, 0, -10);
          cone.addColorStop(0, "rgba(0,0,0,1)");
          cone.addColorStop(0.75, "rgba(0,0,0,.92)");
          cone.addColorStop(1, "rgba(0,0,0,.55)");
          d.fillStyle = cone;
          d.beginPath();
          d.moveTo(st.can - 16, CAN_Y - 26);
          d.lineTo(st.can - top, -10);
          d.lineTo(st.can + top, -10);
          d.lineTo(st.can + 16, CAN_Y - 26);
          d.closePath();
          d.fill();
          c.drawImage(sh, 0, 0);
          c.fillStyle = `rgba(255,226,150,${0.08 * dim.current})`;
          c.beginPath();
          c.moveTo(st.can - 16, CAN_Y - 26);
          c.lineTo(st.can - top, -10);
          c.lineTo(st.can + top, -10);
          c.lineTo(st.can + 16, CAN_Y - 26);
          c.closePath();
          c.fill();
          // Outside the torch you only see their eyes.
          c.fillStyle = "#ff3b2f";
          for (const b of st.bugs) {
            if (b.kind === "quiet" || Math.abs(b.x - st.can) < torchHalf(b.y)) continue;
            c.beginPath();
            c.arc(b.x - 3, b.y - 9, 1.7, 0, Math.PI * 2);
            c.arc(b.x + 3, b.y - 9, 1.7, 0, Math.PI * 2);
            c.fill();
          }
          for (const b of st.bosses) {
            c.beginPath();
            c.arc(b.x - 7, b.y - 27, 3, 0, Math.PI * 2);
            c.arc(b.x + 7, b.y - 27, 3, 0, Math.PI * 2);
            c.fill();
          }
        }

        for (const p of st.powers) drawPower(c, p, clock);
        if (can.current) c.drawImage(can.current, st.can - 34, CAN_Y - 30, 68, 110);

        // Big Spray rolling through the room.
        if (fogFx.current > 0) {
          const g = c.createRadialGradient(st.can, CAN_Y, 10, st.can, CAN_Y, 620 * (1 - fogFx.current * 0.55));
          g.addColorStop(0, `rgba(235,250,240,${(calm ? 0.3 : 0.8) * fogFx.current})`);
          g.addColorStop(1, `rgba(235,250,240,${(calm ? 0.1 : 0.3) * fogFx.current})`);
          c.fillStyle = g;
          c.fillRect(0, 0, W, H);
        }

        for (const p of pops.current) {
          c.globalAlpha = Math.min(1, p.life * 1.5);
          c.font = "900 22px Fraunces, serif";
          c.textAlign = "center";
          c.lineWidth = 2;
          c.strokeStyle = "#1c1416";
          c.strokeText(p.text, p.x, p.y);
          c.fillStyle = "#e9b13c";
          c.fillText(p.text, p.x, p.y);
          c.font = "800 12px Manrope, sans-serif";
          c.fillStyle = "#f6efe6";
          c.fillText(p.sub, p.x, p.y + 16);
        }
        c.globalAlpha = 1;
        c.setTransform(k, 0, 0, k, 0, 0);
        // Bites left, as drops of blood.
        for (let i = 0; i < START_BITES; i++) {
          c.fillStyle = i < st.bites ? "#e8563a" : "rgba(255,255,255,.2)";
          c.strokeStyle = "#1c1416";
          c.lineWidth = 0.8;
          c.beginPath();
          c.moveTo(16 + i * 18, 34);
          c.quadraticCurveTo(10 + i * 18, 28, 16 + i * 18, 20);
          c.quadraticCurveTo(22 + i * 18, 28, 16 + i * 18, 34);
          c.fill();
          c.stroke();
        }
        c.fillStyle = "rgba(246,239,230,.85)";
        c.font = "700 9px Manrope, sans-serif";
        c.textAlign = "left";
        c.fillText(`${st.bites} ${st.bites === 1 ? "bite" : "bites"} left`, 12, 48);
        const active = [st.coil > 0 ? `Coil ${Math.ceil(st.coil)}s` : "", st.net > 0 ? `Net ${Math.ceil(st.net)}s` : "", st.double > 0 ? `×2 spray ${Math.ceil(st.double)}s` : ""].filter(Boolean).join(", ");
        if (active) {
          c.fillStyle = "#f6c453";
          c.fillText(active, 12, 62);
        }
        // The boss's health, across the top.
        if (spec?.boss && st.bosses.length) {
          const full = spec.bossHp * spec.bossCount;
          const left = st.bosses.reduce((t, b) => t + b.hp, 0);
          c.fillStyle = "rgba(0,0,0,.55)";
          c.beginPath();
          c.roundRect(120, 18, 224, 13, 6);
          c.fill();
          c.fillStyle = "#e8563a";
          c.beginPath();
          c.roundRect(122, 20, Math.max(6, 220 * (left / full)), 9, 4);
          c.fill();
          c.font = "900 14px Fraunces, serif";
          c.textAlign = "right";
          c.lineWidth = 3;
          c.strokeStyle = "#07071a";
          c.fillStyle = "#f6efe6";
          c.strokeText(ROOMS[spec.room]!.boss, 344, 47);
          c.fillText(ROOMS[spec.room]!.boss, 344, 47);
        }
        if (banner.current && banner.current.life > 0) {
          const text = banner.current.text;
          c.globalAlpha = Math.min(1, banner.current.life);
          c.font = `900 ${text.length > 14 ? 25 : 34}px Fraunces, serif`;
          c.textAlign = "center";
          c.lineWidth = 4;
          c.strokeStyle = "#1c1416";
          c.strokeText(text, W / 2, 250);
          c.fillStyle = "#f6efe6";
          c.fillText(text, W / 2, 250);
          c.globalAlpha = 1;
        }
        if (flash.current > 0) {
          c.fillStyle = `rgba(232,86,58,${flash.current * 0.28})`;
          c.fillRect(0, 0, W, H);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm, room, spec]);

  useEffect(() => {
    api.save(s);
    if (!s.over || ended.current) return;
    ended.current = true;
    buzz.current?.setVolume(0);
    hiss.current?.setVolume(0);
    if (!s.night) {
      api.end(s.score, { wave: s.wave, kills: s.kills });
      return;
    }
    const bites = START_BITES - s.bites;
    if (!s.won) audio.current?.sfx("mq-lose");
    try {
      sessionStorage.setItem("amah:mosquito:last", JSON.stringify({ night: s.night, bites, kills: s.kills }));
    } catch {
      // The finish screen just shows less.
    }
    // A moment to see the last splat before the morning screen.
    const score = s.won ? takings(s.night, bites) : 0;
    setTimeout(() => apiRef.current.end(score, { night: s.night, bites, kills: s.kills, won: s.won }), 1100);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      audio.current?.wake();
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = true;
      else if (e.key === "ArrowRight" || e.key === "d") keys.current.right = true;
      else if (e.key === " " && state.current.night) askFog.current = true;
      else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const toLogical = (clientX: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  };
  const ready = s.fog >= 1;

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="display text-[1.5rem] leading-none">{spec ? `Night ${night}` : `Wave ${s.wave}`}</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <canvas
        ref={canvas}
        data-tour="mosquito-room"
        role="img"
        aria-label={`Mosquito Wahala. ${say(s)}, ${s.bites} bites left. Drag or use the arrow keys to move the spray can.`}
        className="mt-3 w-full touch-none rounded-[22px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={(e) => {
          audio.current?.wake();
          target.current = toLogical(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) target.current = toLogical(e.clientX);
        }}
      />
      {spec ? (
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            audio.current?.wake();
            askFog.current = true;
          }}
          aria-label={ready ? "Use Big Spray" : `Big Spray, ${Math.round(s.fog * 100)} percent full`}
          className="relative mt-3 flex h-12 w-full items-center justify-center overflow-hidden rounded-full bg-[#2c2857] text-[0.95rem] font-extrabold text-[#f6efe6] disabled:opacity-100"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 bg-[#3f9a3a] transition-[width] duration-200" style={{ width: `${s.fog * 100}%` }} />
          <span className="relative">{ready ? "Big Spray: tap now!" : `Big Spray ${Math.round(s.fog * 100)}%`}</span>
        </button>
      ) : null}
      <p data-tour="mosquito-can" className="mt-3 text-center text-[0.82rem] text-muted">
        {spec?.puddles ? "Hold the can over a puddle to clear it." : spec?.boss ? "Get under a diving boss to stop it." : "Drag the can under them. It sprays by itself."}
      </p>
    </div>
  );
}
