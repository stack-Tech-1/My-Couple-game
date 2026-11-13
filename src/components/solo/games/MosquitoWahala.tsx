"use client";

import { useEffect, useRef, useState } from "react";
import { BED_Y, CAN_Y, H, STEP, START_BITES, W, newMosquito, stepMosquito, type Mosquito, type MosquitoState, type Power } from "@/lib/solo/games/mosquito";
import type { SoloApi } from "../SoloShell";

type Pop = { x: number; y: number; text: string; sub: string; life: number };
type Splat = { x: number; y: number; life: number };

/** The bedroom: night wall, window with the moon, lamp glow and the bed. Painted once per size. */
function paintRoom(k: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  const c = cv.getContext("2d")!;
  c.scale(k, k);
  const wall = c.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#1b2140");
  wall.addColorStop(1, "#2e2547");
  c.fillStyle = wall;
  c.fillRect(0, 0, W, H);
  // Window and moon.
  c.fillStyle = "#0d1028";
  c.strokeStyle = "#6b5a8a";
  c.lineWidth = 5;
  c.beginPath();
  c.roundRect(214, 40, 110, 130, 6);
  c.fill();
  c.stroke();
  const moon = c.createRadialGradient(286, 76, 2, 290, 80, 18);
  moon.addColorStop(0, "#fffbe6");
  moon.addColorStop(1, "#f6d67a");
  c.fillStyle = moon;
  c.beginPath();
  c.arc(290, 80, 18, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(269, 40);
  c.lineTo(269, 170);
  c.moveTo(214, 105);
  c.lineTo(324, 105);
  c.stroke();
  c.fillStyle = "#fff";
  for (const [x, y] of [[226, 52], [250, 140], [300, 150], [236, 120], [312, 128], [258, 64]]) c.fillRect(x!, y!, 1.5, 1.5);
  // Lamp glow.
  const lamp = c.createRadialGradient(60, 300, 0, 60, 300, 150);
  lamp.addColorStop(0, "rgba(255,220,140,.45)");
  lamp.addColorStop(1, "rgba(255,220,140,0)");
  c.fillStyle = lamp;
  c.fillRect(0, 140, 220, 320);
  // Bed: pillow, sheet, frame.
  c.fillStyle = "#4b3a6b";
  c.beginPath();
  c.roundRect(-10, BED_Y - 10, 240, 64, 10);
  c.fill();
  c.fillStyle = "#e8dcc8";
  c.beginPath();
  c.roundRect(-10, BED_Y - 20, 240, 26, 10);
  c.fill();
  c.fillStyle = "#f6efe6";
  c.beginPath();
  c.ellipse(36, BED_Y - 22, 30, 10, 0, 0, Math.PI * 2);
  c.fill();
  // Floor.
  c.fillStyle = "#3a2a4e";
  c.fillRect(0, 456, W, H - 456);
  c.fillStyle = "rgba(0,0,0,.2)";
  c.fillRect(0, 456, W, 4);
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

function drawBug(c: CanvasRenderingContext2D, b: Mosquito, clock: number) {
  const s = b.big ? 1.5 : 1.1;
  c.save();
  c.translate(b.x, b.y);
  c.rotate(Math.sin(b.phase) * 0.35);
  c.scale(s, s);
  // Legs.
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
  const flap = Math.sin(clock * 60 + b.id) * 0.5;
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
  c.fillStyle = b.big ? "#5a2a2a" : "#3a2a22";
  c.beginPath();
  c.ellipse(0, 8, 2.6, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#d9cfc4";
  c.lineWidth = 0.8;
  c.beginPath();
  for (const v of [2, 6, 10, 14]) {
    c.moveTo(-2.4, v);
    c.lineTo(2.4, v);
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
  if (b.big && b.hp > 1) {
    c.fillStyle = "#e8563a";
    c.font = "800 7px Manrope, sans-serif";
    c.textAlign = "center";
    c.fillText("×" + b.hp, 0, 26);
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

export function MosquitoWahala({ api }: { api: SoloApi<MosquitoState> }) {
  const [s, setS] = useState<MosquitoState>(() => api.saved ?? newMosquito(api.seed));
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const room = useRef<HTMLCanvasElement | null>(null);
  const can = useRef<HTMLCanvasElement | null>(null);
  const target = useRef(s.can);
  const keys = useRef({ left: false, right: false });
  const pops = useRef<Pop[]>([]);
  const splats = useRef<Splat[]>([]);
  const banner = useRef<{ text: string; life: number } | null>({ text: "Wave 1", life: 1.6 });
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
      room.current = paintRoom(el.width / W);
      can.current = paintCan(el.width / W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      if (!a.paused && !state.current.over) {
        clock += dt;
        if (keys.current.left) target.current -= 380 * dt;
        if (keys.current.right) target.current += 380 * dt;
        target.current = Math.max(0, Math.min(W, target.current));
        acc += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          const r = stepMosquito(a.seed, state.current, target.current);
          state.current = r.state;
          steps++;
          for (const h of r.ev.hits) {
            if (h.killed) {
              a.sound("flip");
              splats.current.push({ x: h.x, y: h.y, life: 1 });
              pops.current.push({ x: h.x, y: Math.max(40, h.y - 14), text: ["Kpa!", "Gbam!", "Ko si!", "Kpa!"][Math.floor(Math.random() * 4)]!, sub: `+${h.points}`, life: 1 });
              changed = true;
            } else a.sound("tap");
          }
          if (r.ev.bitten) {
            a.sound("lose");
            navigator.vibrate?.(80);
            flash.current = 1;
            setSaid(state.current.bites > 0 ? `Bitten! ${state.current.bites} bites left.` : "Too many bites. Goodnight.");
            changed = true;
          }
          if (r.ev.power) {
            a.sound("win");
            setSaid(r.ev.power === "coil" ? "Coil lit: they slow down." : r.ev.power === "net" ? "Net up: no bites for a while." : "Double spray.");
            changed = true;
          }
          if (r.ev.wave) {
            banner.current = { text: `Wave ${r.ev.wave}`, life: 1.8 };
            setSaid(`Wave ${r.ev.wave - 1} cleared.`);
            changed = true;
          }
          if (steps % 30 === 0) changed = true;
          if (state.current.over) break;
        }
        pops.current = pops.current.filter((p) => ((p.y -= 30 * dt), (p.life -= dt), p.life > 0));
        splats.current = splats.current.filter((p) => ((p.life -= dt * 1.5), p.life > 0));
        if (banner.current) banner.current.life -= dt;
        flash.current = Math.max(0, flash.current - dt * 2);
        if (changed) setS(state.current);
      } else acc = 0;

      const el = canvas.current;
      const c = el?.getContext("2d");
      if (el && c) {
        const k = el.width / W;
        const st = state.current;
        c.setTransform(1, 0, 0, 1, 0, 0);
        if (room.current) c.drawImage(room.current, 0, 0);
        c.setTransform(k, 0, 0, k, 0, 0);
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
        if (st.net > 0) {
          c.fillStyle = "rgba(246,239,230,.18)";
          c.strokeStyle = "rgba(246,239,230,.45)";
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(-10, BED_Y + 10);
          c.quadraticCurveTo(110, BED_Y - 140, 230, BED_Y + 10);
          c.closePath();
          c.fill();
          c.save();
          c.clip();
          c.beginPath();
          for (let x = -10; x < 240; x += 6) {
            c.moveTo(x, BED_Y - 150);
            c.lineTo(x, BED_Y + 20);
          }
          for (let y = BED_Y - 150; y < BED_Y + 20; y += 6) {
            c.moveTo(-10, y);
            c.lineTo(240, y);
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
          c.fillStyle = `rgba(140,20,20,${sp.life * 0.6})`;
          c.beginPath();
          c.arc(sp.x, sp.y, 4 + (1 - sp.life) * 6, 0, Math.PI * 2);
          c.fill();
        }
        for (const b of st.bugs) drawBug(c, b, clock);
        for (const p of st.powers) drawPower(c, p, clock);
        if (can.current) c.drawImage(can.current, st.can - 34, CAN_Y - 30, 68, 110);
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
        c.fillStyle = "rgba(246,239,230,.8)";
        c.font = "700 9px Manrope, sans-serif";
        c.textAlign = "left";
        c.fillText(`${st.bites} ${st.bites === 1 ? "bite" : "bites"} left`, 12, 48);
        const active = [st.coil > 0 ? `Coil ${Math.ceil(st.coil)}s` : "", st.net > 0 ? `Net ${Math.ceil(st.net)}s` : "", st.double > 0 ? `×2 spray ${Math.ceil(st.double)}s` : ""].filter(Boolean).join(" · ");
        if (active) {
          c.fillStyle = "#f6c453";
          c.fillText(active, 12, 62);
        }
        if (banner.current && banner.current.life > 0) {
          c.globalAlpha = Math.min(1, banner.current.life);
          c.font = "900 34px Fraunces, serif";
          c.textAlign = "center";
          c.lineWidth = 4;
          c.strokeStyle = "#1c1416";
          c.strokeText(banner.current.text, W / 2, 250);
          c.fillStyle = "#f6efe6";
          c.fillText(banner.current.text, W / 2, 250);
          c.globalAlpha = 1;
        }
        if (flash.current > 0) {
          c.fillStyle = `rgba(232,86,58,${flash.current * 0.25})`;
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
      api.end(s.score, { wave: s.wave, kills: s.kills });
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
        <p className="display text-[1.5rem] leading-none">Wave {s.wave}</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <canvas
        ref={canvas}
        data-tour="mosquito-room"
        role="img"
        aria-label={`Mosquito Wahala. Wave ${s.wave}, ${s.bites} bites left. Drag or use the arrow keys to move the spray can.`}
        className="mt-3 w-full touch-none rounded-[22px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={(e) => (target.current = toLogical(e.clientX))}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) target.current = toLogical(e.clientX);
        }}
      />
      <p data-tour="mosquito-can" className="mt-3 text-center text-[0.82rem] text-muted">Drag the can under them. It sprays by itself. Catch the coil, net and double spray as they fall.</p>
    </div>
  );
}
