"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOTTLE_LOOKS, CAP, DRINKS, HELPERS, SHELF_LOOKS, addBottle, crateShut, isFull, levelOfMode, newZobo, newZoboLevel, outOfPours, pour, pourAmount, solve, stallOf, starsFor, takings, undo, zoboScore, type Bottle, type HelperId, type Move, type ZoboState } from "@/lib/solo/games/zobo";
import { buyZoboHelper } from "@/lib/solo/shop-actions";
import { GameAudio, type LoopHandle } from "@/lib/game-audio";
import type { SoloApi } from "../SoloShell";

/** Every Zobo Sort sound, loaded when a level opens. */
const SOUNDS = ["zs-pour", "zs-pick", "zs-put", "zs-wrong", "zs-cork", "zs-crate", "zs-reveal", "zs-hint", "zs-win"];

export const ZOBO_BOTTLE_KEY = "amah:zobo:bottle";
export const ZOBO_SHELF_KEY = "amah:zobo:shelf";
export const ZOBO_LAST_KEY = "amah:zobo:last";

const BW = 62; // bottle width
const BH = 170; // bottle height
const UNIT = 30;
const BASE = 8;
const VIEW_W = 358;
const SHELF_GAP = 214;
const COVER = -1; // a layer you can't see yet

/** Each stall's walls and awning. */
const STALL_ART = [
  { wall: ["#f3e3cf", "#e2c9a8"], a: "#8f1d40", b: "#f6ead0" },
  { wall: ["#f7d9a8", "#e9b873"], a: "#d9670a", b: "#fff1d6" },
  { wall: ["#e8d5ef", "#c9aedb"], a: "#5d2a86", b: "#f2b632" },
  { wall: ["#bfe6f2", "#f3dfb4"], a: "#1f7a8c", b: "#fffaf0" },
  { wall: ["#4a3f78", "#2f2757"], a: "#b8860b", b: "#2f2757" },
] as const;

const BODY = `M${-BW / 2} ${-BH + 46} Q${-BW / 2} ${-BH + 30} -13 ${-BH + 18} V${-BH} H13 V${-BH + 18} Q${BW / 2} ${-BH + 30} ${BW / 2} ${-BH + 46} V-10 Q${BW / 2} 0 ${BW / 2 - 10} 0 H${-BW / 2 + 10} Q${-BW / 2} 0 ${-BW / 2} -10Z`;

type Pouring = { from: number; to: number; n: number; drink: number; t0: number; dir: 1 | -1; covered?: number[]; filled: boolean; revealed: boolean; opening: number[] };
type Spark = { id: number; x: number; y: number; t0: number; color: string };
const POUR_MS = 1050;
const SPARK_MS = 800;
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

function chosen<T extends { id: string; price: number }>(key: string, looks: readonly T[], owned: readonly string[] | undefined): T {
  try {
    const id = localStorage.getItem(key);
    const look = looks.find((l) => l.id === id);
    if (look && (!look.price || owned?.includes(look.id))) return look;
  } catch {
    // No storage: the plain look.
  }
  return looks[0]!;
}

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

type Look = (typeof BOTTLE_LOOKS)[number];

/** One bottle with its drinks. `layers` are [drink, amount] bottom first; amounts may be fractions. */
function BottleArt({ id, layers, tilt, glow, wave, look, night, corked, crateKey }: { id: string; layers: [number, number][]; tilt: number; glow?: boolean; wave?: number; look: Look; night: boolean; corked: boolean; crateKey: number | null }) {
  const total = layers.reduce((t, [, a]) => t + a, 0);
  const surface = -BASE - total * UNIT;
  let y = -BASE;
  const bands = layers.map(([d, a], i) => {
    const h = a * UNIT;
    y -= h;
    const top = i === layers.length - 1 ? -BH - 20 : y; // the top drink reaches the surface line
    return <rect key={i} x={-BW / 2 - 40} y={top} width={BW + 80} height={y + h - top + 0.5} fill={d === COVER ? "url(#zdc)" : `url(#zd${d})`} />;
  });
  const edge = look.id === "bottle-glass" && night ? "rgba(240,235,255,.8)" : look.edge;
  return (
    <g transform={`rotate(${tilt})`}>
      <ellipse cx="2" cy="4" rx={BW / 2 + 6} ry="7" fill="rgba(0,0,0,.22)" opacity={tilt ? 0 : 1} />
      <clipPath id={`zb-${id}`}>
        <path d={BODY} />
      </clipPath>
      <clipPath id={`zs-${id}`}>
        {/* Everything below a level line through the surface: liquid stays flat as the bottle tips, and ripples as it fills. */}
        {wave ? (
          <path d={`M-60 ${surface} Q-30 ${surface - wave} 0 ${surface} Q30 ${surface + wave} 60 ${surface} V300 H-60Z`} />
        ) : (
          <rect x="-400" y={surface} width="800" height="800" transform={`rotate(${-tilt} 0 ${surface})`} />
        )}
      </clipPath>
      <g clipPath={`url(#zb-${id})`}>
        <rect x={-BW / 2} y={-BH} width={BW} height={BH} fill={look.glass} />
        {total > 0.01 ? <g clipPath={`url(#zs-${id})`}>{bands}</g> : null}
      </g>
      <path d={BODY} fill="url(#zglass)" stroke={glow ? "#e9b13c" : edge} strokeWidth={glow ? 3.5 : 2} />
      <path d={`M${-BW / 2 + 7} ${-BH + 52} V-18`} stroke="rgba(255,255,255,.75)" strokeWidth="4" strokeLinecap="round" />
      <path d={`M${BW / 2 - 9} ${-BH + 60} V-40`} stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round" />
      {corked ? (
        <rect x="-11" y={-BH - 12} width="22" height="18" rx="3" fill="#b98a55" stroke="#6b4a24" strokeWidth="1.5" />
      ) : (
        <rect x="-15" y={-BH - 4} width="30" height="8" rx="3" fill={look.cap} stroke={edge} strokeWidth="1.5" />
      )}
      {crateKey !== null ? (
        <g>
          {[-BH + 34, -BH + 84, -BH + 134].map((py) => (
            <rect key={py} x={-BW / 2 - 7} y={py} width={BW + 14} height="20" rx="2" fill="#a9743c" stroke="#5b3413" strokeWidth="1.5" />
          ))}
          {[-BW / 2 - 2, BW / 2 - 8].map((px) => (
            <rect key={px} x={px} y={-BH + 26} width="10" height={BH - 22} rx="2" fill="#8a5526" stroke="#5b3413" strokeWidth="1.5" />
          ))}
          <circle cy={-BH + 94} r="17" fill="#f6ead0" stroke="#5b3413" strokeWidth="2" />
          <circle cy={-BH + 94} r="11" fill={DRINKS[crateKey]!.light} stroke={DRINKS[crateKey]!.dark} strokeWidth="2" />
        </g>
      ) : null}
    </g>
  );
}

export function ZoboSort({ api }: { api: SoloApi<ZoboState> }) {
  const career = levelOfMode(api.mode);
  const fresh = () => (career ? newZoboLevel(career) : newZobo(api.seed, 8));
  const [s, setS] = useState<ZoboState>(() => api.saved ?? fresh());
  const [sel, setSel] = useState<number | null>(null);
  const [pouring, setPouring] = useState<Pouring | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [now, setNow] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [note, setNote] = useState("");
  const [hint, setHint] = useState<Move | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [savings, setSavings] = useState(api.extras?.savings);
  const [buying, setBuying] = useState(false);
  const [look] = useState(() => chosen(ZOBO_BOTTLE_KEY, BOTTLE_LOOKS, api.extras?.owned));
  const [shelf] = useState(() => chosen(ZOBO_SHELF_KEY, SHELF_LOOKS, api.extras?.owned));
  const ended = useRef(false);
  const sparkId = useRef(1);
  const apiRef = useRef(api);
  apiRef.current = api;
  const L = useMemo(() => layout(s.bottles.length), [s.bottles.length]);
  const calm = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const art = STALL_ART[stallOf(s.level)]!;

  // Sound: the pour runs as a loop, rising as the bottle fills.
  const audio = useRef<GameAudio | null>(null);
  const stream = useRef<LoopHandle | null>(null);
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the level
  }, []);

  const burst = (i: number, color: string) => {
    const at = L.pos[i]!;
    const id = sparkId.current++;
    setSparks((l) => [...l, { id, x: at.x, y: at.y - BH * L.scale, t0: performance.now(), color }]);
    setTimeout(() => setSparks((l) => l.filter((k) => k.id !== id)), SPARK_MS);
  };

  // Drive the animations: the pour, its sound, and the sparkles after it.
  const moving = !!pouring || sparks.length > 0 || shake !== null;
  useEffect(() => {
    if (!moving) return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      if (pouring) {
        const p = (t - pouring.t0) / POUR_MS;
        if (p >= 0.38 && p < 0.76 && !stream.current) stream.current = audio.current?.loop("zs-pour", { volume: 0.75, rate: 0.85 }) ?? null;
        stream.current?.setRate(0.85 + 0.55 * seg(p, 0.38, 0.74));
        if (p >= 0.76) {
          stream.current?.stop();
          stream.current = null;
        }
        if (p >= 1) {
          const au = audio.current;
          if (pouring.filled) {
            au?.sfx("zs-cork", { volume: 0.8 });
            burst(pouring.to, DRINKS[pouring.drink]!.light);
            navigator.vibrate?.(15);
          }
          if (pouring.revealed) au?.sfx("zs-reveal", { volume: 0.7 });
          if (pouring.opening.length) {
            au?.sfx("zs-crate", { volume: 0.8 });
            pouring.opening.forEach((b) => burst(b, "#e0b070"));
          }
          setPouring(null);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts when something starts or stops moving
  }, [moving, pouring]);

  useEffect(() => {
    api.save(s);
    if (s.won && !ended.current && !pouring) {
      ended.current = true;
      audio.current?.sfx("zs-win", { volume: 0.85 });
      navigator.vibrate?.([30, 60, 30]);
      const stars = s.par != null ? starsFor(s.par, s.moves, s.extra) : 0;
      try {
        sessionStorage.setItem(ZOBO_LAST_KEY, JSON.stringify({ level: s.level, moves: s.moves, par: s.par }));
      } catch {
        // The finish screen just won't show the pours.
      }
      // A moment to enjoy the last bottle before the results.
      setTimeout(() => apiRef.current.end(career ? takings(s.level, stars) : zoboScore(s), { level: s.level, moves: s.moves, stars }), 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state or animation changes
  }, [s, pouring]);

  const refuse = (i: number, why: string) => {
    setShake(i);
    setTimeout(() => setShake(null), 350);
    audio.current?.sfx("zs-wrong", { volume: 0.7 });
    setSel(null);
    setNote(why);
  };

  const crateOn = (i: number, state: ZoboState = s) => state.crates?.find((c) => c.bottle === i && crateShut(state.bottles, c)) ?? null;

  const tap = (i: number) => {
    if (api.paused || pouring || s.won || outOfPours(s)) return;
    setHint(null);
    setNote("");
    const crate = crateOn(i);
    if (crate) return refuse(i, `Finish the ${DRINKS[crate.key]!.name} to open this crate.`);
    if (sel === null) {
      if (!s.bottles[i]!.length) return;
      setSel(i);
      audio.current?.sfx("zs-pick", { volume: 0.8 });
      return;
    }
    if (sel === i) {
      setSel(null);
      audio.current?.sfx("zs-put", { volume: 0.7 });
      return;
    }
    const n = pourAmount(s.bottles, sel, i, s.crates);
    const next = n ? pour(s, sel, i) : null;
    if (!next) return refuse(i, s.bottles[i]!.length >= CAP ? "That bottle is full." : "Pour onto the same drink, or into an empty bottle.");
    const from = s.bottles[sel]!;
    const drink = from[from.length - 1]!;
    const dir: 1 | -1 = L.pos[i]!.x >= VIEW_W / 2 ? 1 : -1;
    const revealed = !!s.covered && next.covered!.some((c, k) => c < s.covered![k]!);
    const opening = (s.crates ?? []).filter((c) => crateShut(s.bottles, c) && !crateShut(next.bottles, c)).map((c) => c.bottle);
    setPouring({ from: sel, to: i, n, drink, t0: performance.now(), dir, covered: s.covered, filled: isFull(next.bottles[i]!), revealed, opening });
    setNow(performance.now());
    setS(next);
    setSel(null);
    setSaid(`Poured ${DRINKS[drink]!.name}.${next.won ? " All sorted!" : ""}`);
  };

  const restart = () => {
    if (pouring) return;
    const base = fresh();
    // A bottle you paid for stays with the level.
    setS(s.extra ? (addBottle(base) ?? base) : base);
    setSel(null);
    setHint(null);
    setNote("");
    audio.current?.sfx("zs-put", { volume: 0.7 });
  };
  const back = () => {
    const u = !pouring ? undo(s) : null;
    if (u) {
      setS(u);
      setSel(null);
      setHint(null);
      audio.current?.sfx("zs-put", { volume: 0.7 });
    }
  };

  /** Pay from savings (nothing to pay in the dev sandbox). */
  const pay = async (kind: HelperId) => {
    if (savings === undefined) return true;
    setBuying(true);
    const r = await buyZoboHelper({ kind });
    setBuying(false);
    if (!r.ok) {
      setNote(r.error);
      return false;
    }
    setSavings(r.data.savings);
    return true;
  };
  const askHint = async () => {
    if (pouring || buying || s.won) return;
    // Look before charging: a shelf with no way through shouldn't cost anything.
    const move = solve(s.bottles, s.crates, 200, 100)?.[0];
    if (!move) return setNote("There's no way through from here. Undo or restart.");
    if (!(await pay("hint"))) return;
    setSel(null);
    setHint(move);
    setNote("Pour from the first glowing bottle into the second.");
    audio.current?.sfx("zs-hint", { volume: 0.8 });
  };
  const askBottle = async () => {
    if (pouring || buying || s.won || s.extra) return;
    if (!(await pay("bottle"))) return;
    setS((cur) => addBottle(cur) ?? cur);
    setSel(null);
    setHint(null);
    setNote("One more bottle. This level can now earn two stars at most.");
    audio.current?.sfx("zs-put", { volume: 0.8 });
  };

  // While pouring, the bottles show the drink part-way across.
  const p = pouring ? (now - pouring.t0) / POUR_MS : 1;
  const q = pouring ? ease(seg(p, 0.38, 0.74)) : 1;
  const asLayers = (b: Bottle, cover = 0): [number, number][] => b.map((d, k) => [k < cover ? COVER : d, 1]);
  const view = (i: number): [number, number][] => {
    const b = s.bottles[i]!;
    // A drink stays covered until the pour that uncovers it has finished.
    const cover = pouring?.covered?.[i] ?? s.covered?.[i] ?? 0;
    if (!pouring) return asLayers(b, cover);
    if (i === pouring.from) return [...asLayers(b, Math.min(cover, b.length)), [pouring.drink, pouring.n * (1 - q)]];
    if (i === pouring.to) {
      const before = b.slice(0, b.length - pouring.n);
      return [...asLayers(before, cover), [pouring.drink, pouring.n * q]];
    }
    return asLayers(b, cover);
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
    const home = ease(seg(p, 0.78, 1));
    const k = go * (1 - home);
    return { x: base.x + (px - base.x) * k, y: base.y + (py - base.y) * k, tilt: ang * ease(seg(p, 0.12, 0.4)) * (1 - home) };
  };

  const drinkGrads = DRINKS.map((d, i) => (
    <linearGradient key={d.id} id={`zd${i}`} x1="0" x2="1">
      <stop offset="0" stopColor={d.dark} />
      <stop offset=".45" stopColor={d.light} />
      <stop offset="1" stopColor={d.dark} />
    </linearGradient>
  ));

  const order = s.bottles.map((_, i) => i).sort((a, b) => (pouring?.from === a ? 1 : pouring?.from === b ? -1 : 0));
  const flow = pouring && p > 0.38 && p < 0.78 ? (() => {
    const src = pose(pouring.from);
    const r = (src.tilt * Math.PI) / 180;
    const mx = src.x + Math.sin(r) * BH * L.scale;
    const my = src.y - Math.cos(r) * BH * L.scale;
    const tgt = L.pos[pouring.to]!;
    const filled = s.bottles[pouring.to]!.length - pouring.n + pouring.n * q;
    const sy = tgt.y - (BASE + filled * UNIT) * L.scale;
    return { mx, my, tx: tgt.x + Math.sin(now / 45) * 1.4, sy, floor: tgt.y - 12 * L.scale, colour: DRINKS[pouring.drink]! };
  })() : null;

  const out = outOfPours(s);
  const stars = s.par != null ? starsFor(s.par, s.moves, s.extra) : null;
  const tool = "flex min-h-[3.1rem] flex-col items-center justify-center rounded-[14px] border-[1.5px] border-[var(--fg)] px-1 py-1 text-[0.82rem] font-bold leading-tight disabled:opacity-40";
  const cost = "text-[0.7rem] font-semibold text-muted";

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[0.92rem] font-bold">
          {s.moves} {s.moves === 1 ? "pour" : "pours"}
          {s.limit != null ? <span className="font-semibold text-muted"> of {s.limit}</span> : null}
        </p>
        {stars !== null ? (
          <p className="text-[1.15rem] leading-none tracking-[-0.05em] text-[#e3a417]" role="img" aria-label={`On course for ${stars} of 3 stars`}>
            {"★".repeat(stars)}
            <span className="text-[#d8cfc4]">{"★".repeat(3 - stars)}</span>
          </p>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div data-tour="zobo-shelf" className="relative mt-2 overflow-hidden rounded-[22px] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]">
        <svg viewBox={`0 0 ${VIEW_W} ${L.height}`} className="block w-full" role="group" aria-label={`Zobo Sort, level ${s.level}. ${s.bottles.length} bottles.`}>
          <defs>
            {drinkGrads}
            <linearGradient id="zdc" x1="0" x2="1">
              <stop offset="0" stopColor="#231a28" />
              <stop offset=".45" stopColor="#40344a" />
              <stop offset="1" stopColor="#231a28" />
            </linearGradient>
            <linearGradient id="zglass" x1="0" x2="1">
              <stop offset="0" stopColor="rgba(255,255,255,.28)" />
              <stop offset=".3" stopColor="rgba(255,255,255,.04)" />
              <stop offset=".8" stopColor="rgba(255,255,255,.02)" />
              <stop offset="1" stopColor="rgba(255,255,255,.22)" />
            </linearGradient>
            <linearGradient id="zwall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={art.wall[0]} />
              <stop offset="1" stopColor={art.wall[1]} />
            </linearGradient>
            <linearGradient id="zwood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={shelf.top} />
              <stop offset="1" stopColor={shelf.bottom} />
            </linearGradient>
          </defs>
          <rect width={VIEW_W} height={L.height} fill="url(#zwall)" />
          <g opacity=".08">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d={`M${i * 34} 0 v${L.height}`} stroke="#6b3f17" strokeWidth="14" />
            ))}
          </g>
          {/* The stall's awning. */}
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M${i * 36} 0 h36 v18 a18 12 0 0 1 -36 0Z`} fill={i % 2 ? art.b : art.a} />
          ))}
          {Array.from({ length: L.rows }, (_, r) => (
            <g key={r}>
              <rect x="0" y={220 + r * SHELF_GAP} width={VIEW_W} height="16" fill="url(#zwood)" />
              <rect x="0" y={236 + r * SHELF_GAP} width={VIEW_W} height="5" fill="rgba(0,0,0,.18)" />
            </g>
          ))}
          {order.map((i) => {
            const at = pose(i);
            const done = isFull(s.bottles[i]!);
            const showDone = done && !(pouring?.to === i);
            const opening = pouring?.opening.includes(i);
            const crate = crateOn(i) ?? (opening ? s.crates!.find((c) => c.bottle === i)! : null);
            const hinted = hint?.[0] === i || hint?.[1] === i;
            const label = crate ? `Crated bottle, opens when the ${DRINKS[crate.key]!.name} is finished` : `Bottle ${i + 1}: ${s.bottles[i]!.length ? s.bottles[i]!.map((d, k) => (k < (s.covered?.[i] ?? 0) ? "covered" : DRINKS[d]!.name)).reverse().join(", top to bottom ") : "empty"}${sel === i ? ", picked up" : ""}`;
            return (
              <g key={i} transform={`translate(${at.x} ${at.y}) scale(${L.scale})`} onClick={() => tap(i)} onFocus={() => setFocus(i)} onBlur={() => setFocus(null)} style={{ cursor: "pointer", outline: "none" }} role="button" aria-label={label} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && tap(i)}>
                <rect x={-BW / 2 - 4} y={-BH - 24} width={BW + 8} height={BH + 30} fill="transparent" />
                <BottleArt id={String(i)} layers={view(i)} tilt={at.tilt} glow={sel === i || focus === i || hinted} wave={!calm && pouring?.to === i && flow ? Math.sin(now / 60) * 3.5 : 0} look={look} night={stallOf(s.level) === 4} corked={showDone} crateKey={crate ? crate.key : null} />
              </g>
            );
          })}
          {flow ? (
            <g pointerEvents="none">
              <path d={`M${flow.mx} ${flow.my} C${flow.mx} ${flow.my + 20} ${flow.tx} ${flow.my + 10} ${flow.tx} ${flow.sy}`} stroke={flow.colour.dark} strokeWidth={8.5 * L.scale} fill="none" strokeLinecap="round" />
              <path d={`M${flow.mx} ${flow.my} C${flow.mx} ${flow.my + 20} ${flow.tx} ${flow.my + 10} ${flow.tx} ${flow.sy}`} stroke={flow.colour.light} strokeWidth={5 * L.scale} fill="none" strokeLinecap="round" />
              {!calm ? <path d={`M${flow.mx} ${flow.my} C${flow.mx} ${flow.my + 20} ${flow.tx} ${flow.my + 10} ${flow.tx} ${flow.sy}`} stroke="rgba(255,255,255,.55)" strokeWidth={1.8 * L.scale} strokeDasharray="9 15" strokeDashoffset={-now / 4} fill="none" strokeLinecap="round" /> : null}
              {!calm
                ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                    // Splashes thrown up from where the stream lands.
                    const life = (now / 430 + k / 8) % 1;
                    const side = k % 2 ? 1 : -1;
                    return <circle key={k} cx={flow.tx + side * (5 + k * 1.6) * life * 2 * L.scale} cy={flow.sy - Math.sin(life * Math.PI) * (13 + (k % 3) * 6) * L.scale} r={(2.8 - life * 1.8) * L.scale} fill={flow.colour.light} stroke={flow.colour.dark} strokeWidth={0.5} />;
                  })
                : null}
              {!calm ? <ellipse cx={flow.tx} cy={flow.sy} rx={(10 + ((now / 7) % 16)) * L.scale} ry={(2 + ((now / 7) % 16) / 5) * L.scale} fill="none" stroke="rgba(255,255,255,.65)" strokeWidth={1.4 * L.scale} opacity={1 - ((now / 7) % 16) / 16} /> : null}
              {!calm
                ? [0, 1, 2, 3, 4, 5].map((k) => {
                    // Bubbles rising through the drink below the surface.
                    const life = (now / 700 + k / 6) % 1;
                    const y = flow.floor + (flow.sy + 5 - flow.floor) * life;
                    return y > flow.sy + 3 ? <circle key={k} cx={flow.tx + Math.sin(k * 2.4 + now / 200) * BW * 0.3 * L.scale} cy={y} r={(1.2 + (k % 3) * 0.7) * L.scale} fill="rgba(255,255,255,.6)" /> : null;
                  })
                : null}
            </g>
          ) : null}
          {sparks.map((k) => {
            const age = seg(now, k.t0, k.t0 + SPARK_MS);
            const reach = ease(age) * 58 * L.scale;
            return (
              <g key={k.id} pointerEvents="none" opacity={1 - age * age}>
                <circle cx={k.x} cy={k.y} r={reach} fill="none" stroke="#f6d26a" strokeWidth={3 * (1 - age)} />
                {Array.from({ length: 10 }, (_, n) => {
                  const a = (n / 10) * Math.PI * 2;
                  return <circle key={n} cx={k.x + Math.cos(a) * reach} cy={k.y + Math.sin(a) * reach + age * age * 16} r={(n % 2 ? 3.2 : 2.2) * (1 - age * 0.6)} fill={n % 2 ? "#f6d26a" : k.color} />;
                })}
              </g>
            );
          })}
        </svg>
        {out ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(28,20,22,.68)] p-6 text-center text-white">
            <p className="display text-[1.9rem] leading-none">Out of pours</p>
            <p className="mt-2 text-[0.92rem]">This level allows {s.limit} pours. Try a shorter way.</p>
            <button type="button" onClick={restart} className="mt-4 h-12 rounded-full bg-[#f2b632] px-6 font-extrabold text-[#2e1408]">Restart level</button>
          </div>
        ) : null}
      </div>
      <p className="mt-2 min-h-[1.4em] text-center text-[0.85rem] font-semibold" aria-live="polite">{note}</p>
      <div data-tour="zobo-undo" className={`mt-1 grid gap-2 ${career ? "grid-cols-4" : "grid-cols-2"}`}>
        <button type="button" onClick={back} disabled={!s.undo.length || s.undosLeft <= 0 || !!pouring || out} className={tool}>
          Undo <span className={cost}>{s.undosLeft} left</span>
        </button>
        <button type="button" onClick={restart} disabled={!!pouring} className={tool}>
          Restart
        </button>
        {career ? (
          <>
            <button type="button" onClick={() => void askHint()} disabled={buying || !!pouring || out || (savings !== undefined && savings < HELPERS.hint.price)} className={tool}>
              Hint <span className={cost}>₦{HELPERS.hint.price}</span>
            </button>
            <button type="button" onClick={() => void askBottle()} disabled={buying || !!pouring || out || !!s.extra || (savings !== undefined && savings < HELPERS.bottle.price)} className={tool}>
              Bottle <span className={cost}>{s.extra ? "Added" : `₦${HELPERS.bottle.price}`}</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
