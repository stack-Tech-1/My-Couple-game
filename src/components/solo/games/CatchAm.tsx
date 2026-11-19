"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATCH_LAST, H, RIM_Y, STEP, START_LIVES, W, multiplier, newCatch, stepCatch, type CatchLast, type CatchState, type ItemKind } from "@/lib/solo/games/catch";
import { GameAudio } from "@/lib/game-audio";
import { RATIO } from "./catch-art";
import type { SoloApi } from "../SoloShell";

type Pop = { x: number; y: number; text: string; color: string; life: number; big?: boolean };
/** Crumbs, sugar sparkles, pepper smoke and sand dust: looks only. */
type Bit = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string; kind: "dot" | "smoke" };

const SOUNDS = ["ca-catch", "ca-gold", "ca-pepper", "ca-miss", "ca-combo", "ca-faster", "ca-lose"];
const CRUMB: Record<ItemKind, string[]> = { puff: ["#e09a2e", "#ffd27a", "#fff"], gold: ["#f6c453", "#fff6c8", "#fff"], akara: ["#b8601a", "#e0943a", "#7a3510"], pepper: ["#e02a1a"] };
/** The pace picks up every 30 seconds until two minutes. */
const FASTER_EVERY = 30;
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

const imgs = new Map<string, HTMLImageElement>();
/** A painted picture, once it has loaded (null until then; the drawn look stands in). */
function art(name: string) {
  if (!RATIO[name]) return null;
  let im = imgs.get(name);
  if (!im) {
    im = new Image();
    im.src = `/games/catch/${name}.webp`;
    imgs.set(name, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

/** Which painting each falling item uses: the puff-puff and akara take turns, so it doesn't look repeated. */
const foodArt = (kind: ItemKind, id: number) => (kind === "puff" ? `puff-${(id % 3) + 1}` : kind === "akara" ? `akara-${(id % 2) + 1}` : kind === "pepper" ? `pepper-${(id % 2) + 1}` : "gold");

/** The painted basket fills up as the catch grows. All three line up at the bottom. */
const BASKET_W = 128;
function drawBasketArt(c: CanvasRenderingContext2D, x: number, caught: number, squash: number) {
  const name = caught < 6 ? "basket-0" : caught < 20 ? "basket-1" : "basket-2";
  const im = art(name);
  if (!im) return false;
  // The empty basket's rim sits on the catch line; the fuller ones grow upwards from the same base.
  const base = RIM_Y - 0.12 * (BASKET_W / RATIO["basket-0"]!) + BASKET_W / RATIO["basket-0"]!;
  const h = BASKET_W / RATIO[name]!;
  c.fillStyle = "rgba(0,0,0,.22)";
  c.beginPath();
  c.ellipse(x, base - 2, 64, 9, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(x, base);
  c.scale(1 + squash * 0.08, 1 - squash * 0.12);
  c.drawImage(im, -BASKET_W / 2, -h, BASKET_W, h);
  c.restore();
  return true;
}

function drawBasket(c: CanvasRenderingContext2D, x: number, sprites: Record<ItemKind, HTMLCanvasElement>, pile: ItemKind[], squash = 0) {
  const y = RIM_Y;
  // A catch squashes the basket for a moment, around its base.
  c.save();
  c.translate(x, y + 56);
  c.scale(1 + squash * 0.08, 1 - squash * 0.12);
  c.translate(-x, -(y + 56));
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
  c.restore();
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
  const bits = useRef<Bit[]>([]);
  const shake = useRef(0);
  const squash = useRef(0);
  const goldGlow = useRef(0);
  const stats = useRef({ gold: 0, bestCombo: 0 });
  const stage = useRef(Math.floor(s.time / FASTER_EVERY));
  const [said, setSaid] = useState("");
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const audio = useRef<GameAudio | null>(null);
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    // Start every game picture loading now (the seller is only for the finish).
    for (const name of Object.keys(RATIO)) if (!name.startsWith("seller")) art(name);
    try {
      // A fresh game: the last one's numbers mustn't show on this one's finish.
      sessionStorage.removeItem(CATCH_LAST);
    } catch {
      // Nothing to clear.
    }
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the game
  }, []);

  const spray = useCallback(
    (x: number, y: number, colors: string[], n: number, up: number, size = 2.4) => {
      for (let i = 0; i < (calm ? Math.ceil(n / 4) : n); i++) {
        const a = Math.PI + Math.random() * Math.PI;
        const v = 40 + Math.random() * up;
        bits.current.push({ x: x + (Math.random() - 0.5) * 40, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.5, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length]!, kind: "dot" });
      }
    },
    [calm],
  );

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
      const au = audio.current;
      const playing = !a.paused && !state.current.over;
      if (playing) {
        if (keys.current.left) target.current -= 380 * dt;
        if (keys.current.right) target.current += 380 * dt;
        target.current = Math.max(0, Math.min(W, target.current));
        acc += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          const before = state.current;
          const r = stepCatch(a.seed, state.current, target.current);
          state.current = r.state;
          steps++;
          const st = state.current;
          for (const c of r.ev.caught) {
            const m = multiplier(st.combo);
            pile.current.push(c.kind);
            squash.current = 1;
            spray(c.x, RIM_Y - 4, CRUMB[c.kind], c.kind === "gold" ? 22 : 9, c.kind === "gold" ? 150 : 80, c.kind === "gold" ? 3 : 2.2);
            if (c.kind === "gold") {
              stats.current.gold++;
              goldGlow.current = 1;
              au?.sfx("ca-gold", { volume: 0.9 });
            } else au?.sfx("ca-catch", { rate: 1 + Math.min(12, st.combo) * 0.03, volume: 0.85 });
            stats.current.bestCombo = Math.max(stats.current.bestCombo, st.combo);
            pops.current.push({ x: c.x, y: RIM_Y - 30, text: `+${c.points}`, color: c.kind === "gold" ? "#f6c453" : "#fff", life: 1 });
            if (m > multiplier(st.combo - 1)) {
              pops.current.push({ x: W / 2, y: 330, text: `×${m} combo!`, color: "#e8563a", life: 1.3, big: true });
              au?.sfx("ca-combo", { rate: 1 + (m - 2) * 0.12, volume: 0.85 });
            }
            changed = true;
          }
          if (r.ev.burned) {
            au?.sfx(st.lives > 0 ? "ca-pepper" : "ca-lose", { volume: 0.9 });
            navigator.vibrate?.([60, 40, 60]);
            flash.current = 1;
            shake.current = calm ? 0 : 1;
            for (let i = 0; i < (calm ? 3 : 10); i++)
              bits.current.push({ x: st.basket + (Math.random() - 0.5) * 70, y: RIM_Y - 6, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 40, life: 1 + Math.random() * 0.6, size: 8 + Math.random() * 8, color: "rgba(80,70,70,", kind: "smoke" });
            pops.current.push({ x: st.basket, y: RIM_Y - 34, text: "Hot!", color: "#e02a1a", life: 1.2, big: true });
            setSaid(st.lives > 0 ? `Pepper! ${st.lives} lives left.` : "Too much pepper. Game over.");
            changed = true;
          }
          // Food that fell past the basket kicks up a little sand where it lands.
          if (r.ev.missed) {
            const kept = new Set(st.items.map((i) => i.id));
            for (const it of before.items) if (!kept.has(it.id) && it.kind !== "pepper" && it.y > RIM_Y) spray(it.x, H - 8, ["#c99a5e", "#e2c08c", "#a87c44"], 7, 50, 2.6);
            au?.sfx("ca-miss", { volume: 0.6 });
          }
          // Every 30 seconds it speeds up: say so.
          const now = Math.floor(st.time / FASTER_EVERY);
          if (now > stage.current && st.time <= 120 + STEP) {
            stage.current = now;
            pops.current.push({ x: W / 2, y: 200, text: "Faster!", color: "#fff6c8", life: 1.5, big: true });
            au?.sfx("ca-faster", { volume: 0.8 });
          }
          if (steps % 30 === 0) changed = true;
          if (st.over) break;
        }
        if (changed) setS(state.current);
      } else acc = 0;
      // Effects keep moving after the last pepper, so the end can be seen.
      if (playing || state.current.over) {
        pops.current = pops.current.filter((p) => {
          p.y -= 40 * dt;
          p.life -= dt;
          return p.life > 0;
        });
        bits.current = bits.current.filter((b) => {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.kind === "dot") b.vy += 320 * dt;
          else b.size += 14 * dt;
          b.life -= dt;
          return b.life > 0;
        });
        flash.current = Math.max(0, flash.current - dt * 2);
        shake.current = Math.max(0, shake.current - dt * 3);
        squash.current = Math.max(0, squash.current - dt * 6);
        goldGlow.current = Math.max(0, goldGlow.current - dt * 1.6);
      }
      const el = canvas.current;
      const c = el?.getContext("2d");
      const sp = sprites.current;
      if (el && c && sp) {
        const k = el.width / W;
        // A pepper shakes the whole stall.
        const jx = shake.current ? (Math.random() - 0.5) * 10 * shake.current : 0;
        const jy = shake.current ? (Math.random() - 0.5) * 6 * shake.current : 0;
        const market = art("market");
        if (market) {
          // The painted market, filling the height (a sliver of each side is cut off).
          c.setTransform(k, 0, 0, k, 0, 0);
          const mw = H * RATIO.market!;
          // Once still (so a shaken edge never shows the last frame), then shaken.
          if (jx || jy) c.drawImage(market, (W - mw) / 2, 0, mw, H);
          c.drawImage(market, (W - mw) / 2 + jx, jy, mw, H);
        } else if (backdrop.current) {
          c.setTransform(1, 0, 0, 1, 0, 0);
          if (jx || jy) c.drawImage(backdrop.current, 0, 0);
          c.drawImage(backdrop.current, jx * k, jy * k);
        }
        c.setTransform(k, 0, 0, k, jx * k, jy * k);
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
          const name = foodArt(it.kind, it.id);
          const painted = art(name);
          c.save();
          c.translate(it.x, it.y);
          c.rotate(it.kind === "pepper" ? Math.sin(it.rot) * 0.4 : it.rot);
          if (painted) {
            // Painted food is drawn a little bigger: its outline is part of the picture.
            const w = sz * (it.kind === "gold" ? 1.75 : it.kind === "pepper" ? 1.15 : 1.3);
            const h = w / RATIO[name]!;
            c.drawImage(painted, -w / 2, -h / 2, w, h);
          } else c.drawImage(sp[it.kind], -sz / 2 - 6, -sz / 2 - 6, sz + 12, sz + 12);
          c.restore();
          if (it.kind === "pepper" && it.y > 60) {
            c.fillStyle = "#e02a1a";
            c.font = "800 10px Manrope, sans-serif";
            c.textAlign = "left";
            c.fillText("Hot!", it.x + 18, it.y - 10);
          }
        }
        // Golden puff-puff: a warm glow behind the basket.
        if (goldGlow.current > 0) {
          const g = c.createRadialGradient(st.basket, RIM_Y + 10, 8, st.basket, RIM_Y + 10, 110);
          g.addColorStop(0, `rgba(255,226,120,${0.7 * goldGlow.current})`);
          g.addColorStop(1, "rgba(255,226,120,0)");
          c.fillStyle = g;
          c.fillRect(st.basket - 110, RIM_Y - 100, 220, 220);
        }
        if (!drawBasketArt(c, st.basket, st.caught, squash.current)) drawBasket(c, st.basket, sp, pile.current, squash.current);
        for (const b of bits.current) {
          if (b.kind === "smoke") {
            c.fillStyle = `${b.color}${Math.max(0, Math.min(0.35, b.life * 0.3))})`;
            c.beginPath();
            c.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            c.fill();
          } else {
            c.globalAlpha = Math.max(0, Math.min(1, b.life * 2));
            c.fillStyle = b.color;
            c.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
          }
        }
        c.globalAlpha = 1;
        for (const p of pops.current) {
          c.globalAlpha = Math.min(1, p.life);
          c.font = p.big ? "900 30px Fraunces, serif" : "900 22px Fraunces, serif";
          c.textAlign = "center";
          c.lineWidth = 3;
          c.strokeStyle = "#1c1416";
          c.strokeText(p.text, p.x, p.y);
          c.fillStyle = p.color;
          c.fillText(p.text, p.x, p.y);
        }
        c.globalAlpha = 1;
        // Lives as peppers, on a dark pill in the top corner (clear of the basket and the sand).
        const lifeText = st.lives > 1 ? `${st.lives} more peppers and you're out` : st.lives === 1 ? "One more pepper and you're out" : "Too much pepper";
        c.font = "700 10px Manrope, sans-serif";
        const pillW = 86 + c.measureText(lifeText).width;
        c.fillStyle = "rgba(28,20,22,.55)";
        c.beginPath();
        c.roundRect(8, 8, pillW, 30, 15);
        c.fill();
        for (let i = 0; i < START_LIVES; i++) {
          c.globalAlpha = i < START_LIVES - st.lives ? 1 : 0.3;
          const pepper = art("pepper-1");
          if (pepper) c.drawImage(pepper, 16 + i * 22, 13, 17, 17 / RATIO["pepper-1"]!);
          else c.drawImage(sp.pepper, 13 + i * 22, 10, 24, 24);
        }
        c.globalAlpha = 1;
        c.fillStyle = "#fff6e8";
        c.textAlign = "left";
        c.fillText(lifeText, 84, 27);
        if (flash.current > 0) {
          c.fillStyle = `rgba(224,42,26,${flash.current * 0.25})`;
          c.fillRect(0, 0, W, H);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm, spray]);

  useEffect(() => {
    api.save(s);
    if (s.over && !ended.current) {
      ended.current = true;
      try {
        sessionStorage.setItem(CATCH_LAST, JSON.stringify({ caught: s.caught, gold: stats.current.gold, bestCombo: stats.current.bestCombo, seed: api.seed } satisfies CatchLast));
      } catch {
        // The finish just shows fewer numbers.
      }
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
        <div className="flex items-end gap-3">
          {/* The combo: the multiplier, and three dots that fill towards the next one. */}
          <div className="text-center" aria-label={`Combo times ${multiplier(s.combo)}`}>
            <span key={multiplier(s.combo)} className={`ca-mult inline-block rounded-full px-2.5 py-0.5 text-[0.95rem] font-extrabold tabular ${s.combo >= 3 ? "bg-[#e8563a] text-white" : "bg-[rgba(28,20,22,.08)] text-muted"}`}>
              ×{multiplier(s.combo)}
            </span>
            <span className="mt-1 flex justify-center gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${multiplier(s.combo) >= 5 || i < s.combo % 3 ? "bg-[#e8563a]" : "bg-[rgba(28,20,22,.15)]"}`} />
              ))}
            </span>
          </div>
          <p className="text-right">
            <span className="display text-[1.6rem] leading-none tabular">{s.caught}</span>
            <span className="block text-[0.78rem] font-semibold text-muted">caught</span>
          </p>
        </div>
      </div>
      <style>{`
        .ca-mult { animation: ca-mult .35s cubic-bezier(.3,1.7,.5,1) both; }
        @keyframes ca-mult { from { transform: scale(.5); } to { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ca-mult { animation: none; } }
      `}</style>
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
