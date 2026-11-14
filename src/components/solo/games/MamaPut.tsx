"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ITEM_NAME,
  LEAVE_SECONDS,
  SPOTS,
  add,
  bin,
  buyGas,
  configFor,
  fry,
  gasLeft,
  gasMax,
  gasPrice,
  newMama,
  rulesOf,
  rushTime,
  select,
  serve,
  stars,
  tick,
  tutorialStep,
  waiting,
  type Customer,
  type Item,
  type MamaState,
} from "@/lib/solo/games/mama";
import type { SoloApi } from "../SoloShell";

/**
 * Mama Put, played sideways: the restaurant across the top, the counter with four places, and
 * the kitchen in two rows across the front. Drawn with the painted art in /public/games/mama-put
 * (made by scripts/art). The rules live in lib/solo/games/mama; this draws them and turns taps
 * into moves.
 *
 * On a phone it asks to go full screen and turn sideways (Android locks to landscape; an iPhone
 * held upright gets a "turn your phone" screen, and the game waits).
 */
const ART = "/games/mama-put/";
const src = (name: string) => `${ART}${name}.webp`;
const W = 800;
const H = 400;

/** Where everything goes on the 800 × 400 stage. One table, so new scene art is a quick re-fit. */
const L = {
  spotX: [110, 300, 500, 690] as const,
  customerBottom: 210,
  customerHeight: 152,
  bubbleY: 6,
  /** The signboard's middle, from the scene art. */
  sign: [382, 52] as const,
  /** The counter's back edge: the counter is drawn again from here down, over the customers. */
  counterTop: 173,
  plateY: 197,
  /** Where food sits on the two kitchen shelves. */
  shelves: [287, 361] as const,
};

/** Width ÷ height of each picture, so they keep their shape. */
const RATIO: Record<string, number> = {
  bin: 0.759,
  coin: 1.108,
  counter: 3.859,
  wall: 2.313,
  stove: 2.5,
  plate: 1.429,
  "mama-happy": 1.031,
  "pan-burnt": 1.122,
  "pan-empty": 1.294,
  "pan-frying": 1.294,
  "pan-raw": 1.294,
  "pan-ready": 1.279,
  "st-beef": 1.811,
  "st-chicken": 1.729,
  "st-drink": 1.198,
  "st-eba": 1.156,
  "st-egusi": 1.25,
  "st-fish": 1.84,
  "st-jollof": 1.1,
  "st-moin": 1.173,
  "st-rice": 1.377,
  "st-stew": 1.299,
  "p-beef": 1.297,
  "p-chicken": 1.352,
  "p-dodo": 1.333,
  "p-drink": 0.379,
  "p-eba": 1.412,
  "p-egusi": 1.433,
  "p-fish": 1.455,
  "p-jollof": 1.433,
  "p-moin": 1.352,
  "p-rice": 1.433,
  "p-stew": 1.412,
  "f-beef": 1.116,
  "f-chicken": 1.328,
  "f-dodo": 1.481,
  "f-eba": 1.116,
  "f-egusi": 1.262,
  "f-fish": 1.711,
  "f-jollof": 1.426,
  "f-moin": 1.167,
  "f-stew": 1.481,
  "stove-off": 1.31,
  "stove-oil": 1.299,
  "stove-raw": 1.293,
  "stove-frying": 1.293,
  "stove-ready": 1.299,
  "stove-burnt": 1.299,
  gas: 0.759,
  "gas-new": 0.797,
  scene: 2,
  "up-bunting": 3.1,
  "up-chairs": 1.594,
  "up-fan": 0.58,
  "up-generator": 1.261,
  "up-pan": 1.899,
  "up-plant": 1,
  "up-radio": 1.04,
  "up-tipjar": 0.723,
  "up-tv": 1.563,
};
const CUSTOMER_RATIO: Record<string, number> = {
  "aunty-angry": 0.643,
  "aunty-happy": 0.723,
  "aunty-wait": 0.678,
  "baba-angry": 0.751,
  "baba-happy": 0.789,
  "baba-wait": 0.737,
  "corper-angry": 0.635,
  "corper-happy": 0.742,
  "corper-wait": 0.693,
  "fila-angry": 0.631,
  "fila-happy": 0.712,
  "fila-wait": 0.672,
  "oga-angry": 0.676,
  "oga-happy": 0.801,
  "oga-wait": 0.737,
  "student-angry": 0.66,
  "student-happy": 0.702,
  "student-wait": 0.693,
};
const PEOPLE = ["aunty", "fila", "corper", "student", "oga", "baba"] as const;

/** Upgrades on the wall, behind the customers: [upgrade, picture, centre x, bottom y, width]. */
const DECOR_BACK: [string, string, number, number, number][] = [
  ["paint", "up-bunting", 120, 30, 120],
  ["paint", "up-bunting", 660, 30, 120],
  ["tv", "up-tv", 54, 118, 66],
  ["generator", "up-generator", 742, 146, 44],
  ["chairs", "up-chairs", 36, 176, 56],
];
/** Upgrades on the counter, facing the customers. */
const DECOR_COUNTER: [string, string, number, number, number][] = [
  ["fan", "up-fan", 22, 202, 30],
  ["radio", "up-radio", 400, 206, 36],
  ["tip-jar", "up-tipjar", 210, 210, 20],
  ["paint", "up-plant", 785, 210, 28],
];

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
  const h = w / (RATIO[name] ?? 1);
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

/** The kitchen: [what, picture, centre x, bottom y, width, label]. */
type Station = [
  Item | "fry" | "bin" | "gas",
  string,
  number,
  number,
  number,
  string,
];
const STATIONS: Station[] = [
  ["jollof", "st-jollof", 56, L.shelves[0], 62, "Jollof"],
  ["rice", "st-rice", 150, L.shelves[0], 72, "White rice"],
  ["stew", "st-stew", 246, L.shelves[0], 66, "Stew"],
  ["egusi", "st-egusi", 338, L.shelves[0], 62, "Egusi"],
  ["beef", "st-beef", 438, L.shelves[0], 84, "Beef"],
  ["chicken", "st-chicken", 536, L.shelves[0], 82, "Chicken"],
  ["fish", "st-fish", 634, L.shelves[0], 84, "Fish"],
  ["bin", "bin", 742, L.shelves[0], 38, "Bin plate"],
  // The stove stands on the floor in front of the lower shelf, clear of the labels above.
  ["fry", "", 70, 397, 80, "Dodo"],
  ["gas", "gas", 168, L.shelves[1], 40, "Gas"],
  ["eba", "st-eba", 264, L.shelves[1], 68, "Eba"],
  ["moin", "st-moin", 362, L.shelves[1], 70, "Moin moin"],
  ["drink", "st-drink", 462, L.shelves[1], 70, "Cold drinks"],
];
const STEAMING = new Set(["jollof", "rice", "stew", "egusi"]);

function mood(c: Customer): "happy" | "wait" | "angry" {
  if (c.leaving) return c.leaving.paid > 0 ? "happy" : "angry";
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

/** The stove with the pan on it: off, hot oil, raw plantain, frying, golden, burnt. */
const stovePic = (stage: MamaState["fry"]["stage"], t: number) =>
  stage === "idle"
    ? "stove-off"
    : stage === "frying"
      ? t < 0.5
        ? "stove-oil"
        : t < 1.5
          ? "stove-raw"
          : "stove-frying"
      : stage === "ready"
        ? "stove-ready"
        : "stove-burnt";

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
  @media (prefers-reduced-motion: reduce) { .mp-breathe, .mp-cheer, .mp-shake, .mp-tap, .mp-drop, .mp-steam path, .mp-sizzle circle, .mp-ready, .mp-sway, .mp-point, .mp-warn { animation: none; } .mp-float, .mp-coin { animation-duration: .01s; } }
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
  const rules = rulesOf(s);
  const owned = new Set<string>(rules.owned ?? []);

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
    const names = [
      ...Object.keys(RATIO),
      ...Object.keys(CUSTOMER_RATIO).map((k) => `cust-${k}`),
    ];
    for (const n of names) new Image().src = src(n);
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
      const next = tick(a.seed, before, dt);
      if (next.fry.stage === "ready" && before.fry.stage === "frying")
        a.sound("tick");
      if (next.fry.stage === "burnt" && before.fry.stage === "ready") {
        a.sound("lose");
        setSaid("The dodo burnt.");
      }
      if (gasLeft(next) <= 0 && gasLeft(before) > 0) {
        a.sound("lose");
        setSaid("The gas has finished. Buy a new cylinder to fry again.");
        effect(
          {
            kind: "word",
            x: 206,
            y: 330,
            text: "Gas don finish!",
            color: "#b8261a",
          },
          1800,
        );
      }
      next.spots.forEach((c, i) => {
        if (c && !before.spots[i]) {
          a.sound("invite");
          setSaid(
            `A customer at place ${i + 1} wants ${c.order.map((x) => ITEM_NAME[x]).join(", ")}.`,
          );
        }
        if (c?.leaving && !before.spots[i]?.leaving && c.leaving.paid === 0) {
          a.sound("lose");
          effect({
            kind: "word",
            x: L.spotX[i]!,
            y: 110,
            text: "Ehn?!",
            color: "#e8563a",
          });
        }
      });
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
      api.sound(st >= 2 ? "win" : "lose");
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

  const use = (what: Station[0]) => {
    const a = apiRef.current;
    if (a.paused || hold.current || state.current.over) return;
    const cur = state.current;
    bump(what);
    if (what === "gas") {
      const r = buyGas(cur);
      if (r.ok) {
        a.sound("win");
        commit(r.state);
        effect({
          kind: "word",
          x: 206,
          y: 330,
          text: `New gas: -₦${gasPrice(cur).toLocaleString("en-NG")}`,
          color: "#1f5fa8",
        });
        setSaid(`New gas cylinder for ₦${gasPrice(cur)}.`);
      } else if (gasLeft(cur) >= gasMax(cur)) {
        effect({
          kind: "word",
          x: 206,
          y: 330,
          text: "Gas is still full",
          color: "#2a1d17",
        });
      } else {
        a.sound("tap");
        effect({
          kind: "word",
          x: 206,
          y: 330,
          text: `Need ₦${gasPrice(cur).toLocaleString("en-NG")} for gas`,
          color: "#b8261a",
        });
      }
      return;
    }
    if (what === "bin") {
      if (!cur.plates[cur.selected]!.length) return;
      a.sound("drop");
      commit(bin(cur));
      setSaid("Plate cleared.");
      return;
    }
    if (what === "fry") {
      if (cur.fry.stage === "ready") return use("dodo");
      if (gasLeft(cur) <= 0) {
        a.sound("tap");
        effect({
          kind: "word",
          x: 92,
          y: 330,
          text: "No gas! Buy a cylinder",
          color: "#b8261a",
        });
        return;
      }
      const next = fry(cur);
      if (next !== cur) {
        a.sound("roll");
        commit(next);
        setSaid("Dodo frying.");
      }
      return;
    }
    const r = add(cur, what);
    if (!r.ok) {
      if (r.why === "fry")
        effect({
          kind: "word",
          x: 92,
          y: 330,
          text: "Fry the dodo first",
          color: "#b8261a",
        });
      a.sound("tap");
      return;
    }
    a.sound("flip");
    navigator.vibrate?.(10);
    commit(r.state);
    setSaid(`${ITEM_NAME[what]} on plate ${cur.selected + 1}.`);
  };

  const hand = (i: number) => {
    const a = apiRef.current;
    if (a.paused || hold.current) return;
    const r = serve(state.current, i);
    if (r.state === state.current) return;
    commit(r.state);
    if (r.right) {
      a.sound("win");
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
      effect({ kind: "coins", x: L.spotX[i]!, y: L.plateY }, 1000);
      setSaid(
        `Served. ₦${r.paid + r.tip}${r.tip ? `, with a ₦${r.tip} tip` : ""}.`,
      );
    } else {
      a.sound("lose");
      effect({
        kind: "word",
        x: L.spotX[i]!,
        y: 110,
        text: "This no be wetin I order!",
        color: "#e8563a",
      });
      setSaid("Wrong plate. They left without paying.");
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
      ? "Your first customer is coming. Their order shows in the bubble."
      : step?.kind === "plate"
        ? "Tap the plate in front of your customer. That's the plate you'll dish onto."
        : step?.kind === "add"
          ? `Your customer wants ${s.spots[0]!.order.map((x) => ITEM_NAME[x]).join(", ")}. Tap the ${ITEM_NAME[step.item].toLowerCase()} in the kitchen.`
          : step?.kind === "bin"
            ? "That's not what they ordered. Tap the bin to clear the plate."
            : step?.kind === "serve"
              ? "Everything they want is on the plate. Tap Serve!"
              : null;

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
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 block h-full w-full touch-manipulation select-none"
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
            <rect x="0" y={L.counterTop} width={W} height={H - L.counterTop} />
          </clipPath>
          <image href={src("scene")} x={0} y={0} width={W} height={H} />
          <text
            x={L.sign[0]}
            y={L.sign[1]}
            textAnchor="middle"
            fontFamily="Fraunces, serif"
            fontStyle="italic"
            fontWeight="900"
            fontSize="30"
            fill="#c43a22"
          >
            Mama Put
          </text>
          {DECOR_BACK.filter(([id]) => owned.has(id)).map(
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

          {/* Customers: walk in, breathe while they wait, cheer or storm off. */}
          {s.spots.map((c, i) => {
            if (!c) return null;
            const inT = Math.min(1, (s.time - c.arrived) / 0.6);
            const outT = c.leaving
              ? Math.min(1, (s.time - c.leaving.at) / LEAVE_SECONDS)
              : 0;
            const side = i < 2 ? -1 : 1;
            const dx =
              (1 - inT) * side * 260 +
              outT * (c.leaving?.paid ? 1 : -1) * side * 260;
            const m = mood(c);
            const key = `${who[i]}-${m}`;
            const h = L.customerHeight;
            const w = h * (CUSTOMER_RATIO[key] ?? 0.7);
            const cls = c.leaving
              ? c.leaving.paid
                ? "mp-cheer"
                : "mp-shake"
              : "mp-breathe";
            return (
              <g
                key={c.id}
                transform={`translate(${L.spotX[i]! + dx} 0)`}
                opacity={1 - outT * 0.9}
              >
                <image
                  key={m}
                  href={src(`cust-${key}`)}
                  x={-w / 2}
                  y={L.customerBottom - h}
                  width={w}
                  height={h}
                  className={cls}
                  style={{ animationDelay: `${(c.id % 5) * 0.37}s` }}
                />
              </g>
            );
          })}

          {/* The counter and kitchen again, in front of the customers, then what's on the counter. */}
          <image
            href={src("scene")}
            x={0}
            y={0}
            width={W}
            height={H}
            clipPath="url(#mp-front)"
          />
          {DECOR_COUNTER.filter(([id]) => owned.has(id)).map(
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
            if (!waiting(c)) return null;
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
                    name={`p-${it}`}
                    x={x + 20 + (k % 3) * 28}
                    bottom={y + 26 + Math.floor(k / 3) * 22}
                    w={it === "drink" ? 8 : 26}
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

          {/* Plates on the counter: tap one to choose which you're dishing onto. */}
          <g data-tour="mama-plates">
            {s.plates.map((p, i) => {
              const sel = s.selected === i;
              const c = s.spots[i];
              const spots = [
                [-14, -3],
                [13, -4],
                [-1, 5],
                [18, 4],
                [-18, 6],
                [3, -10],
              ];
              const x = L.spotX[i]!;
              return (
                <g key={i}>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-pressed={sel}
                    aria-label={`Plate ${i + 1}${p.length ? `: ${p.map((it) => ITEM_NAME[it]).join(", ")}` : ", empty"}${sel ? ", dishing onto this one" : ""}`}
                    onClick={() =>
                      !hold.current && commit(select(state.current, i))
                    }
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      commit(select(state.current, i))
                    }
                    style={{ cursor: "pointer", outline: "none" }}
                  >
                    <rect
                      x={x - 50}
                      y={L.plateY - 30}
                      width="100"
                      height="58"
                      fill="transparent"
                    />
                    {sel ? (
                      <ellipse
                        cx={x}
                        cy={L.plateY}
                        rx="47"
                        ry="21"
                        fill="none"
                        stroke="#f6c453"
                        strokeWidth="3.5"
                        strokeDasharray="7 4"
                      />
                    ) : null}
                    <Pic name="plate" x={x} bottom={L.plateY + 27} w={80} />
                    {p.map((it, k) =>
                      it === "rice" ? (
                        <Pic
                          key={it}
                          name="p-rice"
                          x={x + spots[k]![0]!}
                          bottom={L.plateY + spots[k]![1]! + 14}
                          w={38}
                          className="mp-drop"
                        />
                      ) : it === "drink" ? (
                        <Pic
                          key={it}
                          name="p-drink"
                          x={x + 38}
                          bottom={L.plateY + 18}
                          w={13}
                          className="mp-drop"
                        />
                      ) : (
                        <Pic
                          key={it}
                          name={`f-${it}`}
                          x={x + spots[k]![0]!}
                          bottom={L.plateY + spots[k]![1]! + 13}
                          w={34}
                          className="mp-drop"
                        />
                      ),
                    )}
                    {step?.kind === "plate" && i === 0 ? (
                      <ellipse
                        cx={x}
                        cy={L.plateY}
                        rx="54"
                        ry="27"
                        fill="none"
                        stroke="#2e9b57"
                        className="mp-point"
                      />
                    ) : null}
                  </g>
                  {p.length && waiting(c) ? (
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={`Serve plate ${i + 1}`}
                      onClick={() => hand(i)}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && hand(i)
                      }
                      style={{ cursor: "pointer", outline: "none" }}
                    >
                      {/* On the counter, just right of the plate. */}
                      <rect
                        x={x + 42}
                        y={L.plateY - 11}
                        width="50"
                        height="22"
                        rx="11"
                        fill="#1c1416"
                      />
                      <text
                        x={x + 67}
                        y={L.plateY + 4}
                        textAnchor="middle"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="800"
                        fontSize="10.5"
                        fill="#f6efe6"
                      >
                        Serve
                      </text>
                      {step?.kind === "serve" && i === 0 ? (
                        <rect
                          x={x + 36}
                          y={L.plateY - 17}
                          width="62"
                          height="34"
                          rx="17"
                          fill="none"
                          stroke="#2e9b57"
                          className="mp-point"
                        />
                      ) : null}
                    </g>
                  ) : null}
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
                      name={stovePic(s.fry.stage, s.fry.t)}
                      x={x}
                      bottom={bottom}
                      w={w * (owned.has("big-pan") ? 1.08 : 1)}
                    />
                    {(s.fry.stage === "frying" || s.fry.stage === "ready") &&
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
                        cx={x - 9}
                        cy={bottom - 45}
                        rx="26"
                        ry="10"
                        fill="none"
                        stroke="#f6c453"
                        strokeWidth="3"
                        className="mp-ready"
                      />
                    ) : null}
                    {s.fry.stage === "burnt" ? (
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
                  <GasCylinder x={x} bottom={bottom} level={gas} />
                ) : (
                  <Pic name={pic} x={x} bottom={bottom} w={w} />
                )}
              </g>
              {STEAMING.has(what)
                ? steam(x - 2, bottom - w / (RATIO[pic] ?? 1) + 4)
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
                y={what === "fry" ? bottom - 66 : bottom + (bottom === L.shelves[0] ? 12 : 16)}
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
                    ? "Tap to fry dodo"
                    : s.fry.stage === "frying"
                      ? gasLeft(s) > 0
                        ? "Frying…"
                        : "No gas!"
                      : s.fry.stage === "ready"
                        ? "Dodo ready: tap to dish"
                        : "Burnt! Tap to fry again"
                  : what === "gas"
                    ? gas <= 0
                      ? `Buy gas ₦${gasPrice(s).toLocaleString("en-NG")}`
                      : "Gas"
                    : label}
              </text>
            </g>
          ))}
          {STATIONS.map(([what, , x, bottom, w, label]) => {
            const b =
              what === "fry"
                ? { x: x - w / 2 - 6, y: bottom - 76, w: w + 12, h: 78 }
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
                      ? "Dish the dodo"
                      : "Fry dodo"
                    : what === "bin"
                      ? "Bin the plate"
                      : what === "gas"
                        ? `Gas, ${Math.round(gas * 100)}% left. Buy a new cylinder for ₦${gasPrice(s)}`
                        : `Add ${label}`
                }
                onClick={() => use(what)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && use(what)
                }
                style={{ cursor: "pointer", outline: "none" }}
                className="focus-visible:fill-[rgba(233,177,60,.18)]"
              />
            );
          })}

          {/* The tutorial: Mama shows the way. */}
          {hint ? (
            <g pointerEvents="none">
              <Pic
                name="mama-happy"
                x={W - 92}
                bottom={L.counterTop + 4}
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
          Tap a plate, then the food to dish it. Serve it to the person in
          front. Fry dodo before you need it, and watch the gas.
        </p>
      ) : null}
    </div>
  );
}

/** The gas cylinder, with a gauge: green, then amber, then red and empty. */
function GasCylinder({
  x,
  bottom,
  level,
}: {
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
        name={fresh ? "gas-new" : "gas"}
        x={x}
        bottom={bottom}
        w={fresh ? 42 : 40}
      />
      {/* The gauge. */}
      <rect
        x={x + 23}
        y={bottom - 52}
        width="6"
        height="46"
        rx="3"
        fill="rgba(0,0,0,.25)"
      />
      <rect
        x={x + 23}
        y={bottom - 6 - 46 * Math.max(0, level)}
        width="6"
        height={46 * Math.max(0, level)}
        rx="3"
        fill={col}
      />
    </g>
  );
}
