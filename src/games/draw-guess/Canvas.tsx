"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { IconButton } from "@/design/Button";
import { cn } from "@/lib/cn";

export const COLORS = ["#1c1416", "#e8563a", "#5b1a2b", "#5f7a4f", "#b8893b", "#3d6e8f"] as const;
export const SIZES = [0.006, 0.014, 0.03] as const;

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const strokeSchema = z.object({ id: z.string().max(24), c: z.enum(COLORS), w: z.number().min(0.002).max(0.05), p: z.array(point).max(4000) });
export type Stroke = z.infer<typeof strokeSchema>;

export const drawEvents = {
  begin: z.object({ round: z.number().int(), s: strokeSchema }),
  points: z.object({ round: z.number().int(), id: z.string().max(24), p: z.array(point).max(400) }),
  clear: z.object({ round: z.number().int() }),
  undo: z.object({ round: z.number().int() }),
  need: z.object({ round: z.number().int() }),
  all: z.object({ round: z.number().int(), strokes: z.array(strokeSchema).max(400) }),
};

type Broadcast = { send: (e: string, p: unknown) => void; on: (e: string, h: (p: unknown) => void) => () => void };

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w * w;
    const pts = s.p;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.fillStyle = s.c;
      ctx.arc(pts[0]![0] * w, pts[0]![1] * h, (s.w * w) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0]![0] * w, pts[0]![1] * h);
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      ctx.quadraticCurveTo(x0 * w, y0 * h, ((x0 + x1) / 2) * w, ((y0 + y1) / 2) * h);
    }
    const last = pts[pts.length - 1]!;
    ctx.lineTo(last[0] * w, last[1] * h);
    ctx.stroke();
  }
}

/**
 * Shared sketchpad. The drawer streams strokes over the session broadcast;
 * the guesser renders them. Nothing here touches the database.
 */
export function Sketchpad({ round, drawing, broadcast, label }: { round: number; drawing: boolean; broadcast: Broadcast; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const active = useRef<Stroke | null>(null);
  const outbox = useRef<[number, number][]>([]);
  const [color, setColor] = useState<(typeof COLORS)[number]>(COLORS[0]);
  const [size, setSize] = useState<number>(SIZES[1]);
  const [, force] = useState(0);
  const frame = useRef(0);

  const redraw = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      paint(ctx, active.current ? [...strokes.current, active.current] : strokes.current, c.width, c.height);
    });
  }, []);

  // Keep the backing store crisp on any screen.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      redraw();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [redraw]);

  // New round: wipe the slate.
  useEffect(() => {
    strokes.current = [];
    active.current = null;
    redraw();
  }, [round, redraw]);

  // Network: drawer answers sync requests; guesser applies everything.
  useEffect(() => {
    const offs = [
      broadcast.on("need", (raw) => {
        const m = drawEvents.need.safeParse(raw);
        if (drawing && m.success && m.data.round === round) broadcast.send("all", { round, strokes: strokes.current });
      }),
    ];
    if (!drawing) {
      offs.push(
        broadcast.on("begin", (raw) => {
          const m = drawEvents.begin.safeParse(raw);
          if (!m.success || m.data.round !== round) return;
          strokes.current = [...strokes.current, m.data.s];
          redraw();
        }),
        broadcast.on("points", (raw) => {
          const m = drawEvents.points.safeParse(raw);
          if (!m.success || m.data.round !== round) return;
          const s = strokes.current.find((x) => x.id === m.data.id);
          if (s && s.p.length < 4000) s.p.push(...m.data.p);
          redraw();
        }),
        broadcast.on("clear", (raw) => {
          if (drawEvents.clear.safeParse(raw).data?.round !== round) return;
          strokes.current = [];
          redraw();
        }),
        broadcast.on("undo", (raw) => {
          if (drawEvents.undo.safeParse(raw).data?.round !== round) return;
          strokes.current = strokes.current.slice(0, -1);
          redraw();
        }),
        broadcast.on("all", (raw) => {
          const m = drawEvents.all.safeParse(raw);
          if (!m.success || m.data.round !== round) return;
          strokes.current = m.data.strokes;
          redraw();
        }),
      );
      broadcast.send("need", { round });
    }
    return () => offs.forEach((off) => off());
  }, [broadcast, drawing, round, redraw]);

  // Flush buffered points ~25 times a second while drawing.
  useEffect(() => {
    if (!drawing) return;
    const t = setInterval(() => {
      if (!active.current || outbox.current.length === 0) return;
      broadcast.send("points", { round, id: active.current.id, p: outbox.current.splice(0, 400) });
    }, 40);
    return () => clearInterval(t);
  }, [drawing, broadcast, round]);

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  };

  const down = (e: React.PointerEvent) => {
    if (!drawing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: Stroke = { id: Math.random().toString(36).slice(2, 10), c: color, w: size, p: [pos(e)] };
    active.current = s;
    outbox.current = [];
    broadcast.send("begin", { round, s });
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing || !active.current) return;
    const p = pos(e);
    const last = active.current.p[active.current.p.length - 1]!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return;
    active.current.p.push(p);
    outbox.current.push(p);
    redraw();
  };
  const up = () => {
    if (!active.current) return;
    if (outbox.current.length) broadcast.send("points", { round, id: active.current.id, p: outbox.current.splice(0) });
    strokes.current = [...strokes.current, active.current];
    active.current = null;
    force((n) => n + 1);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn("aspect-[4/3] w-full touch-none rounded-[18px] border-[1.5px] border-line-strong bg-[#fbf7f1]", drawing ? "cursor-crosshair" : "cursor-default")}
      />
      {drawing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                className={cn("h-8 w-8 rounded-full border-2 transition-transform", color === c ? "scale-110 border-line-strong" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Brush size">
            {SIZES.map((s, i) => (
              <button key={s} type="button" role="radio" aria-checked={size === s} aria-label={["Fine", "Medium", "Thick"][i]} onClick={() => setSize(s)} className={cn("flex h-9 w-9 items-center justify-center rounded-full", size === s ? "bg-sunk" : "")}>
                <span className="rounded-full bg-fg" style={{ width: 4 + i * 6, height: 4 + i * 6 }} />
              </button>
            ))}
            <IconButton
              icon="arrowLeft"
              label="Undo"
              onClick={() => {
                strokes.current = strokes.current.slice(0, -1);
                broadcast.send("undo", { round });
                redraw();
              }}
            />
            <IconButton
              icon="close"
              label="Clear"
              onClick={() => {
                strokes.current = [];
                broadcast.send("clear", { round });
                redraw();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
