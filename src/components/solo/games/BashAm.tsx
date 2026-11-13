"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BALL_R, BRICK_H, BRICK_W, H, PAINTS, PLANK_Y, STEP, STREETS, W, brickX, brickY, launch, newBash, plankWidth, stepBash, type BashState, type Brick } from "@/lib/solo/games/bash";
import type { SoloApi } from "../SoloShell";

type Chip = { x: number; y: number; vx: number; vy: number; r: number; c: string; life: number };

/** The night sky and skyline never change, so they're painted once per size. */
function paintBackdrop(k: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  const c = cv.getContext("2d")!;
  c.scale(k, k);
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#141b3d");
  sky.addColorStop(0.6, "#2a2f6b");
  sky.addColorStop(1, "#6b3a5e");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
    c.beginPath();
    c.arc(rnd() * W, rnd() * 320, 0.4 + rnd() * 1, 0, Math.PI * 2);
    c.fill();
  }
  // Skyline.
  c.fillStyle = "#0e1330";
  c.beginPath();
  c.moveTo(0, 470);
  const steps = [[0, 420], [30, 420], [30, 390], [52, 390], [52, 430], [70, 430], [70, 360], [96, 360], [96, 420], [116, 420], [116, 390], [146, 390], [146, 350], [158, 320], [170, 350], [170, 420], [194, 420], [194, 365], [224, 365], [224, 410], [246, 410], [246, 385], [274, 385], [274, 420], [298, 420], [298, 370], [328, 370], [328, 440], [358, 440], [358, 470]];
  for (const [x, y] of steps) c.lineTo(x!, y!);
  c.closePath();
  c.fill();
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(246,196,83,${0.3 + rnd() * 0.6})`;
    c.fillRect(4 + rnd() * 350, 372 + rnd() * 90, 3, 4);
  }
  c.fillStyle = "#8a5a23";
  c.fillRect(0, 0, W, 8);
  return cv;
}

function drawBrick(c: CanvasRenderingContext2D, b: Brick) {
  const x = brickX(b), y = brickY(b);
  c.fillStyle = b.tough ? "#a0461f" : PAINTS[b.paint]!;
  c.beginPath();
  c.roundRect(x, y, BRICK_W, BRICK_H, 3);
  c.fill();
  const g = c.createLinearGradient(0, y, 0, y + BRICK_H);
  g.addColorStop(0, "rgba(255,255,255,.14)");
  g.addColorStop(1, "rgba(0,0,0,.28)");
  c.fillStyle = g;
  c.fill();
  // Speckles, the same for each brick every frame.
  c.fillStyle = "rgba(0,0,0,.2)";
  for (let i = 0; i < 5; i++) {
    const h = (b.col * 31 + b.row * 17 + i * 13) % 97;
    c.fillRect(x + 4 + ((h * 7) % (BRICK_W - 8)), y + 4 + (h % (BRICK_H - 8)), 1.4, 1.4);
  }
  c.fillStyle = "rgba(255,255,255,.45)";
  c.beginPath();
  c.roundRect(x + 2, y + 2, BRICK_W - 4, 3, 1.5);
  c.fill();
  if (b.tough) {
    // Mortar lines; cracks once it's been hit.
    c.strokeStyle = "rgba(0,0,0,.25)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + 4, y + 10);
    c.lineTo(x + BRICK_W - 4, y + 10);
    c.moveTo(x + BRICK_W / 2, y + 2);
    c.lineTo(x + BRICK_W / 2, y + 10);
    c.moveTo(x + 12, y + 10);
    c.lineTo(x + 12, y + 18);
    c.moveTo(x + 32, y + 10);
    c.lineTo(x + 32, y + 18);
    c.stroke();
    if (b.hp === 1) {
      c.strokeStyle = "#1c1416";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x + 14, y);
      c.lineTo(x + 20, y + 8);
      c.lineTo(x + 15, y + 13);
      c.lineTo(x + 23, y + 20);
      c.moveTo(x + 20, y + 8);
      c.lineTo(x + 30, y + 6);
      c.stroke();
    }
  }
}

function drawPlank(c: CanvasRenderingContext2D, cx: number, w: number) {
  const x = cx - w / 2;
  c.fillStyle = "rgba(0,0,0,.4)";
  c.beginPath();
  c.roundRect(x, PLANK_Y + 4, w, 18, 5);
  c.fill();
  const g = c.createLinearGradient(0, PLANK_Y, 0, PLANK_Y + 16);
  g.addColorStop(0, "#d9a25e");
  g.addColorStop(1, "#8a5a23");
  c.fillStyle = g;
  c.strokeStyle = "#5a3510";
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(x, PLANK_Y, w, 16, 5);
  c.fill();
  c.stroke();
  c.strokeStyle = "rgba(90,53,16,.45)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + 6, PLANK_Y + 5);
  c.bezierCurveTo(x + w * 0.3, PLANK_Y + 3, x + w * 0.6, PLANK_Y + 7, x + w - 6, PLANK_Y + 5);
  c.moveTo(x + 6, PLANK_Y + 10);
  c.bezierCurveTo(x + w * 0.35, PLANK_Y + 12, x + w * 0.6, PLANK_Y + 9, x + w - 6, PLANK_Y + 11);
  c.stroke();
  for (const nx of [x + 8, x + w - 8]) {
    c.fillStyle = "#c9c2b8";
    c.strokeStyle = "#5a5a5a";
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(nx, PLANK_Y + 8, 2, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function drawBall(c: CanvasRenderingContext2D, x: number, y: number) {
  const glow = c.createRadialGradient(x, y, 0, x, y, 40);
  glow.addColorStop(0, "rgba(255,240,200,.55)");
  glow.addColorStop(1, "rgba(255,240,200,0)");
  c.fillStyle = glow;
  c.beginPath();
  c.arc(x, y, 40, 0, Math.PI * 2);
  c.fill();
  const g = c.createRadialGradient(x - 3, y - 3, 0.5, x, y, BALL_R);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.5, "#e9e3da");
  g.addColorStop(1, "#8f857c");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, BALL_R, 0, Math.PI * 2);
  c.fill();
}

const CAPSULE_LABEL = { gen: "GEN", slow: "SLOW", life: "+1" } as const;

function draw(c: CanvasRenderingContext2D, s: BashState, backdrop: HTMLCanvasElement | null, k: number, chips: Chip[], trail: { x: number; y: number }[], shake: number, clock: number) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (backdrop) c.drawImage(backdrop, 0, 0);
  c.setTransform(k, 0, 0, k, shake ? (Math.random() - 0.5) * shake * k : 0, shake ? (Math.random() - 0.5) * shake * k : 0);
  for (const b of s.bricks) drawBrick(c, b);
  for (const ch of chips) {
    c.globalAlpha = Math.max(0, ch.life);
    c.fillStyle = ch.c;
    c.fillRect(ch.x, ch.y, ch.r, ch.r * 0.7);
  }
  c.globalAlpha = 1;
  // Capsules.
  for (const cap of s.capsules) {
    c.save();
    c.translate(cap.x, cap.y);
    c.rotate(Math.sin(clock * 4 + cap.x) * 0.15);
    const g = c.createRadialGradient(-6, -4, 1, 0, 0, 26);
    g.addColorStop(0, "#fff3c4");
    g.addColorStop(0.6, cap.kind === "life" ? "#f2a7a0" : "#e9b13c");
    g.addColorStop(1, "#9c6a08");
    c.fillStyle = g;
    c.strokeStyle = "#5a3a06";
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(-24, -10, 48, 20, 10);
    c.fill();
    c.stroke();
    c.fillStyle = "#1c1416";
    c.font = "800 9px Manrope, sans-serif";
    c.textAlign = "center";
    c.fillText(CAPSULE_LABEL[cap.kind], 0, 3.5);
    c.restore();
  }
  // Trail, ball, plank.
  trail.forEach((t, i) => {
    c.fillStyle = `rgba(255,255,255,${0.06 * (i + 1)})`;
    c.beginPath();
    c.arc(t.x, t.y, BALL_R * (0.4 + i * 0.1), 0, Math.PI * 2);
    c.fill();
  });
  drawBall(c, s.ball.x, s.ball.y);
  drawPlank(c, s.plank, plankWidth(s));
  // Footer: lives and street.
  for (let i = 0; i < Math.max(s.lives, 3); i++) {
    c.globalAlpha = i < s.lives ? 1 : 0.25;
    drawMini(c, W - 16 - i * 16, 540);
  }
  c.globalAlpha = 1;
  c.fillStyle = "rgba(246,239,230,.85)";
  c.font = "700 11px Manrope, sans-serif";
  c.textAlign = "left";
  c.fillText(`Street ${s.level} · ${STREETS[(s.level - 1) % STREETS.length]}`, 14, 544);
  if (s.wideFor > 0 || s.slowFor > 0) {
    c.fillStyle = "#f6c453";
    c.fillText([s.wideFor > 0 ? `Wide plank ${Math.ceil(s.wideFor)}s` : "", s.slowFor > 0 ? `Slow ball ${Math.ceil(s.slowFor)}s` : ""].filter(Boolean).join(" · "), 14, 528);
  }
  if (!s.launched && !s.over) {
    c.fillStyle = "rgba(246,239,230,.95)";
    c.font = "800 15px Manrope, sans-serif";
    c.textAlign = "center";
    c.globalAlpha = 0.6 + Math.sin(clock * 4) * 0.4;
    c.fillText("Tap to launch", W / 2, PLANK_Y - 40);
    c.globalAlpha = 1;
  }
}

function drawMini(c: CanvasRenderingContext2D, x: number, y: number) {
  const g = c.createRadialGradient(x - 2, y - 2, 0.5, x, y, 5.5);
  g.addColorStop(0, "#fff");
  g.addColorStop(1, "#8f857c");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, 5.5, 0, Math.PI * 2);
  c.fill();
}

export function BashAm({ api }: { api: SoloApi<BashState> }) {
  const [s, setS] = useState<BashState>(() => api.saved ?? newBash(api.seed));
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<HTMLCanvasElement | null>(null);
  const target = useRef(s.plank);
  const keys = useRef({ left: false, right: false });
  const chips = useRef<Chip[]>([]);
  const trail = useRef<{ x: number; y: number }[]>([]);
  const shake = useRef(0);
  const [said, setSaid] = useState("");
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const go = useCallback(() => {
    const a = apiRef.current;
    if (a.paused) return;
    state.current = launch(a.seed, state.current);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      backdrop.current = paintBackdrop(el.width / W);
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
        if (keys.current.left) target.current -= 420 * dt;
        if (keys.current.right) target.current += 420 * dt;
        target.current = Math.max(0, Math.min(W, target.current));
        acc += dt;
        let changed = false;
        while (acc >= STEP) {
          acc -= STEP;
          const r = stepBash(a.seed, state.current, target.current);
          state.current = r.state;
          steps++;
          for (const h of r.ev.hits) {
            a.sound(h.broke ? "flip" : "tap");
            if (h.broke) {
              const color = h.paint < 0 ? "#a0461f" : PAINTS[h.paint]!;
              for (let i = 0; i < (calm ? 3 : 10); i++) chips.current.push({ x: h.x, y: h.y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, r: 3 + Math.random() * 5, c: color, life: 1 });
              if (state.current.combo >= 4 && !calm) shake.current = 4;
            }
            changed = true;
          }
          if (r.ev.plank) a.sound("drop");
          if (r.ev.caught) {
            a.sound("win");
            navigator.vibrate?.(20);
            setSaid(r.ev.caught === "gen" ? "Wide plank." : r.ev.caught === "slow" ? "Slow ball." : "An extra ball.");
          }
          if (r.ev.lost) {
            a.sound("lose");
            navigator.vibrate?.([40, 40, 40]);
            setSaid(state.current.lives > 0 ? `Dropped it. ${state.current.lives} left.` : "No balls left.");
            changed = true;
          }
          if (r.ev.cleared) {
            a.sound("win");
            setSaid(`Street cleared. On to ${STREETS[(state.current.level - 1) % STREETS.length]}.`);
            changed = true;
          }
          if (steps % 60 === 0) changed = true;
          if (state.current.over) break;
        }
        chips.current = chips.current.filter((ch) => {
          ch.x += ch.vx * dt;
          ch.y += ch.vy * dt;
          ch.vy += 600 * dt;
          ch.life -= dt * 1.4;
          return ch.life > 0;
        });
        if (state.current.launched) trail.current = [...trail.current, { x: state.current.ball.x, y: state.current.ball.y }].slice(-6);
        else trail.current = [];
        shake.current = Math.max(0, shake.current - dt * 20);
        if (changed) setS(state.current);
      } else acc = 0;
      const el = canvas.current;
      const ctx = el?.getContext("2d");
      if (el && ctx) draw(ctx, state.current, backdrop.current, el.width / W, chips.current, calm ? [] : trail.current, shake.current, clock);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm]);

  useEffect(() => {
    api.save(s);
    if (s.over && !ended.current) {
      ended.current = true;
      api.end(s.score, { street: s.level });
    }
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

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="display text-[1.4rem] leading-none tabular">{s.combo > 1 ? `×${s.combo}` : ""}</p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <canvas
        ref={canvas}
        data-tour="bash-wall"
        role="img"
        aria-label={`Bash Am. Street ${s.level}. ${s.bricks.length} bricks left, ${s.lives} balls. Drag to move the plank, tap to launch.`}
        className="mt-3 w-full touch-none rounded-[22px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={(e) => {
          target.current = toLogical(e.clientX);
          if (!state.current.launched) go();
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) target.current = toLogical(e.clientX);
        }}
      />
      <p data-tour="bash-plank" className="mt-3 text-center text-[0.82rem] text-muted">Drag anywhere to move the plank. Catch the gold capsules: GEN widens the plank, SLOW calms the ball.</p>
    </div>
  );
}
