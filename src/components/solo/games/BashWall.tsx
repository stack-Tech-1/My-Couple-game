"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameAudio, type LoopHandle } from "@/lib/game-audio";
import { BALL_R, BRICK_H, BRICK_W, H, PLANK_Y, STEP, W } from "@/lib/solo/games/bash";
import { DANFO_H, DANFO_W, DANFO_Y, SITES, STREAK, brickLeft, brickTop, indexOf, isBossWall, launchWall, newWall, plankSize, siteOf, stepWall, takings, wallOfMode, type BossState, type BrickKind, type CapsuleKind, type WallBrick, type WallState } from "@/lib/solo/games/bashwall";
import type { SoloApi } from "../SoloShell";

type Chip = { x: number; y: number; vx: number; vy: number; r: number; c: string; life: number };
type Pop = { x: number; y: number; text: string; life: number; big: boolean };
type Ring = { x: number; y: number; life: number };

const SKIES = [
  ["#32244f", "#a04a4e", "#f09a55"],
  ["#2a2350", "#8a3f62", "#e8875a"],
  ["#1c2140", "#3f3a63", "#8a5a6a"],
  ["#0f2147", "#2a5a8a", "#e0a070"],
  ["#2d2320", "#6a4630", "#c98a4a"],
] as const;
const PAINT = ["#d9542c", "#e9b13c", "#c9764a", "#b5382f", "#e08a4f"];
const AWNING = ["#e8563a", "#2f8a4e", "#3f74d8", "#e9b13c", "#b48cff"];
const CHIP: Record<BrickKind, string> = { brick: "#d9542c", tough: "#8a8176", stall: "#c9a26a", glass: "#bfe9f3", dynamite: "#e8563a", rock: "#7d7468" };
const SOUND: Record<BrickKind, string> = { brick: "ba-brick", tough: "ba-brick", stall: "ba-wood", glass: "ba-glass", dynamite: "ba-brick", rock: "ba-rock" };
const CAPSULE: Record<CapsuleKind, [string, boolean]> = { gen: ["GEN", false], slow: ["SLOW", false], life: ["+1", false], triple: ["×3", true], hammer: ["HAMMER", true], floor: ["FLOOR", true] };
const SAY: Record<CapsuleKind, string> = { gen: "Wide plank.", slow: "Slow ball.", life: "An extra ball.", triple: "Three balls.", hammer: "Sledgehammer.", floor: "Cement floor." };

/** Each site's backdrop, painted once per size. */
function paintSite(k: number, site: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  const c = cv.getContext("2d")!;
  c.scale(k, k);
  const [a, b, d] = SKIES[site]!;
  const sky = c.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, a);
  sky.addColorStop(0.55, b);
  sky.addColorStop(1, d);
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  const dark = "#2c1c2a";
  c.fillStyle = dark;
  if (site === 0) {
    for (const [x, y, w] of [[0, 420, 46], [40, 392, 40], [84, 430, 34], [122, 376, 56], [182, 416, 40], [226, 396, 52], [282, 430, 36], [322, 404, 36]]) c.fillRect(x!, y!, w!, 480 - y!);
    c.strokeStyle = dark;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(60, 480);
    c.lineTo(60, 300);
    c.lineTo(214, 300);
    c.moveTo(60, 300);
    c.lineTo(28, 300);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(178, 300);
    c.lineTo(178, 340);
    c.stroke();
    c.fillRect(166, 340, 24, 12);
  } else if (site === 1) {
    // Market umbrellas and stall roofs.
    c.fillRect(0, 440, W, 40);
    for (let x = 20; x < W; x += 66) {
      c.fillStyle = AWNING[Math.floor(x / 66) % AWNING.length]!;
      c.beginPath();
      c.moveTo(x - 30, 412);
      c.quadraticCurveTo(x, 372, x + 30, 412);
      c.closePath();
      c.fill();
      c.fillStyle = dark;
      c.fillRect(x - 1.5, 410, 3, 40);
    }
  } else if (site === 2) {
    // The bridge above and the road the danfos use.
    c.fillRect(0, 286, W, 18);
    for (const x of [46, 176, 306]) c.fillRect(x - 9, 304, 18, 176);
    c.fillStyle = "#2b2730";
    c.fillRect(0, DANFO_Y - 6, W, DANFO_H + 12);
    c.fillStyle = "#f6c453";
    for (let x = 6; x < W; x += 36) c.fillRect(x, DANFO_Y + DANFO_H / 2 - 1, 18, 2);
  } else if (site === 3) {
    // Glass towers with lit windows.
    for (const [x, y, w] of [[8, 330, 56], [72, 276, 70], [150, 348, 50], [208, 254, 78], [296, 318, 60]]) {
      c.fillStyle = "#16294e";
      c.fillRect(x!, y!, w!, 480 - y!);
      c.fillStyle = "rgba(246,214,122,.55)";
      for (let wy = y! + 10; wy < 470; wy += 16) for (let wx = x! + 7; wx < x! + w! - 8; wx += 13) if ((wx * 3 + wy) % 5 < 3) c.fillRect(wx, wy, 7, 8);
    }
  } else {
    // Quarry cliffs.
    c.fillStyle = "#4a3324";
    c.beginPath();
    c.moveTo(0, 480);
    for (const [x, y] of [[0, 330], [46, 370], [96, 322], [148, 392], [206, 346], [262, 398], [310, 336], [358, 374], [358, 480]]) c.lineTo(x!, y!);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.2)";
    c.lineWidth = 2;
    c.beginPath();
    for (let y = 400; y < 480; y += 22) {
      c.moveTo(0, y);
      c.lineTo(W, y);
    }
    c.stroke();
  }
  c.fillStyle = "#4a2c20";
  c.fillRect(0, 480, W, 80);
  c.fillStyle = "#f6c453";
  for (let x = -10; x < W; x += 34) {
    c.beginPath();
    c.moveTo(x, 552);
    c.lineTo(x + 16, 552);
    c.lineTo(x + 26, 560);
    c.lineTo(x + 10, 560);
    c.closePath();
    c.fill();
  }
  return cv;
}

function drawBrick(c: CanvasRenderingContext2D, b: WallBrick, time: number) {
  const x = brickLeft(b, time);
  const y = brickTop(b);
  if (b.kind === "glass") {
    const g = c.createLinearGradient(x, y, x + BRICK_W, y + BRICK_H);
    g.addColorStop(0, "rgba(190,235,245,.92)");
    g.addColorStop(1, "rgba(80,160,195,.75)");
    c.fillStyle = g;
    c.strokeStyle = "rgba(235,250,255,.9)";
    c.lineWidth = 1;
    c.beginPath();
    c.rect(x, y, BRICK_W, BRICK_H);
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,.75)";
    c.beginPath();
    c.moveTo(x + 8, y + BRICK_H - 4);
    c.lineTo(x + 20, y + 4);
    c.stroke();
    return;
  }
  if (b.kind === "stall") {
    c.fillStyle = "#f3e6d3";
    c.fillRect(x, y + 6, BRICK_W, BRICK_H - 6);
    c.fillStyle = AWNING[(b.row + b.col) % AWNING.length]!;
    c.beginPath();
    c.roundRect(x - 1, y, BRICK_W + 2, 10, 3);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.65)";
    for (let s = 3; s < BRICK_W; s += 10) c.fillRect(x + s, y, 4, 10);
    return;
  }
  if (b.kind === "rock") {
    c.fillStyle = "#6a6258";
    c.beginPath();
    c.moveTo(x + 3, y + BRICK_H);
    c.lineTo(x, y + 8);
    c.lineTo(x + 10, y);
    c.lineTo(x + 34, y + 1);
    c.lineTo(x + BRICK_W, y + 9);
    c.lineTo(x + BRICK_W - 3, y + BRICK_H);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(255,255,255,.18)";
    c.fillRect(x + 11, y + 3, 20, 3);
    return;
  }
  if (b.kind === "dynamite") {
    c.fillStyle = "#b5382f";
    c.beginPath();
    c.roundRect(x, y, BRICK_W, BRICK_H, 4);
    c.fill();
    c.fillStyle = "#f6efe6";
    c.fillRect(x + 12, y, 3, BRICK_H);
    c.fillRect(x + 29, y, 3, BRICK_H);
    c.fillStyle = "#1c1416";
    c.font = "900 10px Manrope, sans-serif";
    c.textAlign = "center";
    c.fillText("TNT", x + BRICK_W / 2, y + 14);
    c.fillStyle = Math.sin(time * 14 + b.col) > 0 ? "#ffd34d" : "#ff7a2b";
    c.beginPath();
    c.arc(x + BRICK_W - 3, y + 1, 3, 0, Math.PI * 2);
    c.fill();
    return;
  }
  c.fillStyle = b.kind === "tough" ? "#7d7468" : PAINT[b.paint]!;
  c.beginPath();
  c.roundRect(x, y, BRICK_W, BRICK_H, 3);
  c.fill();
  c.fillStyle = "rgba(255,255,255,.28)";
  c.fillRect(x + 3, y + 2, BRICK_W - 6, 3);
  c.fillStyle = "rgba(0,0,0,.2)";
  c.fillRect(x, y + BRICK_H - 4, BRICK_W, 4);
  if (b.kind === "tough") {
    c.strokeStyle = "rgba(0,0,0,.35)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + 3, y + 10);
    c.lineTo(x + BRICK_W - 3, y + 10);
    c.moveTo(x + 22, y + 2);
    c.lineTo(x + 22, y + 10);
    c.stroke();
    if (b.hp === 1) {
      c.strokeStyle = "#1c1416";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x + 15, y);
      c.lineTo(x + 21, y + 8);
      c.lineTo(x + 15, y + 13);
      c.lineTo(x + 24, y + 20);
      c.stroke();
    }
  }
}

function drawDanfo(c: CanvasRenderingContext2D, x: number, vx: number) {
  c.save();
  c.translate(x, DANFO_Y);
  if (vx < 0) c.scale(-1, 1);
  c.fillStyle = "#f2b632";
  c.beginPath();
  c.roundRect(-DANFO_W / 2, 2, DANFO_W, DANFO_H - 8, 6);
  c.fill();
  c.fillStyle = "#1c1416";
  c.fillRect(-DANFO_W / 2, 19, DANFO_W, 3);
  c.fillRect(-DANFO_W / 2, 24, DANFO_W, 3);
  c.fillStyle = "#bfe0ea";
  for (const w of [-32, -14, 4, 22]) c.fillRect(w, 6, 14, 10);
  c.fillStyle = "#1c1416";
  for (const w of [-22, 24]) {
    c.beginPath();
    c.arc(w, DANFO_H - 5, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** Each site's boss. */
function drawBoss(c: CanvasRenderingContext2D, b: BossState, site: number, flash: number) {
  const x = b.x - b.w / 2;
  const y = b.y;
  c.save();
  if (site === 0) {
    c.strokeStyle = "#1c1416";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x + 22, 8);
    c.lineTo(x + 22, y);
    c.moveTo(x + b.w - 22, 8);
    c.lineTo(x + b.w - 22, y);
    c.stroke();
    c.fillStyle = "#59606a";
    c.beginPath();
    c.roundRect(x, y, b.w, b.h, 5);
    c.fill();
    c.strokeStyle = "#2b3037";
    c.lineWidth = 6;
    c.beginPath();
    for (let i = 20; i < b.w; i += 28) {
      c.moveTo(x + i, y + 3);
      c.lineTo(x + i, y + b.h - 3);
    }
    c.moveTo(x, y + b.h / 2);
    c.lineTo(x + b.w, y + b.h / 2);
    c.stroke();
    c.fillStyle = "#f6c453";
    c.beginPath();
    c.arc(b.x, y + b.h / 2, 10, 0, Math.PI * 2);
    c.fill();
  } else if (site === 1) {
    c.fillStyle = "#2c5f8f";
    c.fillRect(x, y, b.w, b.h);
    c.fillStyle = "rgba(0,0,0,.2)";
    for (let i = 6; i < b.w; i += 13) c.fillRect(x + i, y, 5, b.h);
    c.fillStyle = "#f6efe6";
    c.font = "900 15px Manrope, sans-serif";
    c.textAlign = "center";
    c.fillText("APAPA LINE", b.x, y + b.h / 2 + 5);
  } else if (site === 2) {
    c.fillStyle = "#f2b632";
    c.beginPath();
    c.roundRect(x, y, b.w, b.h - 8, 8);
    c.fill();
    c.fillStyle = "#1c1416";
    c.fillRect(x, y + 30, b.w, 4);
    c.fillStyle = "#bfe0ea";
    for (let i = 10; i < b.w - 14; i += 24) c.fillRect(x + i, y + 7, 18, 16);
    c.fillStyle = "#1c1416";
    for (const w of [x + 28, x + b.w - 28]) {
      c.beginPath();
      c.arc(w, y + b.h - 8, 9, 0, Math.PI * 2);
      c.fill();
    }
  } else if (site === 3) {
    c.fillStyle = "#6fb7cf";
    c.fillRect(x, y, b.w, b.h);
    c.strokeStyle = "#dff4f9";
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i <= b.w; i += 26) {
      c.moveTo(x + i, y);
      c.lineTo(x + i, y + b.h);
    }
    for (let j = 0; j <= b.h; j += 17) {
      c.moveTo(x, y + j);
      c.lineTo(x + b.w, y + j);
    }
    c.stroke();
    if (b.hp < b.max * 0.6) {
      c.strokeStyle = "#16294e";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 40, y);
      c.lineTo(x + 56, y + 26);
      c.lineTo(x + 44, y + 44);
      c.lineTo(x + 66, y + b.h);
      c.stroke();
    }
  } else {
    c.fillStyle = "#59606a";
    c.fillRect(x, y, b.w, b.h - 14);
    c.fillStyle = "#c9c9c9";
    c.beginPath();
    for (let i = 0; i < b.w; i += 22) {
      c.moveTo(x + i, y + b.h - 14);
      c.lineTo(x + i + 11, y + b.h);
      c.lineTo(x + i + 22, y + b.h - 14);
    }
    c.fill();
    c.fillStyle = "#f6c453";
    for (let i = 0; i < b.w; i += 34) c.fillRect(x + i, y + 8, 17, 8);
  }
  if (flash > 0) {
    c.fillStyle = `rgba(255,255,255,${Math.min(0.6, flash * 6)})`;
    c.fillRect(x, y, b.w, b.h);
  }
  c.restore();
}

function drawPlank(c: CanvasRenderingContext2D, cx: number, w: number, shrunk: boolean) {
  const x = cx - w / 2;
  c.fillStyle = "rgba(0,0,0,.35)";
  c.beginPath();
  c.roundRect(x, PLANK_Y + 5, w, 16, 5);
  c.fill();
  const g = c.createLinearGradient(0, PLANK_Y, 0, PLANK_Y + 16);
  g.addColorStop(0, shrunk ? "#a9c9d4" : "#dcae72");
  g.addColorStop(1, shrunk ? "#5c8796" : "#8a5a23");
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(x, PLANK_Y, w, 16, 5);
  c.fill();
  c.fillStyle = "#f6c453";
  c.fillRect(x + 2, PLANK_Y + 2, 12, 12);
  c.fillRect(x + w - 14, PLANK_Y + 2, 12, 12);
  c.fillStyle = "#1c1416";
  for (const e of [x + 5, x + w - 11]) {
    c.fillRect(e, PLANK_Y + 2, 3, 12);
    c.fillRect(e + 6, PLANK_Y + 2, 3, 12);
  }
}

export function BashWall({ api }: { api: SoloApi<WallState> }) {
  const wall = wallOfMode(api.mode) ?? 1;
  const site = siteOf(wall);
  const [s, setS] = useState<WallState>(() => {
    const fresh = newWall(api.seed, wall, api.extras?.owned ?? []);
    return api.saved ? { ...fresh, ...api.saved } : fresh;
  });
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<HTMLCanvasElement | null>(null);
  const target = useRef(s.plank);
  const keys = useRef({ left: false, right: false });
  const chips = useRef<Chip[]>([]);
  const pops = useRef<Pop[]>([]);
  const rings = useRef<Ring[]>([]);
  const trails = useRef(new Map<number, { x: number; y: number }[]>());
  const shake = useRef(0);
  const flash = useRef(0);
  const banner = useRef<{ text: string; life: number } | null>({ text: isBossWall(wall) ? SITES[site]!.boss : `Wall ${wall}`, life: 1.6 });
  const [said, setSaid] = useState("");
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const audio = useRef<GameAudio | null>(null);
  const flame = useRef<LoopHandle | null>(null);
  const calm = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  const go = useCallback(() => {
    const a = apiRef.current;
    audio.current?.wake();
    if (a.paused) return;
    state.current = launchWall(a.seed, state.current);
  }, []);

  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(["ba-brick", "ba-wood", "ba-glass", "ba-plank", "ba-combo", "ba-fire", "ba-clear"]);
    flame.current = au.loop("ba-flame", { volume: 0 });
    return () => {
      flame.current = null;
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
      backdrop.current = paintSite(el.width / W, site);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [site]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let clock = 0;
    let steps = 0;
    const burst = (x: number, y: number, color: string, n: number) => {
      for (let i = 0; i < (calm ? Math.ceil(n / 3) : n); i++) chips.current.push({ x, y, vx: (Math.random() - 0.5) * 230, vy: -Math.random() * 170, r: 3 + Math.random() * 4, c: color, life: 1 });
    };
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const a = apiRef.current;
      const au = audio.current;
      const running = !a.paused && !state.current.over;
      if (running) {
        clock += dt;
        if (keys.current.left) target.current -= 420 * dt;
        if (keys.current.right) target.current += 420 * dt;
        target.current = Math.max(0, Math.min(W, target.current));
        acc += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          const before = state.current.combo;
          const r = stepWall(a.seed, state.current, target.current);
          state.current = r.state;
          steps++;
          for (const h of r.ev.hits) {
            au?.sfx(h.broke ? SOUND[h.kind] : h.kind === "rock" ? "ba-rock" : "ba-block", { volume: 0.8, rate: 0.92 + Math.random() * 0.16 });
            if (h.broke) burst(h.x, h.y, CHIP[h.kind], h.kind === "glass" ? 14 : 10);
            changed = true;
          }
          if (state.current.combo > before) {
            const n = state.current.combo;
            if (n > 1) {
              au?.sfx("ba-combo", { rate: 1 + n * 0.12, volume: 0.7 });
              const h = r.ev.hits[0];
              if (h) pops.current.push({ x: h.x, y: h.y, text: `×${n}`, life: 0.8, big: false });
            }
          }
          if (r.ev.hot) {
            au?.sfx("ba-fire");
            navigator.vibrate?.(40);
            shake.current = 6;
            pops.current.push({ x: W / 2, y: 262, text: "Fire ball!", life: 1.6, big: true });
            setSaid("Fire ball! It smashes straight through.");
          }
          for (const b of r.ev.blasts) {
            au?.sfx("ba-blast");
            rings.current.push({ x: b.x, y: b.y, life: 1 });
            burst(b.x, b.y, "#ffb03a", 18);
            shake.current = 7;
          }
          if (r.ev.plank) au?.sfx("ba-plank", { volume: 0.7 });
          if (r.ev.bounce) au?.sfx("ba-bounce", { volume: 0.5 });
          if (r.ev.horn) {
            au?.sfx("ba-danfo", { volume: 0.7 });
            au?.voice("ba-danfo", 12);
          }
          if (r.ev.danfoHit) {
            au?.sfx("ba-steel", { volume: 0.4, rate: 1.5 });
            shake.current = Math.max(shake.current, 3);
          }
          if (r.ev.shard) {
            au?.sfx("ba-shard");
            setSaid("A shard hit your plank. It's shorter for a while.");
          }
          if (r.ev.caught) {
            au?.sfx("ba-capsule");
            navigator.vibrate?.(20);
            setSaid(SAY[r.ev.caught]);
            changed = true;
          }
          if (r.ev.saved) {
            au?.sfx("ba-floor");
            setSaid("The cement floor saved that ball.");
          }
          if (r.ev.bossHit) {
            flash.current = 0.1;
            au?.sfx("ba-steel", { volume: 0.7, rate: 0.9 + Math.random() * 0.2 });
            burst(r.ev.bossHit.x, r.ev.bossHit.y, "#c9c9c9", 6);
            changed = true;
          }
          if (r.ev.relay) {
            banner.current = { text: "The guard is back!", life: 1.4 };
            setSaid("The boss's guard has rebuilt.");
          }
          if (r.ev.bossDown) {
            shake.current = 9;
            setSaid(`${SITES[site]!.boss} is down.`);
          }
          if (r.ev.lost) {
            au?.sfx("ba-drop");
            navigator.vibrate?.([40, 40, 40]);
            banner.current = r.ev.crushed ? { text: "It crushed your ball!", life: 1.4 } : null;
            setSaid(state.current.lives > 0 ? `Dropped it. ${state.current.lives} left.` : "No balls left.");
            changed = true;
          }
          if (r.ev.won) {
            au?.sfx("ba-clear");
            banner.current = { text: "Wall don fall!", life: 3 };
            shake.current = 8;
            changed = true;
          }
          if (steps % 40 === 0) changed = true;
          if (state.current.over) break;
        }
        chips.current = chips.current.filter((ch) => {
          ch.x += ch.vx * dt;
          ch.y += ch.vy * dt;
          ch.vy += 600 * dt;
          ch.life -= dt * 1.4;
          return ch.life > 0;
        });
        pops.current = pops.current.filter((p) => ((p.y -= 28 * dt), (p.life -= dt), p.life > 0));
        rings.current = rings.current.filter((r) => ((r.life -= dt * 2.2), r.life > 0));
        const seen = new Set<number>();
        for (const b of state.current.balls) {
          seen.add(b.id);
          trails.current.set(b.id, [...(trails.current.get(b.id) ?? []), { x: b.x, y: b.y }].slice(state.current.hot > 0 ? -12 : -6));
        }
        for (const id of trails.current.keys()) if (!seen.has(id)) trails.current.delete(id);
        shake.current = Math.max(0, shake.current - dt * 20);
        flash.current = Math.max(0, flash.current - dt);
        if (banner.current) banner.current.life -= dt;
        if (changed) setS(state.current);
      } else acc = 0;
      flame.current?.setVolume(running && state.current.hot > 0 ? 0.6 : 0);

      const el = canvas.current;
      const c = el?.getContext("2d");
      if (el && c) {
        const k = el.width / W;
        const st = state.current;
        const jolt = calm ? 0 : shake.current;
        c.setTransform(1, 0, 0, 1, 0, 0);
        if (backdrop.current) c.drawImage(backdrop.current, 0, 0);
        c.setTransform(k, 0, 0, k, jolt ? (Math.random() - 0.5) * jolt * k : 0, jolt ? (Math.random() - 0.5) * jolt * k : 0);
        for (const d of st.danfos) drawDanfo(c, d.x, d.vx);
        if (st.boss) drawBoss(c, st.boss, site, flash.current);
        for (const b of st.bricks) drawBrick(c, b, st.time);
        for (const r of rings.current) {
          c.strokeStyle = `rgba(255,190,80,${r.life})`;
          c.lineWidth = 6 * r.life;
          c.beginPath();
          c.arc(r.x, r.y, 90 * (1 - r.life) + 10, 0, Math.PI * 2);
          c.stroke();
        }
        for (const ch of chips.current) {
          c.globalAlpha = Math.max(0, ch.life);
          c.fillStyle = ch.c;
          c.fillRect(ch.x, ch.y, ch.r, ch.r * 0.7);
        }
        c.globalAlpha = 1;
        c.fillStyle = "#d8f3f8";
        c.strokeStyle = "#5aa7c2";
        c.lineWidth = 1;
        for (const sh of st.shards) {
          c.save();
          c.translate(sh.x, sh.y);
          c.rotate(sh.y / 22);
          c.beginPath();
          c.moveTo(0, -10);
          c.lineTo(7, 7);
          c.lineTo(-6, 5);
          c.closePath();
          c.fill();
          c.stroke();
          c.restore();
        }
        for (const cap of st.capsules) {
          const [label, fresh] = CAPSULE[cap.kind];
          const w = label.length > 4 ? 62 : 48;
          c.fillStyle = fresh ? "#d9542c" : "#f6c453";
          c.strokeStyle = "#1c1416";
          c.lineWidth = 1.5;
          c.beginPath();
          c.roundRect(cap.x - w / 2, cap.y - 10, w, 20, 10);
          c.fill();
          c.stroke();
          c.fillStyle = fresh ? "#f8f0e4" : "#1c1416";
          c.font = "800 9px Manrope, sans-serif";
          c.textAlign = "center";
          c.fillText(label, cap.x, cap.y + 3.5);
        }
        if (st.floor) {
          c.fillStyle = "#b9b2a6";
          c.fillRect(0, H - 26, W, 8);
          c.fillStyle = "rgba(0,0,0,.2)";
          c.fillRect(0, H - 20, W, 2);
        }
        const hot = st.hot > 0;
        if (!calm)
          for (const tr of trails.current.values())
            tr.forEach((p, i) => {
              c.fillStyle = hot ? `rgba(255,${120 + i * 8},40,${0.07 * (i + 1)})` : `rgba(255,255,255,${0.06 * (i + 1)})`;
              c.beginPath();
              c.arc(p.x, p.y, BALL_R * (hot ? 0.7 + i * 0.09 : 0.4 + i * 0.1), 0, Math.PI * 2);
              c.fill();
            });
        for (const b of st.balls) {
          const g = c.createRadialGradient(b.x - 3, b.y - 3, 0.5, b.x, b.y, BALL_R);
          g.addColorStop(0, "#fff");
          g.addColorStop(0.5, hot ? "#ffb03a" : st.hammerFor > 0 ? "#c9d2dc" : "#e9e3da");
          g.addColorStop(1, hot ? "#d9341f" : st.hammerFor > 0 ? "#47505c" : "#8f857c");
          c.fillStyle = g;
          c.beginPath();
          c.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
          c.fill();
        }
        drawPlank(c, st.plank, plankSize(st), st.shrinkFor > 0);
        for (const p of pops.current) {
          c.globalAlpha = Math.min(1, p.life * 1.6);
          c.textAlign = "center";
          c.font = `900 ${p.big ? 38 : 18}px Fraunces, serif`;
          c.lineWidth = p.big ? 5 : 3;
          c.strokeStyle = "#1c1416";
          c.fillStyle = p.big ? "#ffb03a" : "#f8f0e4";
          c.strokeText(p.text, p.x, p.y);
          c.fillText(p.text, p.x, p.y);
        }
        c.globalAlpha = 1;
        c.setTransform(k, 0, 0, k, 0, 0);
        // Boss health along the top.
        if (st.boss) {
          c.fillStyle = "rgba(0,0,0,.6)";
          c.beginPath();
          c.roundRect(14, 13, W - 28, 12, 6);
          c.fill();
          c.fillStyle = "#e8563a";
          c.beginPath();
          c.roundRect(16, 15, Math.max(6, (W - 32) * (st.boss.hp / st.boss.max)), 8, 4);
          c.fill();
        }
        // Balls left and what's running.
        for (let i = 0; i < st.lives; i++) {
          c.fillStyle = "#f8f0e4";
          c.beginPath();
          c.arc(W - 16 - i * 16, 538, 5.5, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "rgba(248,240,228,.9)";
        c.font = "700 11px Manrope, sans-serif";
        c.textAlign = "left";
        c.fillText(isBossWall(wall) ? SITES[site]!.boss : `${SITES[site]!.name}, wall ${indexOf(wall)} of 10`, 12, 542);
        const running2 = [st.wideFor > 0 ? `Wide ${Math.ceil(st.wideFor)}s` : "", st.slowFor > 0 ? `Slow ${Math.ceil(st.slowFor)}s` : "", st.hammerFor > 0 ? `Hammer ${Math.ceil(st.hammerFor)}s` : "", st.shrinkFor > 0 ? `Short plank ${Math.ceil(st.shrinkFor)}s` : ""].filter(Boolean).join(", ");
        if (running2) {
          c.fillStyle = "#f6c453";
          c.fillText(running2, 12, 526);
        }
        if (!st.launched && !st.over) {
          c.fillStyle = "rgba(248,240,228,.95)";
          c.font = "800 15px Manrope, sans-serif";
          c.textAlign = "center";
          c.globalAlpha = 0.6 + Math.sin(clock * 4) * 0.4;
          c.fillText("Tap to launch", W / 2, PLANK_Y - 40);
          c.globalAlpha = 1;
        }
        if (banner.current && banner.current.life > 0) {
          const text = banner.current.text;
          c.globalAlpha = Math.min(1, banner.current.life);
          c.font = `900 ${text.length > 14 ? 26 : 34}px Fraunces, serif`;
          c.textAlign = "center";
          c.lineWidth = 4;
          c.strokeStyle = "#1c1416";
          c.fillStyle = "#f8f0e4";
          c.strokeText(text, W / 2, 300);
          c.fillText(text, W / 2, 300);
          c.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm, site, wall]);

  useEffect(() => {
    api.save(s);
    if (!s.over || ended.current) return;
    ended.current = true;
    flame.current?.setVolume(0);
    if (!s.won) audio.current?.sfx("mq-lose");
    try {
      sessionStorage.setItem("amah:bash:last", JSON.stringify({ wall: s.wall, dropped: s.dropped, broken: s.broken }));
    } catch {
      // The finish screen just shows less.
    }
    const score = s.won ? takings(s.wall, s.dropped) : 0;
    // A moment to watch the wall come down before the finish screen.
    setTimeout(() => apiRef.current.end(score, { wall: s.wall, dropped: s.dropped, broken: s.broken, won: s.won }), 1300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = true;
      else if (e.key === "ArrowRight" || e.key === "d") keys.current.right = true;
      else if (e.key === " " || e.key === "ArrowUp") go();
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
  }, [go]);

  const toLogical = (clientX: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  };
  const fire = s.hot > 0;

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="display text-[1.5rem] leading-none">Wall {wall}</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <canvas
        ref={canvas}
        data-tour="bash-wall"
        role="img"
        aria-label={`Bash Am, wall ${wall}. ${s.bricks.length} bricks left, ${s.lives} balls. Drag to move the plank, tap to launch.`}
        className="mt-3 w-full touch-none rounded-[22px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={(e) => {
          audio.current?.wake();
          target.current = toLogical(e.clientX);
          if (!state.current.launched) go();
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) target.current = toLogical(e.clientX);
        }}
      />
      <div className="mt-3 flex items-center gap-2.5 px-1 text-[0.82rem] font-extrabold">
        <span>Streak</span>
        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(28,20,22,.14)]">
          <span className="block h-full rounded-full bg-[#e8742b] transition-[width] duration-150" style={{ width: `${fire ? 100 : (s.combo / STREAK) * 100}%` }} />
        </span>
        <span className="min-w-[3.6rem] text-right tabular-nums">{fire ? "On fire!" : `${s.combo} of ${STREAK}`}</span>
      </div>
      <p data-tour="bash-plank" className="mt-2 text-center text-[0.82rem] text-muted">
        {site === 3 ? "Dodge the falling glass. It shortens your plank." : site === 2 ? "Watch the road. Danfos knock your ball off course." : site === 4 ? "Hit the dynamite to clear the bricks around it." : "Drag anywhere to move the plank. Catch what falls."}
      </p>
    </div>
  );
}
