"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CAP, DRINKS, isWon, newZobo, pour, pourAmount, undo, zoboScore, type Bottle, type ZoboState } from "@/lib/solo/games/zobo";
import type { SoloApi } from "../SoloShell";

const LEVEL_KEY = "amah:zobo:level";
const BW = 62; // bottle width
const BH = 170; // bottle height
const UNIT = 30;
const BASE = 8;
const VIEW_W = 358;
const SHELF_GAP = 214;

const BODY = `M${-BW / 2} ${-BH + 46} Q${-BW / 2} ${-BH + 30} -13 ${-BH + 18} V${-BH} H13 V${-BH + 18} Q${BW / 2} ${-BH + 30} ${BW / 2} ${-BH + 46} V-10 Q${BW / 2} 0 ${BW / 2 - 10} 0 H${-BW / 2 + 10} Q${-BW / 2} 0 ${-BW / 2} -10Z`;

function readLevel(): number {
  try {
    return Math.max(1, Number(localStorage.getItem(LEVEL_KEY)) || 1);
  } catch {
    return 1;
  }
}

type Pouring = { from: number; to: number; n: number; drink: number; t0: number; dir: 1 | -1 };
const POUR_MS = 950;
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Where each bottle stands, in rows on shelves. */
function layout(n: number) {
  const rows = n <= 5 ? 1 : 2;
  const perRow = Math.ceil(n / rows);
  const scale = Math.min(1, (VIEW_W - 16) / (perRow * 72));
  const spacing = (VIEW_W - 16) / perRow;
  const pos = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / perRow);
    const inRow = row === rows - 1 ? n - perRow * (rows - 1) : perRow;
    const col = i - row * perRow;
    const x = VIEW_W / 2 + (col - (inRow - 1) / 2) * spacing;
    const y = 220 + row * SHELF_GAP;
    return { x, y };
  });
  return { pos, scale, rows, height: 220 + (rows - 1) * SHELF_GAP + 60 };
}

/** One bottle with its drinks. `layers` are [drink, amount] bottom first; amounts may be fractions. */
function BottleArt({ id, layers, tilt, glow }: { id: string; layers: [number, number][]; tilt: number; glow?: boolean }) {
  const total = layers.reduce((t, [, a]) => t + a, 0);
  const surface = -BASE - total * UNIT;
  let y = -BASE;
  const bands = layers.map(([d, a], i) => {
    const h = a * UNIT;
    y -= h;
    const top = i === layers.length - 1 ? -BH - 20 : y; // the top drink reaches the surface line
    return <rect key={i} x={-BW / 2 - 40} y={top} width={BW + 80} height={y + h - top + 0.5} fill={`url(#zd${d})`} />;
  });
  return (
    <g transform={`rotate(${tilt})`}>
      <ellipse cx="2" cy="4" rx={BW / 2 + 6} ry="7" fill="rgba(0,0,0,.22)" opacity={tilt ? 0 : 1} />
      <clipPath id={`zb-${id}`}>
        <path d={BODY} />
      </clipPath>
      <clipPath id={`zs-${id}`}>
        {/* Everything below a level line through the surface: liquid stays flat as the bottle tips. */}
        <rect x="-400" y={surface} width="800" height="800" transform={`rotate(${-tilt} 0 ${surface})`} />
      </clipPath>
      <g clipPath={`url(#zb-${id})`}>
        <rect x={-BW / 2} y={-BH} width={BW} height={BH} fill="rgba(220,240,240,.18)" />
        {total > 0.01 ? <g clipPath={`url(#zs-${id})`}>{bands}</g> : null}
      </g>
      <path d={BODY} fill="url(#zglass)" stroke={glow ? "#e9b13c" : "rgba(40,60,60,.55)"} strokeWidth={glow ? 3.5 : 2} />
      <path d={`M${-BW / 2 + 7} ${-BH + 52} V-18`} stroke="rgba(255,255,255,.75)" strokeWidth="4" strokeLinecap="round" />
      <path d={`M${BW / 2 - 9} ${-BH + 60} V-40`} stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round" />
      <rect x="-15" y={-BH - 4} width="30" height="8" rx="3" fill="rgba(200,225,225,.6)" stroke="rgba(40,60,60,.5)" strokeWidth="1.5" />
    </g>
  );
}

const asLayers = (b: Bottle): [number, number][] => b.map((d) => [d, 1]);

export function ZoboSort({ api }: { api: SoloApi<ZoboState> }) {
  const [s, setS] = useState<ZoboState>(() => api.saved ?? newZobo(api.seed, readLevel()));
  const [sel, setSel] = useState<number | null>(null);
  const [pouring, setPouring] = useState<Pouring | null>(null);
  const [now, setNow] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [focus, setFocus] = useState<number | null>(null);
  const ended = useRef(false);
  const L = useMemo(() => layout(s.bottles.length), [s.bottles.length]);

  // Drive the pour animation.
  useEffect(() => {
    if (!pouring) return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      if (t - pouring.t0 >= POUR_MS) {
        setPouring(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pouring]);

  useEffect(() => {
    api.save(s);
    if (s.won && !ended.current && !pouring) {
      ended.current = true;
      try {
        localStorage.setItem(LEVEL_KEY, String(s.level + 1));
      } catch {
        // Private mode: the next game starts at this level again.
      }
      api.sound("win");
      navigator.vibrate?.([30, 60, 30]);
      api.end(zoboScore(s), { level: s.level, moves: s.moves });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state or animation changes
  }, [s, pouring]);

  const tap = (i: number) => {
    if (api.paused || pouring || s.won) return;
    if (sel === null) {
      if (!s.bottles[i]!.length) return;
      setSel(i);
      api.sound("tap");
      return;
    }
    if (sel === i) {
      setSel(null);
      return;
    }
    const n = pourAmount(s.bottles, sel, i);
    const next = n ? pour(s, sel, i) : null;
    if (!next) {
      setShake(i);
      setTimeout(() => setShake(null), 350);
      api.sound("lose");
      setSel(null);
      return;
    }
    const from = s.bottles[sel]!;
    const drink = from[from.length - 1]!;
    const dir: 1 | -1 = L.pos[i]!.x - 172 * L.scale > 8 ? 1 : -1;
    setPouring({ from: sel, to: i, n, drink, t0: performance.now(), dir });
    setNow(performance.now());
    api.sound("drop");
    setS(next);
    setSel(null);
    setSaid(`Poured ${DRINKS[drink]!.name}.${next.won ? " All sorted!" : ""}`);
  };

  const restart = () => {
    if (pouring) return;
    setS(newZobo(api.seed, s.level));
    setSel(null);
  };
  const back = () => {
    const u = !pouring ? undo(s) : null;
    if (u) {
      setS(u);
      setSel(null);
      api.sound("flip");
    }
  };

  // While pouring, the bottles show the drink part-way across.
  const p = pouring ? (now - pouring.t0) / POUR_MS : 1;
  const q = pouring ? ease(seg(p, 0.38, 0.74)) : 1;
  const view = (i: number): [number, number][] => {
    const b = s.bottles[i]!;
    if (!pouring) return asLayers(b);
    if (i === pouring.from) return [...asLayers(b), [pouring.drink, pouring.n * (1 - q)]];
    if (i === pouring.to) {
      const before = b.slice(0, b.length - pouring.n);
      return [...asLayers(before), [pouring.drink, pouring.n * q]];
    }
    return asLayers(b);
  };

  const pose = (i: number) => {
    const base = L.pos[i]!;
    const lift = sel === i ? -16 : 0;
    if (!pouring || i !== pouring.from) return { x: base.x + (shake === i ? Math.sin(now / 20) * 4 : 0), y: base.y + lift, tilt: 0 };
    // Lift, swing over the target, tip, pour, and come back.
    const tgt = L.pos[pouring.to]!;
    const ang = 100 * pouring.dir;
    const r = (ang * Math.PI) / 180;
    const mouthX = tgt.x;
    const mouthY = tgt.y - BH * L.scale - 18;
    const px = mouthX - Math.sin(r) * BH * L.scale;
    const py = mouthY + Math.cos(r) * BH * L.scale;
    const go = ease(seg(p, 0, 0.32));
    const back = ease(seg(p, 0.78, 1));
    const k = go * (1 - back);
    return { x: base.x + (px - base.x) * k, y: base.y + (py - base.y) * k, tilt: ang * ease(seg(p, 0.12, 0.4)) * (1 - back) };
  };

  const drinkGrads = DRINKS.map((d, i) => (
    <linearGradient key={d.id} id={`zd${i}`} x1="0" x2="1">
      <stop offset="0" stopColor={d.dark} />
      <stop offset=".45" stopColor={d.light} />
      <stop offset="1" stopColor={d.dark} />
    </linearGradient>
  ));

  const order = s.bottles.map((_, i) => i).sort((a, b) => (pouring?.from === a ? 1 : pouring?.from === b ? -1 : 0));
  const stream = pouring && p > 0.38 && p < 0.78 ? (() => {
    const src = pose(pouring.from);
    const r = (src.tilt * Math.PI) / 180;
    const mx = src.x + Math.sin(r) * BH * L.scale;
    const my = src.y - Math.cos(r) * BH * L.scale;
    const tgt = L.pos[pouring.to]!;
    const filled = s.bottles[pouring.to]!.length - pouring.n + pouring.n * q;
    const sy = tgt.y - (BASE + filled * UNIT) * L.scale;
    return { mx, my, tx: tgt.x, sy };
  })() : null;

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <div>
          <p className="display text-[2rem] leading-none">Level {s.level}</p>
          <p className="text-[0.82rem] font-semibold text-muted">{s.moves} {s.moves === 1 ? "move" : "moves"}</p>
        </div>
        <div className="flex gap-2" data-tour="zobo-undo">
          <button type="button" onClick={back} disabled={!s.undo.length || s.undosLeft <= 0 || !!pouring} className="rounded-full border-[1.5px] border-[var(--fg)] px-3.5 py-1.5 text-[0.88rem] font-bold disabled:opacity-40">
            ↶ Undo {s.undosLeft < 5 ? `(${s.undosLeft})` : ""}
          </button>
          <button type="button" onClick={restart} className="rounded-full border-[1.5px] border-[var(--fg)] px-3.5 py-1.5 text-[0.88rem] font-bold">
            Restart
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div data-tour="zobo-shelf" className="mt-3 overflow-hidden rounded-[22px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]">
        <svg viewBox={`0 0 ${VIEW_W} ${L.height}`} className="block w-full" role="group" aria-label={`Zobo Sort, level ${s.level}. ${s.bottles.length} bottles.`}>
          <defs>
            {drinkGrads}
            <linearGradient id="zglass" x1="0" x2="1">
              <stop offset="0" stopColor="rgba(255,255,255,.28)" />
              <stop offset=".3" stopColor="rgba(255,255,255,.04)" />
              <stop offset=".8" stopColor="rgba(255,255,255,.02)" />
              <stop offset="1" stopColor="rgba(255,255,255,.22)" />
            </linearGradient>
            <linearGradient id="zwall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f3e3cf" />
              <stop offset="1" stopColor="#e2c9a8" />
            </linearGradient>
            <linearGradient id="zwood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a36a33" />
              <stop offset="1" stopColor="#6b3f17" />
            </linearGradient>
          </defs>
          <rect width={VIEW_W} height={L.height} fill="url(#zwall)" />
          <g opacity=".08">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d={`M${i * 34} 0 v${L.height}`} stroke="#6b3f17" strokeWidth="14" />
            ))}
          </g>
          {Array.from({ length: L.rows }, (_, r) => (
            <g key={r}>
              <rect x="0" y={220 + r * SHELF_GAP} width={VIEW_W} height="16" fill="url(#zwood)" />
              <rect x="0" y={236 + r * SHELF_GAP} width={VIEW_W} height="5" fill="rgba(0,0,0,.18)" />
            </g>
          ))}
          {order.map((i) => {
            const at = pose(i);
            const done = s.bottles[i]!.length === CAP && s.bottles[i]!.every((d) => d === s.bottles[i]![0]);
            return (
              <g key={i} transform={`translate(${at.x} ${at.y}) scale(${L.scale})`} onClick={() => tap(i)} onFocus={() => setFocus(i)} onBlur={() => setFocus(null)} style={{ cursor: "pointer", outline: "none" }} role="button" aria-label={`Bottle ${i + 1}: ${s.bottles[i]!.length ? s.bottles[i]!.map((d) => DRINKS[d]!.name).reverse().join(", top to bottom ") : "empty"}${sel === i ? ", picked up" : ""}`} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && tap(i)}>
                <rect x={-BW / 2 - 4} y={-BH - 24} width={BW + 8} height={BH + 30} fill="transparent" />
                <BottleArt id={String(i)} layers={view(i)} tilt={at.tilt} glow={sel === i || focus === i || (done && !pouring && isWon(s.bottles))} />
                {done ? <circle cx={BW / 2 - 6} cy={-BH + 6} r="7" fill="#2f8a4e" stroke="#fff" strokeWidth="1.5" /> : null}
              </g>
            );
          })}
          {stream ? (
            <g>
              <path d={`M${stream.mx} ${stream.my} C${stream.mx} ${stream.my + 20} ${stream.tx} ${stream.my + 10} ${stream.tx} ${stream.sy}`} stroke={DRINKS[pouring!.drink]!.light} strokeWidth={7 * L.scale} fill="none" strokeLinecap="round" />
              {[0, 1, 2, 3, 4].map((k) => (
                <circle key={k} cx={stream.tx + Math.sin(now / 60 + k * 2) * 10 * L.scale} cy={stream.sy - 2 - ((now / 8 + k * 7) % 10)} r={(1.2 + (k % 3)) * L.scale} fill={DRINKS[pouring!.drink]!.light} />
              ))}
            </g>
          ) : null}
        </svg>
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted">Tap a bottle to pick it up, then tap where to pour. You can only pour onto the same drink, or into an empty bottle.</p>
    </div>
  );
}
