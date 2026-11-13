"use client";

import { useEffect, useRef, useState } from "react";
import { H, RIM_Y, STEP, START_LIVES, W, multiplier, newCatch, stepCatch, type CatchState, type ItemKind } from "@/lib/solo/games/catch";
import type { SoloApi } from "../SoloShell";

type Pop = { x: number; y: number; text: string; color: string; life: number };
const SPRITE = 64; // sprite size in logical px (drawn at the item's size)

let seedN = 5;
const rnd = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;

/** The market behind: sky, stalls with umbrellas, a sandy ground. Painted once per size. */
function paintBackdrop(k: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  const c = cv.getContext("2d")!;
  c.scale(k, k);
  const sky = c.createLinearGradient(0, 0, 0, 390);
  sky.addColorStop(0, "#8fd3f0");
  sky.addColorStop(1, "#fbe7c4");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  c.filter = "blur(1.6px)";
  const stalls: [number, string, string][] = [[-10, "#e8563a", "#f6efe6"], [110, "#3f74d8", "#e9b13c"], [230, "#2f8a4e", "#f6efe6"]];
  for (const [x, a, b] of stalls) {
    c.fillStyle = a;
    c.beginPath();
    c.moveTo(x, 250);
    c.quadraticCurveTo(x + 70, 190, x + 140, 250);
    c.fill();
    c.fillStyle = b;
    c.globalAlpha = 0.7;
    c.beginPath();
    c.moveTo(x + 35, 250);
    c.lineTo(x + 70, 192);
    c.lineTo(x + 105, 250);
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = "#5a3a1a";
    c.fillRect(x + 66, 250, 6, 140);
    c.fillStyle = "#8a5a23";
    c.fillRect(x + 10, 340, 120, 50);
    ["#e8563a", "#e9b13c", "#7cd36b", "#f08a3a", "#e8563a", "#b8401f"].forEach((col, i) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(x + 22 + i * 19, 336, 8, 0, Math.PI * 2);
      c.fill();
    });
  }
  c.filter = "none";
  c.fillStyle = "#c99a5e";
  c.fillRect(0, 390, W, H - 390);
  c.fillStyle = "rgba(0,0,0,.12)";
  c.fillRect(0, 390, W, 8);
  for (let i = 0; i < 40; i++) {
    c.fillStyle = "rgba(90,58,26,.25)";
    c.beginPath();
    c.arc(rnd() * W, 400 + rnd() * 160, 1 + rnd() * 1.5, 0, Math.PI * 2);
    c.fill();
  }
  return cv;
}

/** Food sprites, drawn once at high resolution. */
function paintSprite(kind: ItemKind, k: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.round(SPRITE * k);
  const c = cv.getContext("2d")!;
  c.scale(k, k);
  c.translate(SPRITE / 2, SPRITE / 2);
  const r = 24;
  if (kind === "puff" || kind === "gold") {
    const g = c.createRadialGradient(-6, -8, 2, 0, 0, r);
    if (kind === "gold") {
      g.addColorStop(0, "#fff6c8");
      g.addColorStop(0.55, "#f6c453");
      g.addColorStop(1, "#b37d10");
    } else {
      g.addColorStop(0, "#ffd27a");
      g.addColorStop(0.6, "#e09a2e");
      g.addColorStop(1, "#a8620f");
    }
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(138,74,10,.35)";
    for (let i = 0; i < 40; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r * 0.9;
      c.beginPath();
      c.arc(Math.cos(a) * d, Math.sin(a) * d, 0.9, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#fff";
    for (let i = 0; i < 18; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r * 0.75;
      c.fillRect(Math.cos(a) * d, Math.sin(a) * d - 4, 1.4, 1.4);
    }
    c.fillStyle = "rgba(255,255,255,.4)";
    c.beginPath();
    c.ellipse(-8, -10, 8, 5, -0.4, 0, Math.PI * 2);
    c.fill();
    if (kind === "gold") {
      c.strokeStyle = "rgba(255,255,255,.9)";
      c.lineWidth = 2;
      c.beginPath();
      for (const a of [0.6, 2.2, 4.1]) {
        c.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3));
        c.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
      }
      c.stroke();
    }
  } else if (kind === "akara") {
    c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2, rr = r * (0.88 + rnd() * 0.18);
      c[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr * 0.86);
    }
    c.closePath();
    const g = c.createRadialGradient(-6, -6, 2, 0, 0, r);
    g.addColorStop(0, "#e0943a");
    g.addColorStop(0.7, "#b8601a");
    g.addColorStop(1, "#7a3510");
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "#6b2f0c";
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = "rgba(122,53,16,.6)";
    for (let i = 0; i < 10; i++) {
      c.beginPath();
      c.arc((rnd() - 0.5) * r * 1.2, (rnd() - 0.5) * r, 1 + rnd() * 2.4, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "rgba(255,220,150,.45)";
    c.beginPath();
    c.ellipse(-7, -8, 7, 3.5, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    // Scotch bonnet pepper.
    const g = c.createRadialGradient(-6, -4, 2, 0, 2, r);
    g.addColorStop(0, "#ff7a5a");
    g.addColorStop(0.6, "#e02a1a");
    g.addColorStop(1, "#8a0f0a");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -14);
    c.bezierCurveTo(-22, -12, -22, 18, 0, 18);
    c.bezierCurveTo(22, 18, 22, -12, 0, -14);
    c.fill();
    c.strokeStyle = "#7a0f0a";
    c.lineWidth = 1;
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,.55)";
    c.lineWidth = 3;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-8, -4);
    c.quadraticCurveTo(-10, 4, -6, 10);
    c.stroke();
    c.fillStyle = "#2f6b2d";
    c.beginPath();
    c.moveTo(0, -14);
    c.quadraticCurveTo(2, -24, 10, -26);
    c.lineTo(12, -22);
    c.quadraticCurveTo(5, -20, 4, -13);
    c.fill();
  }
  return cv;
}

const SIZE: Record<ItemKind, number> = { puff: 34, gold: 36, akara: 38, pepper: 34 };

function drawBasket(c: CanvasRenderingContext2D, x: number, sprites: Record<ItemKind, HTMLCanvasElement>, pile: ItemKind[]) {
  const y = RIM_Y;
  c.fillStyle = "rgba(0,0,0,.25)";
  c.beginPath();
  c.ellipse(x, y + 58, 66, 10, 0, 0, Math.PI * 2);
  c.fill();
  // What's inside peeks over the rim.
  pile.slice(-4).forEach((k, i) => {
    const px = x + [-24, 10, 32, -6][i]!;
    c.drawImage(sprites[k], px - 15, y - 22 + (i % 2) * 4, 30, 30);
  });
  const g = c.createLinearGradient(0, y, 0, y + 54);
  g.addColorStop(0, "#d9a85e");
  g.addColorStop(1, "#9c6a2a");
  c.fillStyle = g;
  c.strokeStyle = "#5a3a1a";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x - 62, y);
  c.lineTo(x - 50, y + 52);
  c.quadraticCurveTo(x, y + 64, x + 50, y + 52);
  c.lineTo(x + 62, y);
  c.closePath();
  c.fill();
  c.stroke();
  // Weave.
  c.strokeStyle = "rgba(122,79,26,.7)";
  c.lineWidth = 1.6;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    c.moveTo(x - 58 + i * 13, y + 2);
    c.lineTo(x - 48 + i * 11, y + 54);
  }
  for (const yy of [12, 24, 36, 48]) {
    c.moveTo(x - 60 + yy * 0.2, y + yy);
    c.quadraticCurveTo(x, y + yy + 8, x + 60 - yy * 0.2, y + yy);
  }
  c.stroke();
  c.lineWidth = 5;
  c.strokeStyle = "#5a3a1a";
  c.beginPath();
  c.ellipse(x, y, 62, 10, 0, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 2;
  c.strokeStyle = "#d9a85e";
  c.beginPath();
  c.ellipse(x, y - 1, 62, 10, 0, 0, Math.PI * 2);
  c.stroke();
}

export function CatchAm({ api }: { api: SoloApi<CatchState> }) {
  const [s, setS] = useState<CatchState>(() => api.saved ?? newCatch(api.seed));
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<HTMLCanvasElement | null>(null);
  const sprites = useRef<Record<ItemKind, HTMLCanvasElement> | null>(null);
  const target = useRef(s.basket);
  const keys = useRef({ left: false, right: false });
  const pops = useRef<Pop[]>([]);
  const pile = useRef<ItemKind[]>([]);
  const flash = useRef(0);
  const [said, setSaid] = useState("");
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      const k = el.width / W;
      backdrop.current = paintBackdrop(k);
      sprites.current = { puff: paintSprite("puff", k), gold: paintSprite("gold", k), akara: paintSprite("akara", k), pepper: paintSprite("pepper", k) };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        if (keys.current.left) target.current -= 380 * dt;
        if (keys.current.right) target.current += 380 * dt;
        target.current = Math.max(0, Math.min(W, target.current));
        acc += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          const r = stepCatch(a.seed, state.current, target.current);
          state.current = r.state;
          steps++;
          for (const c of r.ev.caught) {
            a.sound(c.kind === "gold" ? "win" : "flip");
            pile.current.push(c.kind);
            pops.current.push({ x: c.x, y: RIM_Y - 30, text: `+${c.points}`, color: "#fff", life: 1 });
            if (multiplier(state.current.combo) > multiplier(state.current.combo - 1)) pops.current.push({ x: W / 2, y: 330, text: `×${multiplier(state.current.combo)} combo!`, color: "#e8563a", life: 1.3 });
            changed = true;
          }
          if (r.ev.burned) {
            a.sound("lose");
            navigator.vibrate?.([60, 40, 60]);
            flash.current = 1;
            pops.current.push({ x: state.current.basket, y: RIM_Y - 34, text: "Hot!", color: "#e02a1a", life: 1.2 });
            setSaid(state.current.lives > 0 ? `Pepper! ${state.current.lives} lives left.` : "Too much pepper. Game over.");
            changed = true;
          }
          if (steps % 30 === 0) changed = true;
          if (state.current.over) break;
        }
        pops.current = pops.current.filter((p) => {
          p.y -= 40 * dt;
          p.life -= dt;
          return p.life > 0;
        });
        flash.current = Math.max(0, flash.current - dt * 2);
        if (changed) setS(state.current);
      } else acc = 0;
      const el = canvas.current;
      const c = el?.getContext("2d");
      const sp = sprites.current;
      if (el && c && sp) {
        const k = el.width / W;
        c.setTransform(1, 0, 0, 1, 0, 0);
        if (backdrop.current) c.drawImage(backdrop.current, 0, 0);
        c.setTransform(k, 0, 0, k, 0, 0);
        const st = state.current;
        for (const it of st.items) {
          // Motion lines behind falling food.
          c.strokeStyle = "rgba(255,255,255,.7)";
          c.lineWidth = 2;
          c.lineCap = "round";
          c.beginPath();
          c.moveTo(it.x, it.y - 30);
          c.lineTo(it.x, it.y - 18);
          c.stroke();
          const sz = SIZE[it.kind];
          c.save();
          c.translate(it.x, it.y);
          c.rotate(it.kind === "pepper" ? Math.sin(it.rot) * 0.4 : it.rot);
          c.drawImage(sp[it.kind], -sz / 2 - 6, -sz / 2 - 6, sz + 12, sz + 12);
          c.restore();
          if (it.kind === "pepper" && it.y > 60) {
            c.fillStyle = "#e02a1a";
            c.font = "800 10px Manrope, sans-serif";
            c.textAlign = "left";
            c.fillText("Hot!", it.x + 18, it.y - 10);
          }
        }
        drawBasket(c, st.basket, sp, pile.current);
        for (const p of pops.current) {
          c.globalAlpha = Math.min(1, p.life);
          c.font = "900 22px Fraunces, serif";
          c.textAlign = "center";
          c.lineWidth = 3;
          c.strokeStyle = "#1c1416";
          c.strokeText(p.text, p.x, p.y);
          c.fillStyle = p.color;
          c.fillText(p.text, p.x, p.y);
        }
        c.globalAlpha = 1;
        // Lives as peppers.
        for (let i = 0; i < START_LIVES; i++) {
          c.globalAlpha = i < START_LIVES - st.lives ? 1 : 0.18;
          c.drawImage(sp.pepper, 10 + i * 24, H - 34, 26, 26);
        }
        c.globalAlpha = 1;
        c.fillStyle = "#5a3a1a";
        c.font = "700 10px Manrope, sans-serif";
        c.textAlign = "left";
        c.fillText(st.lives > 1 ? `${st.lives} more peppers and you're out` : "One more pepper and you're out", 88, H - 17);
        if (flash.current > 0) {
          c.fillStyle = `rgba(224,42,26,${flash.current * 0.25})`;
          c.fillRect(0, 0, W, H);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    api.save(s);
    if (s.over && !ended.current) {
      ended.current = true;
      api.end(s.score, { caught: s.caught });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = true;
      else if (e.key === "ArrowRight" || e.key === "d") keys.current.right = true;
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

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="text-right">
          <span className="display text-[1.6rem] leading-none tabular">{s.caught}</span>
          <span className="block text-[0.78rem] font-semibold text-muted">caught{s.combo >= 3 ? ` · ×${multiplier(s.combo)}` : ""}</span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <canvas
        ref={canvas}
        data-tour="catch-market"
        role="img"
        aria-label={`Catch Am. ${s.score} points, ${s.lives} lives. Drag or use the arrow keys to move the basket.`}
        className="mt-3 w-full touch-none rounded-[22px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={(e) => (target.current = toLogical(e.clientX))}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) target.current = toLogical(e.clientX);
        }}
      />
      <p data-tour="catch-basket" className="mt-3 text-center text-[0.82rem] text-muted">Drag the basket. Golden puff-puff is worth triple, and three catches in a row start a combo.</p>
    </div>
  );
}
