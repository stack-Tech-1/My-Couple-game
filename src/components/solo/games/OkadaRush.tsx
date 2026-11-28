"use client";

import { useEffect, useRef, useState } from "react";
import { BIKE_LEN, LANES, ROUTES, SIZE, fareStop, isTraffic, newOkada, okadaConfig, progress, stars, steer, stopName, throttle, tick, type Kind, type OkadaEvent, type OkadaState, type Thing } from "@/lib/solo/games/okada";
import type { SoloApi } from "../SoloShell";
import { RATIO } from "./okada-art";
import { GameAudio, musicPreferred, type LoopHandle } from "@/lib/game-audio";

/** Every Okada Rush sound, loaded when the ride opens. */
const SOUNDS = ["ok-engine", "ok-idle", "ok-start", "ok-horn", "ok-pothole", "ok-splash", "ok-sand", "ok-crash", "ok-whistle", "ok-pass", "ok-brakes", "ok-cash", "ok-street", "ok-bridge", "ok-night", "mp-star"];
const VOICES = ["ok-wave", "ok-on", "ok-late", "ok-bump", "ok-paid", "ok-missed", "agbero", "lastma", "conductor", "rider-crash", "rider-go", "rider-horn"].flatMap((g) => [`v-${g}`, ...[1, 2, 3].map((k) => `v-${g}-${k}`)]);

/**
 * Okada Rush: the road seen from above, scrolling down while the okada rides up it. Drawn on a
 * canvas, with the painted art in /public/games/okada (scripts/art/build-okada.mjs) once it's
 * there, and simple shapes standing in until then. The rules live in lib/solo/games/okada.
 */
const W = 360;
const H = 640;
/** Pixels per metre, the road's left edge, a lane's width, and where the okada sits on screen. */
const PX = 20;
const LANE_W = 96;
const ROAD_X = (W - LANE_W * LANES) / 2;
const BIKE_Y = 540;
const laneX = (l: number) => ROAD_X + (l + 0.5) * LANE_W;

/** Each route's road. */
const ROADS = [
  { asphalt: "#4b4446", line: "#f1ead8", kerb: ["#f2b705", "#1c1416"], side: "#b8653b", dark: false },
  { asphalt: "#555052", line: "#f1ead8", kerb: ["#d7d2c8", "#8f8a82"], side: "#9d9a93", dark: false },
  { asphalt: "#5e5a58", line: "#f6f1e4", kerb: ["#c9c4bb", "#c9c4bb"], side: "#2f8f9b", dark: false },
  { asphalt: "#2f2b2c", line: "#ffffff", kerb: ["#f4f1ea", "#f4f1ea"], side: "#d8b779", dark: false },
  { asphalt: "#262124", line: "#e6dccb", kerb: ["#8c8580", "#8c8580"], side: "#4a4447", dark: true },
] as const;
const ROAD_OF = (mode: string) => {
  const r = /^route-([1-5])$/.exec(mode);
  return r ? Number(r[1]) - 1 : 1;
};

/** Stand-in looks until the painted art arrives. */
const LOOK: Partial<Record<Kind, { fill: string; w: number; roof?: string }>> = {
  danfo: { fill: "#f2b705", w: 2.3, roof: "#1c1416" },
  keke: { fill: "#3f9a5c", w: 1.5, roof: "#f2d27a" },
  car: { fill: "#b9c2c9", w: 1.9 },
  suv: { fill: "#232026", w: 2.1 },
  brt: { fill: "#2f62b5", w: 2.5, roof: "#dfe8f5" },
  truck: { fill: "#c8452f", w: 2.5, roof: "#7d7a76" },
};
const PEOPLE = ["#e8563a", "#2f62b5", "#7a3fa8", "#d9a400", "#3f8a5c", "#ece4d6"];

type Fx = { id: number; text: string; color: string; x: number; y: number; big?: boolean };

/** Passengers just dropped, standing at their stop with the fare: stop id → who, and until when. */
const PAID = new Map<number, { look: number; until: number }>();

const imgs = new Map<string, HTMLImageElement>();
/** A painted picture, once it has loaded (null until then, or if there isn't one). */
function sprite(name: string) {
  if (!RATIO[name]) return null;
  let im = imgs.get(name);
  if (!im) {
    im = new Image();
    im.src = `/games/okada/${name}.webp`;
    imgs.set(name, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = "#1c1416") {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = stroke;
  c.stroke();
}

function draw(c: CanvasRenderingContext2D, s: OkadaState, road: number, skin: string, time: number) {
  const R = ROADS[road] ?? ROADS[0];
  const sy = (wy: number) => BIKE_Y - (wy - s.y) * PX;
  const scroll = (s.y * PX) % 80;
  // Pavements, kerbs, asphalt, lane lines.
  c.fillStyle = R.side;
  c.fillRect(0, 0, W, H);
  const bg = sprite(`road-${road + 1}`);
  if (bg) {
    const h = W / (RATIO[`road-${road + 1}`] ?? 0.667);
    const off = (s.y * PX) % h;
    for (let y = off - h; y < H; y += h) c.drawImage(bg, 0, y, W, h);
  } else {
    // Pavement texture and roadside bits, so the speed shows.
    for (let y = -80 + scroll; y < H; y += 80) {
      c.fillStyle = "rgba(0,0,0,.08)";
      c.fillRect(6, y, ROAD_X - 18, 2);
      c.fillRect(W - ROAD_X + 12, y + 40, ROAD_X - 18, 2);
    }
    c.fillStyle = R.asphalt;
    c.fillRect(ROAD_X, 0, LANE_W * LANES, H);
    for (let y = -40 + (scroll % 40); y < H; y += 40) {
      c.fillStyle = R.kerb[Math.floor((y - scroll) / 40) % 2 === 0 ? 0 : 1]!;
      c.fillRect(ROAD_X - 7, y, 7, 40);
      c.fillRect(ROAD_X + LANE_W * LANES, y, 7, 40);
    }
    c.fillStyle = R.line;
    for (let l = 1; l < LANES; l++) for (let y = -80 + scroll; y < H; y += 80) c.fillRect(ROAD_X + l * LANE_W - 2, y, 4, 40);
  }

  // Where your passenger is going: the kerb lane lights up as their stop comes.
  const stop = fareStop(s);
  if (stop) {
    const top = sy(stop.y + SIZE.stop.len);
    if (top < H && top > -200) {
      c.fillStyle = `rgba(46,155,87,${0.18 + 0.1 * Math.sin(time * 6)})`;
      c.fillRect(laneX(stop.lane) - LANE_W / 2, top - 40, LANE_W, 80 + SIZE.stop.len * PX);
    }
  }

  roadside(c, s, road, sy);
  // Everything on the road and at the kerb, furthest first.
  const things = [...s.things].sort((a, b) => b.y - a.y);
  for (const t of things) {
    const len = SIZE[t.kind].len;
    const yb = sy(t.y);
    const yt = sy(t.y + len);
    if (yb < -20 || yt > H + 20) continue;
    drawThing(c, t, laneX(t.lane), yt, yb, s, time);
  }

  // The okada, sliding between lanes, wobbling after a pothole.
  const bx = laneX(s.x) + (s.slow > 0 ? Math.sin(time * 40) * 3 : 0);
  const lean = s.lane < s.x - 0.04 ? "-l" : s.lane > s.x + 0.04 ? "-r" : "";
  // Coloured bikes come without a passenger or a lean: those use the red one's pictures.
  const coloured = skin !== "red" && !s.fare && RATIO[`okada-${skin}`] ? `okada-${skin}` : null;
  const name = coloured ?? `okada${s.fare ? "-p" : ""}${lean}`;
  const pic = sprite(name);
  const bh = 76;
  if (pic) {
    const bw = bh * (RATIO[name] ?? 0.48);
    c.save();
    c.translate(bx, BIKE_Y - bh / 2);
    if (coloured) c.rotate((s.lane - s.x) * 0.22);
    c.drawImage(pic, -bw / 2, -bh / 2, bw, bh);
    c.restore();
  } else {
    c.save();
    c.translate(bx, BIKE_Y - BIKE_LEN * PX * 0.55);
    c.rotate((s.lane - s.x) * 0.25);
    rounded(c, -7, -24, 14, 48, 7, skin === "blue" ? "#2f62b5" : skin === "gold" ? "#d9a400" : skin === "black" ? "#2a2526" : "#d23a2b");
    c.beginPath();
    c.arc(0, -4, 8, 0, Math.PI * 2);
    c.fillStyle = "#3f8a5c";
    c.fill();
    c.stroke();
    if (s.fare) {
      c.beginPath();
      c.arc(0, 12, 7, 0, Math.PI * 2);
      c.fillStyle = PEOPLE[s.fare.look % PEOPLE.length]!;
      c.fill();
      c.stroke();
    }
    c.restore();
  }

  // Brake light: a passenger on or off, an agbero, a pothole's jolt, LASTMA.
  if ((s.pause ?? 0) > 0 || s.held > 0) {
    c.save();
    c.fillStyle = "#ff3a2a";
    c.shadowColor = "#ff3a2a";
    c.shadowBlur = 14;
    c.beginPath();
    c.arc(bx, BIKE_Y - 3, 4.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Night in VI: only what your headlight and the street lights show.
  if (R.dark) {
    const g = c.createRadialGradient(bx, BIKE_Y - 140, 30, bx, BIKE_Y - 120, 330);
    g.addColorStop(0, "rgba(10,8,14,0)");
    g.addColorStop(1, "rgba(10,8,14,.72)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
}

function drawThing(c: CanvasRenderingContext2D, t: Thing, x: number, yt: number, yb: number, s: OkadaState, time: number) {
  if (t.kind === "passenger" && t.taken) return;
  const name = t.kind === "passenger" ? `passenger-${(t.look ?? 0) % 6}` : t.kind;
  const pic = sprite(name);
  const kerbX = t.lane === 0 ? ROAD_X - 26 : W - ROAD_X + 26;
  if (pic) {
    const r = RATIO[name] ?? 1;
    if (isTraffic(t.kind)) {
      // Drawn to its real length.
      const h = yb - yt;
      c.drawImage(pic, x - (h * r) / 2, yt, h * r, h);
      if (t.stopT) brakeLights(c, x, yb, (h * r) / 2 - 6);
    } else if (HAZARD_W[t.kind]) {
      const w = HAZARD_W[t.kind]!;
      c.drawImage(pic, x - w / 2, (yt + yb) / 2 - w / r / 2, w, w / r);
    } else if (t.kind === "stop") {
      const mine = s.fare?.stopId === t.id;
      const w = 64;
      const sx = t.lane === 0 ? 30 : W - 30;
      if (mine) {
        c.beginPath();
        c.ellipse(sx, yb - w / 2, w * 0.62, w * 0.62, 0, 0, Math.PI * 2);
        c.fillStyle = `rgba(46,155,87,${0.35 + 0.15 * Math.sin(time * 6)})`;
        c.fill();
      }
      c.drawImage(pic, sx - w / 2, yb - w / r, w, w / r);
      nameTag(c, stopName(s, t), sx, yb - w / r - 4, t.lane === 0 ? "left" : "right", mine);
      const paid = PAID.get(t.id);
      const who = paid && time < paid.until ? sprite(`paid-${paid.look % 6}`) : null;
      if (who) {
        const ph = 52;
        const pr = RATIO[`paid-${paid!.look % 6}`] ?? 0.75;
        c.drawImage(who, (t.lane === 0 ? sx + 22 : sx - 22) - (ph * pr) / 2, yb - ph, ph * pr, ph);
      }
    } else {
      // People: passengers on the pavement, agberos and LASTMA at the kerb's edge of the road.
      const h = t.kind === "passenger" ? 54 : 50;
      const px = t.kind === "passenger" ? (t.lane === 0 ? 20 : W - 20) : t.lane === 0 ? ROAD_X + 16 : W - ROAD_X - 16;
      const bob = t.kind === "passenger" && !t.done ? Math.sin(time * 8 + t.id) * 1.5 : 0;
      if (t.kind === "passenger" && !t.done && !s.fare) {
        c.beginPath();
        c.ellipse(px, yb - 8, 24, 10, 0, 0, Math.PI * 2);
        c.fillStyle = `rgba(242,183,5,${0.45 + 0.2 * Math.sin(time * 6)})`;
        c.fill();
      }
      c.drawImage(pic, px - (h * r) / 2, yb - h + bob, h * r, h);
    }
    return;
  }
  const look = LOOK[t.kind];
  if (look) {
    const w = look.w * PX;
    rounded(c, x - w / 2, yt, w, yb - yt, 7, look.fill);
    if (look.roof) {
      c.fillStyle = look.roof;
      c.fillRect(x - w / 2 + 5, yt + 10, w - 10, Math.max(4, (yb - yt) * 0.18));
    }
    c.fillStyle = "rgba(160,210,235,.85)";
    c.fillRect(x - w / 2 + 5, yt + 4, w - 10, 6);
    if (t.stopT) brakeLights(c, x, yb, w / 2 - 4);
    return;
  }
  switch (t.kind) {
    case "pothole":
    case "deep": {
      c.beginPath();
      c.ellipse(x, (yt + yb) / 2, t.kind === "deep" ? 24 : 16, (yb - yt) / 2, 0, 0, Math.PI * 2);
      c.fillStyle = t.kind === "deep" ? "#140f10" : "#2a2224";
      c.fill();
      c.strokeStyle = "#776b63";
      c.lineWidth = 3;
      c.stroke();
      break;
    }
    case "puddle":
      c.beginPath();
      c.ellipse(x, (yt + yb) / 2, 26, (yb - yt) / 2, 0, 0, Math.PI * 2);
      c.fillStyle = "rgba(120,92,60,.75)";
      c.fill();
      break;
    case "sand":
      c.beginPath();
      c.ellipse(x, (yt + yb) / 2, 24, (yb - yt) / 2, 0, 0, Math.PI * 2);
      c.fillStyle = "#d9b26a";
      c.fill();
      break;
    case "cone":
      c.beginPath();
      c.moveTo(x, yt);
      c.lineTo(x + 9, yb);
      c.lineTo(x - 9, yb);
      c.closePath();
      c.fillStyle = "#f07a1a";
      c.fill();
      c.stroke();
      break;
    case "barrier":
      for (let k = 0; k < 6; k++) {
        c.fillStyle = k % 2 ? "#ffffff" : "#d0302a";
        c.fillRect(x - 36 + k * 12, yt, 12, yb - yt + 6);
      }
      break;
    case "stop": {
      const mine = s.fare?.stopId === t.id;
      rounded(c, kerbX - 20, yt, 40, yb - yt, 5, mine ? "#2e9b57" : "#f2b705");
      c.fillStyle = "#1c1416";
      c.font = "800 9px Manrope, sans-serif";
      c.textAlign = "center";
      c.save();
      c.translate(kerbX, (yt + yb) / 2);
      c.rotate(-Math.PI / 2);
      c.fillText(stopName(s, t).slice(0, 14), 0, 3);
      c.restore();
      break;
    }
    case "passenger":
    case "agbero":
    case "lastma": {
      const wave = t.kind === "passenger" && !t.done ? Math.sin(time * 9 + t.id) * 4 : 0;
      const col = t.kind === "agbero" ? "#5b4a3a" : t.kind === "lastma" ? "#f2d23a" : PEOPLE[(t.look ?? 0) % PEOPLE.length]!;
      const px = t.kind === "passenger" ? kerbX : t.lane === 0 ? ROAD_X + 12 : W - ROAD_X - 12;
      c.beginPath();
      c.arc(px, yb - 10, 10, 0, Math.PI * 2);
      c.fillStyle = col;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = "#1c1416";
      c.stroke();
      c.beginPath();
      c.moveTo(px + (t.lane === 0 ? 7 : -7), yb - 14);
      c.lineTo(px + (t.lane === 0 ? 18 : -18), yb - 28 + wave);
      c.stroke();
      if (t.kind === "passenger" && !t.done && !s.fare) {
        c.beginPath();
        c.arc(px, yb - 10, 16 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
        c.strokeStyle = "rgba(242,183,5,.9)";
        c.lineWidth = 3;
        c.stroke();
      }
      break;
    }
  }
}

/** How wide road hazards are drawn (their length on the road is the rules' business). */
const HAZARD_W: Partial<Record<Kind, number>> = { pothole: 46, deep: 60, puddle: 62, cone: 28, sand: 56, barrier: 84 };

/** A bus stop's name on a little sign, kept on screen. */
function nameTag(c: CanvasRenderingContext2D, text: string, x: number, y: number, side: "left" | "right", mine: boolean) {
  c.font = "800 10px Manrope, sans-serif";
  const w = c.measureText(text).width + 12;
  const left = side === "left" ? Math.max(2, x - w / 2) : Math.min(W - w - 2, x - w / 2);
  c.beginPath();
  c.roundRect(left, y - 15, w, 16, 8);
  c.fillStyle = mine ? "#2e9b57" : "rgba(28,20,22,.82)";
  c.fill();
  c.fillStyle = "#fff";
  c.textAlign = "left";
  c.fillText(text, left + 6, y - 3.5);
}

/** Roadside life on the pavements, the same every time you pass a spot. */
const PROPS: readonly (readonly string[])[] = [
  ["kiosk", "mallam", "tyres", "fruit", "streetlight", "generator"],
  ["kiosk", "streetlight", "generator", "tyres", "mallam"],
  [],
  ["palm", "streetlight", "fruit", "palm"],
  ["palm"],
];
function roadside(c: CanvasRenderingContext2D, s: OkadaState, road: number, sy: (wy: number) => number) {
  const list = PROPS[road] ?? [];
  if (!list.length) return;
  const gap = 18;
  for (let k = Math.floor((s.y - 12) / gap); k * gap < s.y + 34; k++) {
    const h = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
    if (h < 0.45) continue;
    const side = h < 0.72 ? 0 : 2;
    const wy = k * gap + (h * 97) % 8;
    // Leave room for bus stops and people at the kerb.
    if (s.things.some((t) => (t.kind === "stop" || t.kind === "passenger") && t.lane === side && Math.abs(t.y - wy) < 6)) continue;
    const name = list[Math.floor(h * 1000) % list.length]!;
    const pic = sprite(name);
    if (!pic) continue;
    const r = RATIO[name] ?? 1;
    const w = name === "streetlight" ? 22 : 34;
    const x = side === 0 ? 17 : W - 17;
    c.drawImage(pic, x - w / 2, sy(wy) - w / r, w, w / r);
  }
}

function brakeLights(c: CanvasRenderingContext2D, x: number, yb: number, half: number) {
  c.fillStyle = "#ff3a2a";
  c.shadowColor = "#ff3a2a";
  c.shadowBlur = 10;
  c.fillRect(x - half, yb - 5, 7, 5);
  c.fillRect(x + half - 7, yb - 5, 7, 5);
  c.shadowBlur = 0;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function OkadaRush({ api }: { api: SoloApi<OkadaState> }) {
  const mode = api.mode || "free";
  const road = ROAD_OF(mode);
  const skin = api.extras?.skin?.replace(/^skin-/, "") ?? "red";
  const [s, setS] = useState<OkadaState>(() => api.saved ?? newOkada(api.seed, okadaConfig(mode, api.extras?.owned ?? [])));
  const state = useRef(s);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const [said, setSaid] = useState("");
  const [count, setCount] = useState(api.saved ? 0 : 3);
  const fxId = useRef(1);
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const shake = useRef(0);
  // Sound: the engine and the street keep going; everything else is a one-off.
  const audio = useRef<GameAudio | null>(null);
  const engine = useRef<LoopHandle | null>(null);
  const street = useRef<LoopHandle | null>(null);
  const [music, setMusic] = useState(true);
  // The throttle: held with a thumb on the pedal (or the up arrow / space on a keyboard).
  const [gas, setGas] = useState(false);
  const gasOn = (on: boolean) => {
    state.current = throttle(state.current, on);
    setGas(on);
  };
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload([...SOUNDS, ...VOICES]);
    setMusic(musicPreferred());
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the ride
  }, []);
  // "Go!": the okada starts, the street comes alive.
  useEffect(() => {
    const au = audio.current;
    if (count > 0 || !au || state.current.over || engine.current) return;
    au.sfx("ok-start", { volume: 0.8 });
    au.voice("rider-go", 0, 0.9);
    engine.current = au.loop("ok-engine", { volume: 0.5, rate: 0.8 });
    street.current = au.loop(road === 2 ? "ok-bridge" : road === 4 ? "ok-night" : "ok-street", { volume: 0.3 });
    au.music("ok-music-ride", 0.24);
  }, [count, road]);

  // Ready, steady, go.
  useEffect(() => {
    if (count <= 0) return;
    const id = setTimeout(() => setCount((n) => n - 1), 650);
    return () => clearTimeout(id);
  }, [count]);
  const holding = useRef(true);
  holding.current = count > 0;

  const pop = (text: string, color: string, x: number, y: number, big = false) => {
    const id = fxId.current++;
    setFx((l) => [...l, { id, text, color, x, y, big }]);
    setTimeout(() => setFx((l) => l.filter((f) => f.id !== id)), 1300);
  };

  const react = (e: OkadaEvent, at: OkadaState) => {
    const au = audio.current;
    const bx = laneX(at.x);
    switch (e.kind) {
      case "brake":
        // A danfo pulling up: brakes, and its conductor shouting for passengers.
        au?.sfx("ok-brakes", { volume: 0.6 });
        au?.voice("conductor", 9, 0.7);
        break;
      case "pick":
        au?.sfx("ok-cash", { volume: 0.4 });
        au?.voice("ok-on", 3);
        navigator.vibrate?.(15);
        if (e.paid) pop(`+${naira(e.paid)}`, "#2e7d32", bx + 30, BIKE_Y - 96, true);
        pop(`${e.stop}, abeg!`, "#1c1416", bx, BIKE_Y - 70);
        setSaid(`Passenger on. Drop them at ${e.stop}.`);
        break;
      case "drop":
        PAID.set(e.stopId, { look: e.look, until: performance.now() / 1000 + 1.8 });
        au?.sfx("ok-cash");
        au?.voice("ok-paid", 2);
        navigator.vibrate?.(20);
        pop(`+${naira(e.paid + e.tip)}`, "#2e7d32", bx, BIKE_Y - 70, true);
        if (e.tip) pop(`${naira(e.tip)} tip!`, "#b0730a", bx, BIKE_Y - 40);
        setSaid(`Dropped at ${e.stop}. ${naira(e.paid + e.tip)}.`);
        break;
      case "missed":
        au?.voice("ok-missed", 2);
        pop("Oga, you pass my stop!", "#b8261a", bx, BIKE_Y - 70);
        setSaid(`Missed ${e.stop}. Half fare, ${naira(e.paid)}.`);
        break;
      case "bump":
        au?.sfx("ok-pothole");
        if (at.fare) setTimeout(() => audio.current?.voice("ok-bump", 6), 350);
        navigator.vibrate?.(50);
        shake.current = 0.45;
        pop(e.saved ? "Spare tyre saved you!" : "Gbam!", "#b8261a", bx, BIKE_Y - 60);
        break;
      case "slow":
        au?.sfx(e.what === "puddle" ? "ok-splash" : e.what === "sand" ? "ok-sand" : "ok-pothole", { volume: 0.7 });
        break;
      case "agbero":
        au?.voice("agbero", 3);
        pop(`Agbero: -${naira(e.paid)}`, "#b8261a", bx, BIKE_Y - 70);
        setSaid(`An agbero took ${naira(e.paid)}.`);
        break;
      case "lastma":
        au?.sfx("ok-whistle");
        setTimeout(() => audio.current?.voice("lastma", 3), 500);
        pop(`LASTMA! -${naira(e.paid)}`, "#b8261a", bx, BIKE_Y - 70);
        setSaid(`LASTMA stopped you: ${naira(e.paid)}.`);
        break;
      case "km":
        au?.sfx("mp-star");
        pop(`1 km! +${naira(e.paid)}`, "#2e7d32", bx, BIKE_Y - 70, true);
        break;
      case "blocked":
        au?.sfx("ok-horn");
        au?.voice("rider-horn", 12, 0.8);
        pop("Pim pim!", "#1c1416", bx, BIKE_Y - 50);
        break;
      case "crash":
        au?.sfx("ok-crash");
        au?.voice("rider-crash", 0);
        au?.stopLoops();
        au?.music(null);
        navigator.vibrate?.([60, 40, 90]);
        shake.current = 0.6;
        setSaid("Crash! The ride is over.");
        break;
      case "finish":
        au?.sfx("mp-star");
        au?.stopLoops();
        au?.music(null);
        setSaid("End of the route!");
        break;
    }
  };

  // The loop: the rules tick at a steady 60 a second; the road is drawn every frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let saved = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const a = apiRef.current;
      if (!a.paused && !holding.current && !state.current.over) {
        acc += dt;
        while (acc >= 1 / 60) {
          acc -= 1 / 60;
          const r = tick(a.seed, state.current, 1 / 60);
          state.current = r.state;
          for (const e of r.events) react(e, r.state);
          if (r.state.over) break;
        }
        const cur = state.current;
        engine.current?.setRate(cur.held > 0 ? 0.6 : 0.7 + 0.75 * Math.min(1, cur.v / cur.cfg.vmax));
        engine.current?.setVolume(0.5);
        const au = audio.current;
        if (au && !cur.fare && cur.things.some((t) => t.kind === "passenger" && !t.done && t.y - cur.y > 8 && t.y - cur.y < 20)) au.voice("ok-wave", 7, 0.75);
        if (au && cur.fare && cur.stuck) au.voice("ok-late", 8);
        saved += dt;
        if (saved > 1 || state.current.over) {
          saved = 0;
          setS(state.current);
        }
      } else {
        acc = 0;
        if (a.paused) engine.current?.setVolume(0);
      }
      shake.current = Math.max(0, shake.current - dt);
      const cv = canvas.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) {
        const k = cv.width / W;
        ctx.setTransform(k, 0, 0, k, shake.current ? (Math.random() - 0.5) * 10 * shake.current : 0, 0);
        draw(ctx, state.current, road, skin, now / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one loop for the life of the ride
  }, []);

  useEffect(() => {
    if (api.paused) gasOn(false);
  }, [api.paused]);

  useEffect(() => {
    audio.current?.pauseMusic(api.paused);
    street.current?.setVolume(api.paused ? 0 : 0.3);
  }, [api.paused]);

  // A sharp canvas on any screen.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const fit = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientWidth * dpr * (H / W));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    api.save(s);
    if (s.over && !ended.current) {
      ended.current = true;
      api.end(s.money, { m: Math.round(s.y), served: s.served, missed: s.missed, crashed: s.end === "crash", ...(s.cfg.length ? { stars: stars(s) } : {}) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  const go = (d: -1 | 1) => {
    if (apiRef.current.paused || holding.current) return;
    state.current = steer(state.current, d);
  };
  useEffect(() => {
    const isGas = (k: string) => k === "ArrowUp" || k === "w" || k === " ";
    const onKey = (e: KeyboardEvent) => {
      if (isGas(e.key)) {
        e.preventDefault();
        if (!e.repeat && !apiRef.current.paused) gasOn(true);
        return;
      }
      const d = ({ ArrowLeft: -1, ArrowRight: 1, a: -1, d: 1 } as Record<string, -1 | 1>)[e.key];
      if (d) {
        e.preventDefault();
        go(d);
      }
    };
    const onUp = (e: KeyboardEvent) => isGas(e.key) && gasOn(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const cur = state.current;
  const stop = fareStop(cur);
  const owned = api.extras?.owned ?? [];
  const p = progress(cur);
  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular" aria-label={`${naira(cur.money)} taken`}>
          {naira(cur.money)}
          {cur.cfg.length ? (
            <span className="ml-1.5 align-middle text-[1rem] text-[#e3a417]">
              {"★".repeat(stars(cur))}
              <span className="opacity-30">{"★".repeat(3 - stars(cur))}</span>
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => {
            setMusic((m) => !m);
            audio.current?.setMusic(!music);
          }}
          aria-pressed={music}
          aria-label={music ? "Music on. Turn it off" : "Music off. Turn it on"}
          className={`glass ml-auto mr-2 h-9 w-9 shrink-0 rounded-full text-[1rem] ${music ? "" : "opacity-45 line-through"}`}
        >
          ♪
        </button>
        <p className="text-right text-[0.8rem] font-semibold leading-tight text-muted">
          {ROUTES[road] && /^route-/.test(mode) ? ROUTES[road] : "Free Ride"}
          <br />
          {cur.y < 1000 ? `${Math.round(cur.y)} m` : `${(cur.y / 1000).toFixed(2)} km`}
        </p>
      </div>
      {cur.cfg.length ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(28,20,22,.12)]" aria-hidden>
          <div className="h-full rounded-full bg-[#f2b705]" style={{ width: `${p * 100}%` }} />
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      <div data-tour="okada-road" className="relative mt-2">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Okada Rush. ${naira(cur.money)}. Lane ${cur.lane + 1} of 3. Swipe or use the arrow keys to change lane.`}
          className="block aspect-[9/16] max-h-[68vh] w-full touch-none rounded-[18px] border-[3px] border-[#2a1a05] bg-[#4b4446] shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)]"
          onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY, t: performance.now() })}
          onPointerMove={(e) => {
            const t = touch.current;
            if (!t) return;
            const dx = e.clientX - t.x;
            if (Math.abs(dx) < 24) return;
            go(dx > 0 ? 1 : -1);
            touch.current = { x: e.clientX, y: e.clientY, t: performance.now() };
          }}
          onPointerUp={(e) => {
            const t = touch.current;
            touch.current = null;
            // A tap (not a swipe): steer towards that side.
            if (t && Math.abs(e.clientX - t.x) < 10 && performance.now() - t.t < 300) {
              const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
              go(e.clientX - r.left < r.width / 2 ? -1 : 1);
            }
          }}
        />
        {/* Your passenger's stop: the name, and with the phone holder how far and which side. */}
        {cur.fare ? (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-[rgba(255,250,242,.94)] px-3 py-1 text-center text-[0.8rem] font-bold text-[#1c1416] shadow">
            To {cur.fare.stop}
            {owned.includes("phone") && stop ? ` · ${Math.max(0, Math.round(stop.y - cur.y))} m ${stop.lane === 0 ? "◀ left" : "right ▶"}` : ""}
            {cur.stuck ? " · I dey late o!" : ""}
          </div>
        ) : null}
        {fx.map((f) => (
          <span
            key={f.id}
            className="mp-float pointer-events-none absolute -translate-x-1/2 whitespace-nowrap font-[Fraunces,serif] font-black"
            style={{ left: `${(f.x / W) * 100}%`, top: `${(f.y / H) * 100}%`, color: f.color, fontSize: f.big ? "1.5rem" : "0.95rem", textShadow: "0 0 3px #fffaf0, 0 0 3px #fffaf0, 0 0 3px #fffaf0" }}
          >
            {f.text}
          </span>
        ))}
        {/* Holding the throttle: the road rushes past. */}
        {gas && !cur.over ? (
          <>
            <div aria-hidden className="ok-rush pointer-events-none absolute inset-x-[18%] bottom-0 top-[10%]" />
            <div aria-hidden className="pointer-events-none absolute right-3 top-11 rounded-full bg-[rgba(255,250,242,.94)] px-2.5 py-0.5 text-[0.8rem] font-extrabold text-[#1c1416] shadow">Fast × 1.5</div>
          </>
        ) : null}
        {!cur.over ? (
          <button
            type="button"
            data-tour="okada-gas"
            aria-label="Throttle: hold to go faster"
            aria-pressed={gas}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              if (!apiRef.current.paused && !holding.current) gasOn(true);
            }}
            onPointerUp={() => gasOn(false)}
            onPointerCancel={() => gasOn(false)}
            onLostPointerCapture={() => gasOn(false)}
            onContextMenu={(e) => e.preventDefault()}
            className={`absolute bottom-10 left-[1.5%] flex h-[60px] w-[60px] touch-none select-none flex-col items-center justify-center rounded-full border-[3px] text-center font-extrabold leading-none shadow-[0_8px_18px_-6px_rgba(0,0,0,.7)] transition-[transform,background-color] duration-100 ${gas ? "scale-[.94] border-[#fffaf0] bg-[#f2b705] text-[#1c1416] shadow-[0_0_0_8px_rgba(242,183,5,.35)]" : "border-[rgba(255,250,242,.85)] bg-[rgba(28,20,22,.72)] text-[#fffaf0]"}`}
          >
            <span className="text-[1.15rem]">»</span>
            <span className="mt-0.5 text-[0.56rem] font-bold">{gas ? "Faster" : <>Hold to<br />go faster</>}</span>
          </button>
        ) : null}
        {count > 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="display text-[4.5rem] text-white [text-shadow:0_4px_0_#1c1416]">{count === 1 ? "Go!" : count - 1}</span>
          </div>
        ) : null}
      </div>
      <div data-tour="okada-keys" className="mx-auto mt-3 grid max-w-[260px] grid-cols-2 gap-3">
        <button type="button" aria-label="Left lane" onClick={() => go(-1)} className="glass h-14 rounded-[16px] text-[1.4rem] font-bold">
          ◀
        </button>
        <button type="button" aria-label="Right lane" onClick={() => go(1)} className="glass h-14 rounded-[16px] text-[1.4rem] font-bold">
          ▶
        </button>
      </div>
      <p className="mt-3 text-center text-[0.8rem] text-muted">Swipe or tap a side to change lane, and hold the pedal to go faster. Ride past a waving passenger in the kerb lane, then drop them at their stop.</p>
      <style>{`.ok-rush { background: repeating-linear-gradient(90deg, transparent 0 14%, rgba(255,250,242,.5) 14% 15%, transparent 15% 31%, rgba(255,250,242,.35) 31% 31.6%, transparent 31.6% 58%, rgba(255,250,242,.45) 58% 58.8%, transparent 58.8% 82%, rgba(255,250,242,.4) 82% 82.8%, transparent 82.8%); -webkit-mask: repeating-linear-gradient(180deg, #000 0 9%, transparent 9% 22%); mask: repeating-linear-gradient(180deg, #000 0 9%, transparent 9% 22%); animation: ok-rush .45s linear infinite; } @keyframes ok-rush { from { transform: translateY(-12%); } to { transform: translateY(10%); } } @media (prefers-reduced-motion: reduce) { .ok-rush { animation: none; opacity: .5; } } .mp-float { animation: ok-float 1.3s ease-out both; } @keyframes ok-float { 0% { transform: translate(-50%, 6px) scale(.8); opacity: 0; } 15% { transform: translate(-50%, 0) scale(1.08); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(-50%, -34px); opacity: 0; } } @media (prefers-reduced-motion: reduce) { .mp-float { animation-duration: .01s; } }`}</style>
    </div>
  );
}
