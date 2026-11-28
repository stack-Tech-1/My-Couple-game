"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ITEM_NAME,
  SPOTS,
  WALK_SECONDS,
  atCounter,
  add,
  bin,
  buyGas,
  configFor,
  fry,
  gasLeft,
  gasMax,
  gasPrice,
  kitchenOf,
  newMama,
  rulesOf,
  rushTime,
  select,
  serve,
  stars,
  tick,
  tutorialStep,
  type Customer,
  type Item,
  type MamaState,
} from "@/lib/solo/games/mama";
import type { SoloApi } from "../SoloShell";
import { GameAudio, musicPreferred, type LoopHandle } from "@/lib/game-audio";

/** Each restaurant's music and its cooker's sound. */
const MUSIC = ["mp-music-yaba", "mp-music-ikeja", "mp-music-surulere", "mp-music-lekki", "mp-music-vi"];
const COOKING = ["mp-sizzle", "mp-amala", "mp-grill", "mp-deepfry", "mp-simmer"];
const SOUNDS = [...COOKING, "mp-oil-drop", "mp-burnt", "mp-gas-out", "mp-gas-new", "mp-charcoal", "mp-scoop", "mp-plate", "mp-bin", "mp-coins", "mp-bell", "mp-star", "mp-street"];
const VOICES = ["mp-hello", "mp-wait", "mp-angry", "mp-wrong", "mp-happy", "mp-tip", "mama-welcome", "mama-well-done", "mama-burnt"].flatMap((g) => [`v-${g}`, ...[1, 2, 3].map((k) => `v-${g}-${k}`)]);
import { DRINKS, bubblePic, cookPic, fuelPic, lookOf, picturesFor, platePic, ratio, src, type Look, type Station } from "../mama/looks";

/**
 * Mama Put, played sideways: the restaurant across the top, the counter with four places, and
 * the kitchen in two rows across the front. Drawn with the painted art in /public/games/mama-put
 * (made by scripts/art); each area's restaurant has its own look (mama/looks.ts). The rules live in lib/solo/games/mama; this draws them and turns taps
 * into moves.
 *
 * On a phone it asks to go full screen and turn sideways (Android locks to landscape; an iPhone
 * held upright gets a "turn your phone" screen, and the game waits).
 */
const W = 800;
const H = 400;

/** Where the customers stand, and how tall they are. Everything else is in the area's look. */
const L = {
  spotX: [110, 300, 500, 690] as const,
  customerHeight: 152,
  bubbleY: 6,
};
const PEOPLE = ["aunty", "fila", "corper", "student", "oga", "baba"] as const;

/** A picture placed by its bottom-centre point, at a given width. */
function Pic({
  name,
  x,
  bottom,
  w,
  className,
  style,
}: {
  name: string;
  x: number;
  bottom: number;
  w: number;
  className?: string;
  style?: CSSProperties;
}) {
  const h = w / ratio(name);
  return (
    <image
      href={src(name)}
      x={x - w / 2}
      y={bottom - h}
      width={w}
      height={h}
      className={className}
      style={style}
    />
  );
}


function mood(c: Customer, time: number): "happy" | "wait" | "angry" {
  if (c.leaving) return c.leaving.paid > 0 ? "happy" : "angry";
  if (c.rejected != null && time - c.rejected < 1.4) return "angry";
  return c.patience / c.max > 0.3 ? "wait" : "angry";
}

/** Who's at each place: each customer gets a character, never the same one twice at the counter. */
function cast(spots: MamaState["spots"]): string[] {
  const used = new Set<string>();
  return spots.map((c) => {
    if (!c) return "";
    let k = (c.look.cloth + c.id) % PEOPLE.length;
    for (let n = 0; n < PEOPLE.length && used.has(PEOPLE[k]!); n++)
      k = (k + 1) % PEOPLE.length;
    used.add(PEOPLE[k]!);
    return PEOPLE[k]!;
  });
}


const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
/** A width that fits a picture inside a w × h box. */
const fit = (name: string, w: number, h: number) => Math.min(w, h * ratio(name));
/** How tall an area's cooker stands (off, without its steam). */
const cookTop = (look: Look) => look.stations.find(([s]) => s === "fry")![4] / ratio(`${look.pre}cook-0`);

type Fx = {
  id: number;
  kind: "money" | "word" | "coins";
  x: number;
  y: number;
  text?: string;
  color?: string;
};

const CSS = `
  .mp-breathe { animation: mp-breathe 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes mp-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.012, 1.022); } }
  .mp-cheer { animation: mp-cheer .5s cubic-bezier(.3,1.6,.5,1) both; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes mp-cheer { 0% { transform: scale(1); } 40% { transform: translateY(-10px) scale(1.06); } 100% { transform: scale(1); } }
  .mp-shake { animation: mp-shake .45s ease-in-out both; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes mp-shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
  .mp-in-l { animation: mp-in-l ${WALK_SECONDS}s ease-out both; }
  @keyframes mp-in-l { from { transform: translateX(-340px); } to { transform: none; } }
  .mp-in-r { animation: mp-in-r ${WALK_SECONDS}s ease-out both; }
  @keyframes mp-in-r { from { transform: translateX(340px); } to { transform: none; } }
  .mp-out-l { animation: mp-out-l ${WALK_SECONDS}s ease-in both; }
  @keyframes mp-out-l { to { transform: translateX(-360px); } }
  .mp-out-r { animation: mp-out-r ${WALK_SECONDS}s ease-in both; }
  @keyframes mp-out-r { to { transform: translateX(360px); } }
  .mp-step { animation: mp-step .35s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes mp-step { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  .mp-tap { animation: mp-tap .28s ease-out both; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes mp-tap { 0% { transform: scale(1); } 35% { transform: scale(1.08, .92); } 100% { transform: scale(1); } }
  .mp-drop { animation: mp-drop .32s cubic-bezier(.3,1.5,.5,1) both; transform-box: fill-box; transform-origin: 50% 80%; }
  @keyframes mp-drop { 0% { transform: translateY(-14px) scale(1.25); opacity: 0; } 100% { transform: none; opacity: 1; } }
  .mp-steam path { animation: mp-rise 2.6s ease-in-out infinite; }
  @keyframes mp-rise { 0% { transform: translateY(6px); opacity: 0; } 35% { opacity: .75; } 100% { transform: translateY(-12px); opacity: 0; } }
  .mp-sizzle circle { animation: mp-sizzle .9s ease-in infinite; }
  @keyframes mp-sizzle { 0% { opacity: 0; transform: translateY(2px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-4px); } }
  .mp-float { animation: mp-float 1.3s ease-out both; }
  @keyframes mp-float { 0% { transform: translateY(6px) scale(.8); opacity: 0; } 15% { transform: translateY(0) scale(1.08); opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(-34px); opacity: 0; } }
  .mp-coin { animation: mp-coin .85s cubic-bezier(.5,0,.75,.4) both; }
  @keyframes mp-coin { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(.45); opacity: .2; } }
  .mp-ready { animation: mp-glow 1s ease-in-out infinite alternate; }
  @keyframes mp-glow { from { opacity: .35; } to { opacity: .9; } }
  .mp-sway { animation: mp-sway 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes mp-sway { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
  .mp-point { animation: mp-point 1s ease-in-out infinite; }
  @keyframes mp-point { 0%, 100% { opacity: 1; stroke-width: 4; } 50% { opacity: .45; stroke-width: 7; } }
  .mp-warn { animation: mp-warn .8s ease-in-out infinite alternate; }
  @keyframes mp-warn { from { opacity: .55; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .mp-in-l, .mp-in-r, .mp-step { animation: none; } .mp-out-l, .mp-out-r { animation-duration: .01s; } .mp-breathe, .mp-cheer, .mp-shake, .mp-tap, .mp-drop, .mp-steam path, .mp-sizzle circle, .mp-ready, .mp-sway, .mp-point, .mp-warn { animation: none; } .mp-float, .mp-coin { animation-duration: .01s; } }
`;

const steam = (x: number, y: number) => (
  <g
    className="mp-steam"
    fill="none"
    stroke="#fff"
    strokeLinecap="round"
    opacity=".85"
    pointerEvents="none"
  >
    {[-8, 1, 10].map((dx, i) => (
      <path
        key={dx}
        d={`M${x + dx} ${y} q-4 -6 0 -12 q4 -6 0 -12`}
        strokeWidth={2.6 - i * 0.4}
        style={{ animationDelay: `${i * 0.7}s` }}
      />
    ))}
  </g>
);

/** A phone (touch screen) rather than a computer. */
const isPhone = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
const portraitNow = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(orientation: portrait)").matches;

export function MamaPut({ api }: { api: SoloApi<MamaState> }) {
  // A game saved before there were four places can't carry on: start that one fresh.
  const [s, setS] = useState<MamaState>(() =>
    api.saved && api.saved.spots.length === SPOTS
      ? api.saved
      : newMama(
          api.seed,
          configFor(api.mode, api.extras?.owned ?? [], {
            tutorial: api.extras?.tutorial,
          }),
        ),
  );
  const state = useRef(s);
  const [fx, setFx] = useState<Fx[]>([]);
  const [taps, setTaps] = useState<Record<string, number>>({});
  const [said, setSaid] = useState("");
  const fxId = useRef(1);
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const box = useRef<HTMLDivElement>(null);
  // Phones start with a tap (full screen and landscape need one); computers just go.
  const [started, setStarted] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [full, setFull] = useState(false);
  const hold = useRef(true);
  hold.current = !started || portrait;
  const audio = useRef<GameAudio | null>(null);
  const cooking = useRef<LoopHandle | null>(null);
  const street = useRef<LoopHandle | null>(null);
  const [music, setMusic] = useState(true);
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload([...SOUNDS, ...VOICES]);
    setMusic(musicPreferred());
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the rush
  }, []);
  // The rush starts: the restaurant's music and the street outside.
  useEffect(() => {
    const au = audio.current;
    if (!au || !started || state.current.over || street.current) return;
    const area = rulesOf(state.current).area ?? 0;
    au.music(MUSIC[area] ?? MUSIC[0]!, 0.28);
    street.current = au.loop("mp-street", { volume: 0.22 });
    if (state.current.tut) au.voice("mama-welcome", 0);
  }, [started]);
  useEffect(() => {
    audio.current?.pauseMusic(api.paused || portrait);
    street.current?.setVolume(api.paused || portrait ? 0 : 0.22);
    cooking.current?.setVolume(api.paused || portrait ? 0 : 0.6);
  }, [api.paused, portrait]);
  const rules = rulesOf(s);
  const owned = new Set<string>(rules.owned ?? []);
  const look = lookOf(rules.area);
  const kitchen = kitchenOf(rules);
  const cook = kitchen.cook;
  const cookName = ITEM_NAME[cook];
  const fuel = look.fuel;
  const STATIONS = look.stations;
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    if (!isPhone()) setStarted(true);
    const mq = window.matchMedia("(orientation: portrait)");
    const on = () => setPortrait(isPhone() && mq.matches);
    on();
    mq.addEventListener("change", on);
    const fs = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", fs);
    return () => {
      mq.removeEventListener("change", on);
      document.removeEventListener("fullscreenchange", fs);
    };
  }, []);

  async function start() {
    const el = box.current;
    try {
      if (el && !document.fullscreenElement && el.requestFullscreen)
        await el.requestFullscreen({ navigationUI: "hide" });
      // Android: turn the screen sideways for the player. Browsers that can't just carry on.
      await (
        screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        }
      ).lock?.("landscape");
    } catch {
      // No full screen or lock here (an iPhone): the "turn your phone" screen does the job.
    }
    setPortrait(isPhone() && portraitNow());
    setStarted(true);
  }

  function leaveFull() {
    try {
      (
        screen.orientation as ScreenOrientation & { unlock?: () => void }
      ).unlock?.();
      if (document.fullscreenElement) void document.exitFullscreen();
    } catch {
      // Already out.
    }
  }

  // Load every picture up front, so faces and pans change without a flicker.
  useEffect(() => {
    for (const n of picturesFor(lookRef.current)) new Image().src = src(n);
  }, []);

  const commit = (next: MamaState) => {
    state.current = next;
    setS(next);
  };
  const effect = (f: Omit<Fx, "id">, ms = 1400) => {
    const id = fxId.current++;
    setFx((list) => [...list, { ...f, id }]);
    setTimeout(() => setFx((list) => list.filter((x) => x.id !== id)), ms);
  };
  const bump = (key: string) =>
    setTaps((t) => ({ ...t, [key]: (t[key] ?? 0) + 1 }));

  // Dragging: hold a food and drag it onto any plate, or hold a plate and drag it to a customer
  // (or the bin). What's under your finger is the portion as it sits on a plate. A plain tap still
  // works as before: tap a plate, tap the foods, tap the customer.
  type Drag = { kind: "food"; item: Item; from: Station[0] } | { kind: "plate"; plate: number };
  const svgRef = useRef<SVGSVGElement>(null);
  const press = useRef<{ drag: Drag; x0: number; y0: number; id: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ drag: Drag; x: number; y: number } | null>(null);
  const swallow = useRef(false);
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const startPress = (drag: Drag) => (e: React.PointerEvent) => {
    if (apiRef.current.paused || hold.current || state.current.over) return;
    if (drag.kind === "food" && drag.from === "fry" && state.current.fry.stage !== "ready") return;
    if (drag.kind === "plate" && !state.current.plates[drag.plate]?.length) return;
    press.current = { drag, x0: e.clientX, y0: e.clientY, id: e.pointerId, moved: false };
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 10) return;
    if (!p.moved) {
      p.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
      audio.current?.wake();
    }
    const pt = toSvg(e);
    if (pt) setGhost({ drag: p.drag, ...pt });
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== e.pointerId || !p.moved) return;
    // A drag isn't a tap: don't let the click that follows add or select anything.
    swallow.current = true;
    setTimeout(() => (swallow.current = false), 0);
    setGhost(null);
    const pt = toSvg(e);
    if (!pt || apiRef.current.paused || hold.current) return;
    if (p.drag.kind === "food") {
      const i = L.spotX.findIndex((x) => Math.abs(pt.x - x) < 58 && Math.abs(pt.y - lookRef.current.plateY) < 48);
      if (i >= 0) station(p.drag.from, i);
      return;
    }
    const spot = L.spotX.findIndex((x) => Math.abs(pt.x - x) < 72 && pt.y < lookRef.current.plateY - 14);
    if (spot >= 0) return hand(p.drag.plate, spot);
    const b = lookRef.current.stations.find(([w]) => w === "bin");
    if (b && Math.abs(pt.x - b[2]) < b[4] / 2 + 14 && pt.y > b[3] - 72 && pt.y < b[3] + 18) binPlate(p.drag.plate);
  };
  const onCancel = () => {
    press.current = null;
    setGhost(null);
  };

  // The clock: ten updates a second is plenty for patience bars and the pan.
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = Math.min(0.25, (t - last) / 1000);
      last = t;
      const a = apiRef.current;
      if (a.paused || hold.current || state.current.over) return;
      const before = state.current;
      const au = audio.current;
      const next = tick(a.seed, before, dt);
      if (next.fry.stage === "ready" && before.fry.stage === "frying")
        au?.sfx("mp-bell", { volume: 0.5 });
      if (next.fry.stage === "burnt" && before.fry.stage === "ready") {
        au?.sfx("mp-burnt");
        if (!rulesOf(next).area) au?.voice("mama-burnt", 3);
        setSaid(`The ${ITEM_NAME[kitchenOf(next.cfg).cook].toLowerCase()} burnt.`);
      }
      if (gasLeft(next) <= 0 && gasLeft(before) > 0) {
        au?.sfx("mp-gas-out");
        const fl = lookRef.current.fuel;
        setSaid(`The ${fl.name} has finished. Buy a new ${fl.unit} to cook again.`);
        effect(
          {
            kind: "word",
            x: 206,
            y: 330,
            text: `${lookRef.current.fuel.name === "gas" ? "Gas" : "Charcoal"} don finish!`,
            color: "#b8261a",
          },
          1800,
        );
      }
      next.spots.forEach((c, i) => {
        if (c && !before.spots[i]) {
          au?.sfx("mp-bell", { volume: 0.7 });
          au?.voice("mp-hello", 6, 0.8);
          setSaid(
            `A customer at place ${i + 1} wants ${c.order.map((x) => ITEM_NAME[x]).join(", ")}.`,
          );
        }
        if (c?.leaving && !before.spots[i]?.leaving && c.leaving.paid === 0) {
          au?.voice("mp-angry", 3);
          effect({
            kind: "word",
            x: L.spotX[i]!,
            y: 110,
            text: "Ehn?!",
            color: "#e8563a",
          });
        }
      });
      const flame = (next.fry.stage === "frying" || next.fry.stage === "ready") && gasLeft(next) > 0;
      if (au && flame && !cooking.current) cooking.current = au.loop(COOKING[rulesOf(next).area ?? 0] ?? COOKING[0]!, { volume: 0.6 });
      if (!flame && cooking.current) {
        cooking.current.stop();
        cooking.current = null;
      }
      next.spots.forEach((c, i) => {
        const was = before.spots[i];
        if (au && c && was && !c.leaving && was.patience / was.max > 0.35 && c.patience / c.max <= 0.35) au.voice("mp-wait", 5);
      });
      if (au && stars(next.money, rulesOf(next)) > stars(before.money, rulesOf(before))) au.sfx("mp-star");
      commit(next);
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.save(s);
    if (s.over && !ended.current) {
      ended.current = true;
      leaveFull();
      const st = stars(s.money, rulesOf(s));
      audio.current?.stopLoops();
      audio.current?.music(null);
      audio.current?.sfx(st >= 2 ? "mp-star" : "mp-gas-out");
      if (st >= 2) audio.current?.voice("mama-well-done", 0);
      api.end(s.money, {
        served: s.served,
        lost: s.lost,
        stars: st,
        gas: s.refills ?? 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);
  // Leaving the game mid-rush: let the phone go back to normal.
  useEffect(() => () => leaveFull(), []);

  const station = (what: Station[0], onto?: number) => {
    const a = apiRef.current;
    if (a.paused || hold.current || state.current.over) return;
    if (onto === undefined && swallow.current) return;
    const cur = state.current;
    bump(what);
    if (what === "gas") {
      const r = buyGas(cur);
      if (r.ok) {
        audio.current?.sfx(rulesOf(cur).area === 2 ? "mp-charcoal" : "mp-gas-new");
        commit(r.state);
        effect({
          kind: "word",
          x: 206,
          y: 330,
          text: `New ${fuel.name}: -₦${gasPrice(cur).toLocaleString("en-NG")}`,
          color: "#1f5fa8",
        });
        setSaid(`New ${fuel.name} ${fuel.unit} for ₦${gasPrice(cur)}.`);
      } else if (gasLeft(cur) >= gasMax(cur)) {
        effect({
          kind: "word",
          x: 206,
          y: 330,
          text: `${cap(fuel.name)} is still full`,
          color: "#2a1d17",
        });
      } else {
        audio.current?.sfx("tap");
        effect({
          kind: "word",
          x: 206,
          y: 330,
          text: `Need ₦${gasPrice(cur).toLocaleString("en-NG")} for ${fuel.name}`,
          color: "#b8261a",
        });
      }
      return;
    }
    if (what === "bin") {
      if (!cur.plates[cur.selected]!.length) return;
      audio.current?.sfx("mp-bin");
      commit(bin(cur));
      setSaid("Plate cleared.");
      return;
    }
    if (what === "fry") {
      if (cur.fry.stage === "ready") return station(cook, onto ?? cur.selected);
      if (gasLeft(cur) <= 0) {
        audio.current?.sfx("tap");
        effect({
          kind: "word",
          x: 92,
          y: 330,
          text: `No ${fuel.name}! Buy a ${fuel.unit}`,
          color: "#b8261a",
        });
        return;
      }
      const next = fry(cur);
      if (next !== cur) {
        if (cur.fry.stage === "idle" && (cook === "dodo" || cook === "puff-puff")) audio.current?.sfx("mp-oil-drop", { volume: 0.8 });
        commit(next);
        setSaid(`${cookName} ${look.doing.toLowerCase()}.`);
      }
      return;
    }
    const plateNo = onto ?? cur.selected;
    const r = add(cur, what, plateNo);
    if (!r.ok) {
      if (r.why === "fry")
        effect({
          kind: "word",
          x: 92,
          y: 330,
          text: `${cap(look.verb)} the ${cookName.toLowerCase()} first`,
          color: "#b8261a",
        });
      audio.current?.sfx("tap");
      return;
    }
    audio.current?.sfx(DRINKS.has(what) ? "mp-plate" : "mp-scoop", { volume: 0.8 });
    navigator.vibrate?.(10);
    commit(r.state);
    setSaid(`${ITEM_NAME[what]} on plate ${plateNo + 1}.`);
  };

  const binPlate = (i: number) => {
    const cur = state.current;
    if (!cur.plates[i]?.length) return;
    audio.current?.sfx("mp-bin");
    commit(bin(cur, i));
    setSaid(`Plate ${i + 1} cleared.`);
  };

  const hand = (plateIdx: number, i: number) => {
    const a = apiRef.current;
    if (a.paused || hold.current) return;
    const r = serve(state.current, plateIdx, i);
    if (r.state === state.current) return;
    commit(r.state);
    if (r.right) {
      audio.current?.sfx("mp-coins");
      audio.current?.voice(r.tip >= r.paid * 0.2 ? "mp-tip" : "mp-happy", 2);
      navigator.vibrate?.(20);
      effect({
        kind: "money",
        x: L.spotX[i]!,
        y: 120,
        text: `+₦${(r.paid + r.tip).toLocaleString("en-NG")}`,
        color: "#2f8a4e",
      });
      if (r.tip)
        effect({
          kind: "word",
          x: L.spotX[i]!,
          y: 140,
          text: `₦${r.tip} tip, sharp sharp!`,
          color: "#b0730a",
        });
      effect({ kind: "coins", x: L.spotX[i]!, y: look.plateY }, 1000);
      setSaid(
        `Served. ₦${r.paid + r.tip}${r.tip ? `, with a ₦${r.tip} tip` : ""}.`,
      );
    } else if (r.rejected) {
      audio.current?.voice("mp-wrong", 1);
      navigator.vibrate?.([30, 40, 30]);
      effect({
        kind: "word",
        x: L.spotX[i]!,
        y: 110,
        text: "Not my order!",
        color: "#e8563a",
      });
      bump(`plate-${plateIdx}`);
      setSaid("Not their order, so they pushed it back. Fix the plate and try again.");
    }
  };

  const left = Math.max(0, Math.ceil(rules.seconds - rushTime(s)));
  const st = stars(s.money, rules);
  const who = cast(s.spots);
  const gas = gasLeft(s) / gasMax(s);
  const step = tutorialStep(s);
  // Where the tutorial points: a station, a plate or a Serve button.
  const pointAt =
    step?.kind === "add"
      ? STATIONS.find(([w]) => w === step.item)
      : step?.kind === "bin"
        ? STATIONS.find(([w]) => w === "bin")
        : null;
  const hint =
    step?.kind === "wait"
      ? "Your first customer is walking in. Their order shows in the bubble."
      : step?.kind === "add"
        ? `They want ${s.spots[0]!.order.map((x) => ITEM_NAME[x]).join(", ")}. Hold the ${ITEM_NAME[step.item].toLowerCase()} and drag it onto the first plate (or just tap it).`
        : step?.kind === "bin"
          ? "That's not what they ordered. Drag the plate to the bin, or tap the bin."
          : step?.kind === "serve"
            ? "Everything they want is on the plate. Hold the plate and drag it up to them (or tap them)."
            : null;
  // A portion as it sits on a plate: what's on the plates, and what's under your finger.
  const portionPic = (it: Item) => (it === "rice" && !look.pre ? "p-rice" : DRINKS.has(it) ? bubblePic(look, it) : platePic(look, it));
  const SPOTS_ON_PLATE = [
    [-14, -3],
    [13, -4],
    [-1, 5],
    [18, 4],
    [-18, 6],
    [3, -10],
  ];
  const portions = (p: Item[], x: number, y: number, drop: boolean) =>
    p.map((it, k) =>
      it === "rice" && !look.pre ? (
        <Pic key={it} name="p-rice" x={x + SPOTS_ON_PLATE[k]![0]!} bottom={y + SPOTS_ON_PLATE[k]![1]! + 14} w={38} className={drop ? "mp-drop" : undefined} />
      ) : DRINKS.has(it) ? (
        <Pic key={it} name={bubblePic(look, it)} x={x + 38} bottom={y + 18} w={fit(bubblePic(look, it), 22, 34)} className={drop ? "mp-drop" : undefined} />
      ) : (
        <Pic key={it} name={platePic(look, it)} x={x + SPOTS_ON_PLATE[k]![0]!} bottom={y + SPOTS_ON_PLATE[k]![1]! + 13} w={fit(platePic(look, it), 34, 30)} className={drop ? "mp-drop" : undefined} />
      ),
    );

  return (
    <div
      ref={box}
      className={
        full
          ? "flex h-[100dvh] w-screen items-center justify-center bg-[#1e140d]"
          : "relative mx-auto w-full max-w-[900px] select-none"
      }
      data-tour="mama-shop"
    >
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      <div
        className={
          full
            ? "relative h-full max-h-[calc(100vw/2)] w-full max-w-[calc(100dvh*2)]"
            : "relative w-full overflow-hidden rounded-[18px] shadow-[0_16px_30px_-18px_rgba(28,20,22,.7)]"
        }
        style={full ? undefined : { aspectRatio: "2 / 1" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 block h-full w-full touch-none select-none"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          role="group"
          aria-label="Mama Put. Customers at the counter at the top, the kitchen below."
        >
          <style>{CSS}</style>
          <defs>
            <filter id="mp-ds" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".3" />
            </filter>
          </defs>

          {/* The restaurant: one wide scene, with the name painted on its signboard. */}
          <clipPath id="mp-front">
            <rect x="0" y={look.counterTop} width={W} height={H - look.counterTop} />
          </clipPath>
          <image href={src(`${look.pre}scene`)} x={0} y={0} width={W} height={H} />
          <text
            x={look.sign[0]}
            y={look.sign[1]}
            textAnchor="middle"
            fontFamily="Fraunces, serif"
            fontStyle="italic"
            fontWeight="900"
            fontSize="30"
            fill={look.signInk}
          >
            {kitchen.name}
          </text>
          {look.back.filter(([id]) => owned.has(id)).map(
            ([id, pic, x, bottom, w]) => (
              <Pic
                key={`${pic}-${x}`}
                name={pic}
                x={x}
                bottom={bottom}
                w={w}
                className={id === "fan" ? "mp-sway" : undefined}
              />
            ),
          )}

          {/* Customers: walk in from their side, breathe while they wait, walk back out. Tap one to
              serve them the selected plate. */}
          {s.spots.map((c, i) => {
            if (!c) return null;
            const side = i < 2 ? -1 : 1;
            const walking = !c.leaving && s.time - c.arrived < WALK_SECONDS;
            const walk = c.leaving ? (side < 0 ? "mp-out-l" : "mp-out-r") : walking ? (side < 0 ? "mp-in-l" : "mp-in-r") : undefined;
            const m = mood(c, s.time);
            const key = `${who[i]}-${m}`;
            const h = L.customerHeight;
            const w = h * (ratio(`cust-${key}`) || 0.7);
            const pushedBack = c.rejected != null && s.time - c.rejected < 0.6;
            const cls = c.leaving || walking ? "mp-step" : pushedBack ? "mp-shake" : "mp-breathe";
            return (
              <g
                key={c.id}
                transform={`translate(${L.spotX[i]!} 0)`}
                role={atCounter(s, c) ? "button" : undefined}
                aria-label={atCounter(s, c) ? `Serve plate ${s.selected + 1} to place ${i + 1}` : undefined}
                onClick={() => !swallow.current && atCounter(state.current, state.current.spots[i]) && hand(state.current.selected, i)}
                style={{ cursor: atCounter(s, c) ? "pointer" : undefined }}
              >
                <g className={walk}>
                  <image
                    key={`${m}-${pushedBack ? c.rejected : ""}`}
                    href={src(`cust-${key}`)}
                    x={-w / 2}
                    y={look.customerBottom - h}
                    width={w}
                    height={h}
                    className={cls}
                    style={{ animationDelay: cls === "mp-breathe" ? `${(c.id % 5) * 0.37}s` : undefined }}
                  />
                </g>
              </g>
            );
          })}

          {/* The counter and kitchen again, in front of the customers, then what's on the counter. */}
          <image
            href={src(`${look.pre}scene`)}
            x={0}
            y={0}
            width={W}
            height={H}
            clipPath="url(#mp-front)"
          />
          {look.counter.filter(([id]) => owned.has(id)).map(
            ([id, pic, x, bottom, w]) => (
              <Pic
                key={pic}
                name={pic}
                x={x}
                bottom={bottom}
                w={w}
                className={id === "fan" ? "mp-sway" : undefined}
              />
            ),
          )}

          {/* What each customer wants, and how long they'll wait. */}
          {s.spots.map((c, i) => {
            if (!atCounter(s, c)) return null;
            const f = c.patience / c.max;
            const cols = Math.min(3, c.order.length);
            const rows = Math.ceil(c.order.length / 3);
            const bw = cols * 28 + 12;
            const bh = rows * 22 + 14;
            const x = Math.max(4, Math.min(W - bw - 4, L.spotX[i]! - bw / 2));
            const y = L.bubbleY;
            return (
              <g
                key={c.id}
                role="img"
                aria-label={`Place ${i + 1} wants ${c.order.map((it) => ITEM_NAME[it]).join(", ")}`}
              >
                <g filter="url(#mp-ds)">
                  <rect
                    x={x}
                    y={y}
                    width={bw}
                    height={bh}
                    rx="11"
                    fill="#fffdf8"
                  />
                  <path
                    d={`M${L.spotX[i]! - 6} ${y + bh - 1} l6 7 l6 -7z`}
                    fill="#fffdf8"
                  />
                </g>
                {c.order.map((it, k) => (
                  <Pic
                    key={it}
                    name={bubblePic(look, it)}
                    x={x + 20 + (k % 3) * 28}
                    bottom={y + 26 + Math.floor(k / 3) * 22}
                    w={fit(bubblePic(look, it), 26, 22)}
                  />
                ))}
                <rect
                  x={x + 7}
                  y={y + bh - 8}
                  width={bw - 14}
                  height="4"
                  rx="2"
                  fill="rgba(58,26,8,.15)"
                />
                <rect
                  x={x + 7}
                  y={y + bh - 8}
                  width={(bw - 14) * f}
                  height="4"
                  rx="2"
                  fill={f > 0.5 ? "#2f8a4e" : f > 0.25 ? "#e9a13c" : "#e8563a"}
                />
              </g>
            );
          })}

          {/* Plates on the counter, anyone's: tap one to dish onto it, hold one to drag it to a
              customer or the bin. */}
          <g data-tour="mama-plates">
            {s.plates.map((p, i) => {
              const sel = s.selected === i;
              const x = L.spotX[i]!;
              const lifted = ghost?.drag.kind === "plate" && ghost.drag.plate === i;
              return (
                <g key={i}>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-pressed={sel}
                    aria-label={`Plate ${i + 1}${p.length ? `: ${p.map((it) => ITEM_NAME[it]).join(", ")}` : ", empty"}${sel ? ", dishing onto this one" : ""}`}
                    onPointerDown={startPress({ kind: "plate", plate: i })}
                    onClick={() => !hold.current && !swallow.current && commit(select(state.current, i))}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && commit(select(state.current, i))}
                    style={{ cursor: p.length ? "grab" : "pointer", outline: "none" }}
                    opacity={lifted ? 0.3 : 1}
                  >
                    <rect x={x - 50} y={look.plateY - 30} width="100" height="58" fill="transparent" />
                    {sel ? <ellipse cx={x} cy={look.plateY} rx="47" ry="21" fill="none" stroke="#f6c453" strokeWidth="3.5" strokeDasharray="7 4" /> : null}
                    <g key={taps[`plate-${i}`] ?? 0} className={taps[`plate-${i}`] ? "mp-shake" : undefined}>
                      <Pic name={`${look.pre}plate`} x={x} bottom={look.plateY + 27} w={80} />
                      {portions(p, x, look.plateY, true)}
                    </g>
                    {step?.kind === "serve" && i === 0 ? <ellipse cx={x} cy={look.plateY} rx="54" ry="27" fill="none" stroke="#2e9b57" className="mp-point" /> : null}
                  </g>
                </g>
              );
            })}
          </g>

          {/* The kitchen: food on the scene's two shelves. */}
          {STATIONS.map(([what, pic, x, bottom, w]) => (
            <g key={what}>
              <g
                key={taps[what] ?? 0}
                className={taps[what] ? "mp-tap" : undefined}
              >
                {what === "fry" ? (
                  <>
                    <Pic
                      name={cookPic(look, s.fry)}
                      x={x}
                      bottom={bottom}
                      w={w * (owned.has("big-pan") ? 1.08 : 1)}
                    />
                    {!look.pre &&
                    (s.fry.stage === "frying" || s.fry.stage === "ready") &&
                    gasLeft(s) > 0 ? (
                      <g className="mp-sizzle" pointerEvents="none">
                        {[-18, -6, 6, 18].map((dx, k) => (
                          <circle
                            key={k}
                            cx={x - 11 + dx * 0.8}
                            cy={bottom - 48 + (k % 2) * 4}
                            r="1.5"
                            fill="none"
                            stroke="#fff8d2"
                            strokeWidth=".9"
                            style={{ animationDelay: `${k * 0.15}s` }}
                          />
                        ))}
                      </g>
                    ) : null}
                    {s.fry.stage === "ready" ? (
                      <ellipse
                        cx={look.pre ? x : x - 9}
                        cy={bottom - (look.pre ? cookTop(look) * 0.86 : 45)}
                        rx={look.pre ? w * 0.36 : 26}
                        ry="10"
                        fill="none"
                        stroke="#f6c453"
                        strokeWidth="3"
                        className="mp-ready"
                      />
                    ) : null}
                    {s.fry.stage === "burnt" && !look.pre ? (
                      <g
                        className="mp-steam"
                        fill="none"
                        stroke="#5a5a5a"
                        strokeLinecap="round"
                        pointerEvents="none"
                      >
                        {[-14, -2, 10].map((dx, k) => (
                          <path
                            key={dx}
                            d={`M${x - 12 + dx} ${bottom - 52} q-6 -9 0 -18 q6 -9 0 -18`}
                            strokeWidth={5 - k}
                            opacity=".55"
                            style={{ animationDelay: `${k * 0.5}s` }}
                          />
                        ))}
                      </g>
                    ) : null}
                  </>
                ) : what === "gas" ? (
                  <GasCylinder look={look} x={x} bottom={bottom} level={gas} />
                ) : (
                  <Pic name={pic} x={x} bottom={bottom} w={w} />
                )}
              </g>
              {look.steaming.has(what)
                ? steam(x - 2, bottom - w / ratio(pic) + 4)
                : null}
              {pointAt?.[0] === what ? (
                <rect
                  x={x - w / 2 - 6}
                  y={bottom - 70}
                  width={w + 12}
                  height="82"
                  rx="14"
                  fill="none"
                  stroke="#2e9b57"
                  className="mp-point"
                />
              ) : null}
            </g>
          ))}
          {/* Labels last, so food on the shelf below never covers them. */}
          {STATIONS.map(([what, , x, bottom, , label]) => (
            <g key={`label-${what}`} pointerEvents="none">
              <text
                x={x}
                y={what === "fry" ? bottom - (look.pre ? cookTop(look) + 6 : 66) : bottom + (bottom === look.shelves[0] ? 12 : 16)}
                textAnchor="middle"
                fontFamily="Manrope, sans-serif"
                fontWeight="800"
                fontSize="9.5"
                fill={
                  (what === "fry" && s.fry.stage === "burnt") ||
                  (what === "gas" && gas <= 0)
                    ? "#b8261a"
                    : "#2a1d17"
                }
                stroke="#f7efe2"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {what === "fry"
                  ? s.fry.stage === "idle"
                    ? `Tap to ${look.verb} ${cookName.toLowerCase()}`
                    : s.fry.stage === "frying"
                      ? gasLeft(s) > 0
                        ? `${look.doing}…`
                        : `No ${fuel.name}!`
                      : s.fry.stage === "ready"
                        ? `${cookName} ready${(s.fry.n ?? 1) > 1 ? ` ×${s.fry.n}` : ""}: tap to dish`
                        : `Burnt! Tap to ${look.verb} again`
                  : what === "gas"
                    ? gas <= 0
                      ? `Buy ${fuel.name} ₦${gasPrice(s).toLocaleString("en-NG")}`
                      : cap(fuel.name)
                    : label}
              </text>
            </g>
          ))}
          {STATIONS.map(([what, , x, bottom, w, label]) => {
            const b =
              what === "fry"
                ? { x: x - w / 2 - 6, y: bottom - (look.pre ? cookTop(look) + 10 : 76), w: w + 12, h: look.pre ? cookTop(look) + 12 : 78 }
                : { x: x - w / 2 - 5, y: bottom - 62, w: w + 10, h: 80 };
            return (
              <rect
                key={what}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx="12"
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={
                  what === "fry"
                    ? s.fry.stage === "ready"
                      ? `Dish the ${cookName.toLowerCase()}`
                      : `${cap(look.verb)} ${cookName.toLowerCase()}`
                    : what === "bin"
                      ? "Bin the plate"
                      : what === "gas"
                        ? `${cap(fuel.name)}, ${Math.round(gas * 100)}% left. Buy a new ${fuel.unit} for ₦${gasPrice(s)}`
                        : `Add ${label}`
                }
                onClick={() => station(what)}
                onPointerDown={what === "bin" || what === "gas" ? undefined : startPress({ kind: "food", item: what === "fry" ? cook : (what as Item), from: what })}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && station(what)
                }
                style={{ cursor: "pointer", outline: "none" }}
                className="focus-visible:fill-[rgba(233,177,60,.18)]"
              />
            );
          })}

          {ghost ? (
            <g pointerEvents="none" filter="url(#mp-ds)">
              {ghost.drag.kind === "food" ? (
                <Pic
                  name={portionPic(ghost.drag.item)}
                  x={ghost.x}
                  bottom={ghost.y + 18}
                  w={DRINKS.has(ghost.drag.item) ? fit(portionPic(ghost.drag.item), 28, 44) : ghost.drag.item === "rice" && !look.pre ? 50 : fit(portionPic(ghost.drag.item), 46, 40)}
                />
              ) : (
                <g transform="scale(1.06)" style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
                  <Pic name={`${look.pre}plate`} x={ghost.x} bottom={ghost.y + 27} w={80} />
                  {portions(s.plates[ghost.drag.plate] ?? [], ghost.x, ghost.y, false)}
                </g>
              )}
            </g>
          ) : null}

          {/* The tutorial: Mama shows the way. */}
          {hint ? (
            <g pointerEvents="none">
              <Pic
                name="mama-happy"
                x={W - 92}
                bottom={look.counterTop + 4}
                w={150}
              />
              <g filter="url(#mp-ds)">
                <rect
                  x={W - 470}
                  y={58}
                  width={300}
                  height={66}
                  rx="14"
                  fill="#fffdf8"
                />
                <path d={`M${W - 172} 86 l14 8 l-14 8z`} fill="#fffdf8" />
              </g>
              <foreignObject x={W - 462} y={62} width={284} height={58}>
                <p
                  style={{
                    margin: 0,
                    font: "700 12.5px/1.35 Manrope, sans-serif",
                    color: "#2a1d17",
                  }}
                >
                  {hint}
                </p>
              </foreignObject>
            </g>
          ) : null}

          {/* Takings floating up, coins flying to the till. */}
          {fx.map((f) =>
            f.kind === "coins" ? (
              <g key={f.id} pointerEvents="none">
                {[0, 1, 2, 3].map((k) => (
                  <image
                    key={k}
                    href={src("coin")}
                    x={f.x - 10 + (k - 1.5) * 9}
                    y={f.y - 10}
                    width="20"
                    height="18"
                    className="mp-coin"
                    style={
                      {
                        ["--dx" as string]: `${W - 120 - f.x}px`,
                        ["--dy" as string]: `${-f.y + 14}px`,
                        animationDelay: `${k * 0.07}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </g>
            ) : (
              <g key={f.id} className="mp-float" pointerEvents="none">
                <text
                  x={f.x}
                  y={f.y}
                  textAnchor="middle"
                  fontFamily="Fraunces, serif"
                  fontWeight="900"
                  fontSize={f.kind === "money" ? 22 : 12.5}
                  fill={f.color}
                  stroke="#fffaf0"
                  strokeWidth={f.kind === "money" ? 5 : 3.5}
                  paintOrder="stroke"
                >
                  {f.text}
                </text>
              </g>
            ),
          )}
        </svg>

        {/* The clock, takings and stars, in the free corner of the kitchen. */}
        <div className="pointer-events-none absolute bottom-[2.5%] right-[1.5%] flex items-center gap-1">
          <p
            className="rounded-full bg-[rgba(255,250,242,.92)] px-2.5 py-0.5 font-[Fraunces,serif] text-[0.85rem] font-semibold leading-tight text-[#2a1d17] shadow"
            aria-label={
              step
                ? "The clock starts after your first customer"
                : `${left} seconds left`
            }
          >
            ⏱{" "}
            {step
              ? "–:––"
              : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
          </p>
          <div className="flex items-center gap-1.5">
            <p
              className="rounded-full bg-[rgba(255,250,242,.92)] px-2.5 py-0.5 font-[Fraunces,serif] text-[0.85rem] font-semibold leading-tight text-[#2e7d32] shadow"
              aria-label={`₦${s.money} taken. ${st} of 3 stars. Next star at ₦${rules.stars[st] ?? rules.stars[2]}`}
            >
              ₦{s.money.toLocaleString("en-NG")}{" "}
              <span className="text-[#e3a417]">{"★".repeat(st)}</span>
              <span className="opacity-30">{"★".repeat(3 - st)}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setMusic((m) => !m);
                audio.current?.setMusic(!music);
              }}
              aria-pressed={music}
              aria-label={music ? "Music on. Turn it off" : "Music off. Turn it on"}
              className={`pointer-events-auto rounded-full bg-[rgba(255,250,242,.92)] px-2.5 py-0.5 text-[0.85rem] font-bold text-[#2a1d17] shadow ${music ? "" : "opacity-50 line-through"}`}
            >
              ♪
            </button>
            {full && api.pause ? (
              <button
                type="button"
                onClick={api.pause}
                className="pointer-events-auto rounded-full bg-[rgba(255,250,242,.92)] px-3 py-1 text-[0.8rem] font-bold text-[#2a1d17] shadow"
              >
                Pause
              </button>
            ) : null}
          </div>
        </div>

        {/* Full screen hides the page's own pause screen, so the game has its own. */}
        {full && api.paused && started && !portrait ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[rgba(30,20,13,.7)] text-white">
            <p className="font-[Fraunces,serif] text-[1.6rem] font-semibold">
              Paused
            </p>
            <button
              type="button"
              onClick={api.resume}
              className="rounded-full bg-[#f6c453] px-6 py-2.5 font-extrabold text-[#2a1a10]"
            >
              Carry on
            </button>
            <button
              type="button"
              onClick={() => {
                leaveFull();
              }}
              className="text-[0.85rem] font-semibold underline underline-offset-4"
            >
              Leave full screen
            </button>
            <button
              type="button"
              onClick={() => {
                // Full screen hides the page's back button, so the way out lives here too.
                leaveFull();
                window.location.assign("/solo/mama-put");
              }}
              className="text-[0.85rem] font-semibold underline underline-offset-4"
            >
              Quit to the menu (this go won&apos;t count)
            </button>
          </div>
        ) : null}
      </div>

      {/* Phones: one tap to go full screen and sideways. */}
      {!started ? (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-[#2a1a10] px-8 text-center text-white">
          <svg width="96" height="96" viewBox="0 0 120 120" aria-hidden>
            <rect
              x="20"
              y="38"
              width="80"
              height="44"
              rx="8"
              fill="none"
              stroke="#f6c453"
              strokeWidth="5"
            />
            <circle cx="90" cy="60" r="3" fill="#f6c453" />
          </svg>
          <p className="font-[Fraunces,serif] text-[1.7rem] font-semibold leading-tight">
            Mama Put plays sideways
          </p>
          <p className="max-w-[18rem] text-[0.95rem] text-[#e6cdb9]">
            So the whole buka fits. Tap to start, then turn your phone if it
            doesn&apos;t turn by itself.
          </p>
          <button
            type="button"
            onClick={() => void start()}
            className="mt-2 rounded-full bg-[#f6c453] px-8 py-3.5 text-[1.05rem] font-extrabold text-[#2a1a10]"
          >
            Start the rush
          </button>
        </div>
      ) : portrait ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-[#2a1a10] px-8 text-center text-white"
          role="alert"
        >
          <svg width="110" height="110" viewBox="0 0 120 120" aria-hidden>
            <rect
              x="38"
              y="20"
              width="44"
              height="80"
              rx="8"
              fill="none"
              stroke="#f6c453"
              strokeWidth="5"
            />
            <path
              d="M96 70 a36 36 0 0 1 -30 34"
              fill="none"
              stroke="#fff"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path d="M60 98 l8 8 l-2 -11z" fill="#fff" />
          </svg>
          <p className="font-[Fraunces,serif] text-[1.7rem] font-semibold leading-tight">
            Turn your phone sideways
          </p>
          <p className="max-w-[18rem] text-[0.95rem] text-[#e6cdb9]">
            Mama Put plays in landscape. The rush waits for you, and starts as
            soon as you turn.
          </p>
        </div>
      ) : null}
      {!full ? (
        <p className="mt-2 text-center text-[0.8rem] text-muted">
          Hold a food and drag it onto any plate, then drag the plate to whoever ordered it.
          Tapping works too. {cap(look.verb)} the {cookName.toLowerCase()} before you need
          it, and watch the {fuel.name}.
        </p>
      ) : null}
    </div>
  );
}

/** The fuel (a gas cylinder, or a sack of charcoal), with a gauge: green, then amber, then red and empty. */
function GasCylinder({
  look,
  x,
  bottom,
  level,
}: {
  look: Look;
  x: number;
  bottom: number;
  level: number;
}) {
  const col = level > 0.5 ? "#2e9b57" : level > 0.2 ? "#e9a13c" : "#e0402e";
  // A just-filled cylinder wears its seal for a moment.
  const fresh = level >= 0.97;
  return (
    <g className={level <= 0.2 ? "mp-warn" : undefined}>
      <Pic
        name={fuelPic(look.pre, look.fuel, fresh)}
        x={x}
        bottom={bottom}
        w={look.fuel.width * (fresh && look.fuel.pic === "gas" ? 1.05 : 1)}
      />
      {/* The gauge. */}
      <rect
        x={x + look.fuel.width / 2 + 3}
        y={bottom - 52}
        width="6"
        height="46"
        rx="3"
        fill="rgba(0,0,0,.25)"
      />
      <rect
        x={x + look.fuel.width / 2 + 3}
        y={bottom - 6 - 46 * Math.max(0, level)}
        width="6"
        height={46 * Math.max(0, level)}
        rx="3"
        fill={col}
      />
    </g>
  );
}
