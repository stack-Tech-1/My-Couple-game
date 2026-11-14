"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ITEM_NAME, LEAVE_SECONDS, add, bin, configFor, fry, newMama, rulesOf, select, serve, stars, tick, waiting, type Customer, type Item, type MamaState } from "@/lib/solo/games/mama";
import type { SoloApi } from "../SoloShell";

/**
 * Mama Put, drawn with the painted art in /public/games/mama-put (made by scripts/art). The
 * rules live in lib/solo/games/mama; this only draws them and turns taps into moves.
 */
const ART = "/games/mama-put/";
const src = (name: string) => `${ART}${name}.webp`;
const W = 374;
const H = 616;
const SPOT_X = [64, 187, 310] as const;
const PLATE_Y = 228;

/** Width ÷ height of each picture, so they keep their shape. */
const RATIO: Record<string, number> = {
  bin: 0.759, coin: 1.108, counter: 3.859, wall: 2.313, stove: 2.5, plate: 1.429,
  "pan-burnt": 1.122, "pan-empty": 1.294, "pan-frying": 1.294, "pan-raw": 1.294, "pan-ready": 1.279,
  "st-beef": 1.811, "st-chicken": 1.729, "st-drink": 1.198, "st-eba": 1.156, "st-egusi": 1.25, "st-fish": 1.84, "st-jollof": 1.1, "st-moin": 1.173, "st-rice": 1.377, "st-stew": 1.299,
  "p-beef": 1.297, "p-chicken": 1.352, "p-dodo": 1.333, "p-drink": 0.379, "p-eba": 1.412, "p-egusi": 1.433, "p-fish": 1.455, "p-jollof": 1.433, "p-moin": 1.352, "p-rice": 1.433, "p-stew": 1.412,
  "f-beef": 1.116, "f-chicken": 1.328, "f-dodo": 1.481, "f-eba": 1.116, "f-egusi": 1.262, "f-fish": 1.711, "f-jollof": 1.426, "f-moin": 1.167, "f-stew": 1.481,
};
const CUSTOMER_RATIO: Record<string, number> = {
  "aunty-angry": 0.643, "aunty-happy": 0.723, "aunty-wait": 0.678, "baba-angry": 0.751, "baba-happy": 0.789, "baba-wait": 0.737,
  "corper-angry": 0.635, "corper-happy": 0.742, "corper-wait": 0.693, "fila-angry": 0.631, "fila-happy": 0.712, "fila-wait": 0.672,
  "oga-angry": 0.676, "oga-happy": 0.801, "oga-wait": 0.737, "student-angry": 0.66, "student-happy": 0.702, "student-wait": 0.693,
};
const PEOPLE = ["aunty", "fila", "corper", "student", "oga", "baba"] as const;

/** A picture placed by its bottom-centre point, at a given width. */
function Pic({ name, x, bottom, w, className, style }: { name: string; x: number; bottom: number; w: number; className?: string; style?: CSSProperties }) {
  const h = w / (RATIO[name] ?? 1);
  return <image href={src(name)} x={x - w / 2} y={bottom - h} width={w} height={h} className={className} style={style} />;
}

/** The kitchen: [what, picture, centre x, bottom y, width, label]. */
type Station = [Item | "fry" | "bin", string, number, number, number, string];
const STATIONS: Station[] = [
  ["jollof", "st-jollof", 50, 384, 86, "Jollof"],
  ["rice", "st-rice", 143, 384, 96, "White rice"],
  ["stew", "st-stew", 238, 384, 90, "Stew"],
  ["egusi", "st-egusi", 328, 384, 84, "Egusi"],
  ["beef", "st-beef", 52, 470, 92, "Beef"],
  ["chicken", "st-chicken", 145, 470, 90, "Chicken"],
  ["fish", "st-fish", 238, 470, 90, "Fish"],
  ["eba", "st-eba", 328, 474, 78, "Eba"],
  ["fry", "", 66, 576, 120, "Dodo"],
  ["moin", "st-moin", 182, 576, 78, "Moin moin"],
  ["drink", "st-drink", 268, 576, 80, "Cold drinks"],
  ["bin", "bin", 342, 576, 44, "Bin plate"],
];
const STEAMING = new Set(["jollof", "rice", "stew", "egusi"]);

/** Calm while they wait, cross when time is short; the thumbs-up is the reward for serving. */
function mood(c: Customer): "happy" | "wait" | "angry" {
  if (c.leaving) return c.leaving.paid > 0 ? "happy" : "angry";
  return c.patience / c.max > 0.3 ? "wait" : "angry";
}

/** Who's at each spot: each customer gets a character, never the same one twice at the counter. */
function cast(spots: MamaState["spots"]): string[] {
  const used = new Set<string>();
  return spots.map((c) => {
    if (!c) return "";
    let k = (c.look.cloth + c.id) % PEOPLE.length;
    for (let n = 0; n < PEOPLE.length && used.has(PEOPLE[k]!); n++) k = (k + 1) % PEOPLE.length;
    used.add(PEOPLE[k]!);
    return PEOPLE[k]!;
  });
}

const panPic = (stage: MamaState["fry"]["stage"], t: number) => (stage === "idle" ? "pan-empty" : stage === "frying" ? (t < 1.4 ? "pan-raw" : "pan-frying") : stage === "ready" ? "pan-ready" : "pan-burnt");
const panLabel = (stage: MamaState["fry"]["stage"]) => (stage === "idle" ? "Tap to fry dodo" : stage === "frying" ? "Frying…" : stage === "ready" ? "Dodo ready: tap to dish" : "Burnt! Tap to fry again");

type Fx = { id: number; kind: "money" | "word" | "coins"; x: number; y: number; text?: string; color?: string };

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
  @media (prefers-reduced-motion: reduce) { .mp-breathe, .mp-cheer, .mp-shake, .mp-tap, .mp-drop, .mp-steam path, .mp-sizzle circle, .mp-ready { animation: none; } .mp-float, .mp-coin { animation-duration: .01s; } }
`;

const steam = (x: number, y: number) => (
  <g className="mp-steam" fill="none" stroke="#fff" strokeLinecap="round" opacity=".85" pointerEvents="none">
    {[-9, 1, 11].map((dx, i) => (
      <path key={dx} d={`M${x + dx} ${y} q-5 -7 0 -14 q5 -7 0 -14`} strokeWidth={3 - i * 0.5} style={{ animationDelay: `${i * 0.7}s` }} />
    ))}
  </g>
);

export function MamaPut({ api }: { api: SoloApi<MamaState> }) {
  const [s, setS] = useState<MamaState>(() => api.saved ?? newMama(api.seed, configFor(api.mode)));
  const state = useRef(s);
  const [fx, setFx] = useState<Fx[]>([]);
  const [taps, setTaps] = useState<Record<string, number>>({});
  const [said, setSaid] = useState("");
  const fxId = useRef(1);
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const rules = rulesOf(s);

  // Load every picture up front, so faces and pans change without a flicker.
  useEffect(() => {
    const names = [...Object.keys(RATIO), ...Object.keys(CUSTOMER_RATIO).map((k) => `cust-${k}`)];
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
  const bump = (key: string) => setTaps((t) => ({ ...t, [key]: (t[key] ?? 0) + 1 }));

  // The clock: ten updates a second is plenty for patience bars and the pan.
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = Math.min(0.25, (t - last) / 1000);
      last = t;
      const a = apiRef.current;
      if (a.paused || state.current.over) return;
      const before = state.current;
      const next = tick(a.seed, before, dt);
      if (next.fry.stage === "ready" && before.fry.stage === "frying") a.sound("tick");
      if (next.fry.stage === "burnt" && before.fry.stage === "ready") {
        a.sound("lose");
        setSaid("The dodo burnt.");
      }
      next.spots.forEach((c, i) => {
        if (c && !before.spots[i]) {
          a.sound("invite");
          setSaid(`A customer at the counter wants ${c.order.map((x) => ITEM_NAME[x]).join(", ")}.`);
        }
        if (c?.leaving && !before.spots[i]?.leaving && c.leaving.paid === 0) {
          a.sound("lose");
          effect({ kind: "word", x: SPOT_X[i]!, y: 120, text: "Ehn?!", color: "#e8563a" });
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
      const st = stars(s.money, rulesOf(s));
      api.sound(st >= 2 ? "win" : "lose");
      api.end(s.money, { served: s.served, lost: s.lost, stars: st });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  const use = (what: Item | "fry" | "bin") => {
    const a = apiRef.current;
    if (a.paused || state.current.over) return;
    const cur = state.current;
    bump(what);
    if (what === "bin") {
      if (!cur.plates[cur.selected]!.length) return;
      a.sound("drop");
      commit(bin(cur));
      setSaid("Plate cleared.");
      return;
    }
    if (what === "fry") {
      if (cur.fry.stage === "ready") return use("dodo");
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
      if (r.why === "fry") effect({ kind: "word", x: 70, y: 500, text: "Fry the dodo first", color: "#b8261a" });
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
    if (a.paused) return;
    const r = serve(state.current, i);
    if (r.state === state.current) return;
    commit(r.state);
    if (r.right) {
      a.sound("win");
      navigator.vibrate?.(20);
      effect({ kind: "money", x: SPOT_X[i]!, y: 150, text: `+₦${(r.paid + r.tip).toLocaleString("en-NG")}`, color: "#2f8a4e" });
      if (r.tip) effect({ kind: "word", x: SPOT_X[i]!, y: 172, text: `₦${r.tip} tip, sharp sharp!`, color: "#b0730a" });
      effect({ kind: "coins", x: SPOT_X[i]!, y: PLATE_Y }, 1000);
      setSaid(`Served. ₦${r.paid + r.tip}${r.tip ? `, with a ₦${r.tip} tip` : ""}.`);
    } else {
      a.sound("lose");
      effect({ kind: "word", x: SPOT_X[i]!, y: 120, text: "This no be wetin I order!", color: "#e8563a" });
      setSaid("Wrong plate. They left without paying.");
    }
  };

  const left = Math.max(0, Math.ceil(rules.seconds - s.time));
  const st = stars(s.money, rules);
  const who = cast(s.spots);
  return (
    <div className="mx-auto max-w-[440px] select-none">
      <div className="flex items-center justify-between px-1">
        <p className="display text-[1.5rem] leading-none tabular" aria-label={`${left} seconds left`}>
          ⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </p>
        <p className="display text-[1.6rem] leading-none tabular text-[#2f8a4e]">₦{s.money.toLocaleString("en-NG")}</p>
        <p className="text-[1.2rem] leading-none tracking-[0.1em]" aria-label={`${st} of 3 stars. Next star at ₦${(rules.stars[st] ?? rules.stars[2]).toLocaleString("en-NG")}`}>
          {"★".repeat(st)}
          <span className="opacity-30">{"★".repeat(3 - st)}</span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div data-tour="mama-shop" className="mt-2 overflow-hidden rounded-[22px] shadow-[0_16px_30px_-18px_rgba(28,20,22,.7)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-manipulation" role="group" aria-label="Mama Put. The counter is at the top, the kitchen below.">
          <style>{CSS}</style>
          <defs>
            <linearGradient id="mp-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f3e7d2" />
              <stop offset="1" stopColor="#e6d3b5" />
            </linearGradient>
            <pattern id="mp-tiles" width="34" height="34" patternUnits="userSpaceOnUse">
              <rect width="34" height="34" fill="url(#mp-floor)" />
              <path d="M0 .5H34M.5 0V34" stroke="#dcc9a9" strokeWidth="1" />
            </pattern>
            <linearGradient id="mp-shelf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f1eee9" />
              <stop offset="1" stopColor="#c8c1b6" />
            </linearGradient>
            <filter id="mp-ds" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".3" />
            </filter>
          </defs>

          {/* The shop. */}
          <image href={src("wall")} x={-30} y={0} width={434} height={434 / RATIO.wall!} preserveAspectRatio="xMidYMid slice" />
          <text x={W / 2} y={29} textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontWeight="900" fontSize="19" fill="#c43a22">
            Mama Put
          </text>

          {/* Customers: walk in, breathe while they wait, cheer or storm off. */}
          {s.spots.map((c, i) => {
            if (!c) return null;
            const inT = Math.min(1, (s.time - c.arrived) / 0.6);
            const outT = c.leaving ? Math.min(1, (s.time - c.leaving.at) / LEAVE_SECONDS) : 0;
            const dx = (1 - inT) * (i === 0 ? -170 : 170) + outT * (c.leaving?.paid ? 170 : -170);
            const m = mood(c);
            const key = `${who[i]}-${m}`;
            const h = 176;
            const w = h * (CUSTOMER_RATIO[key] ?? 0.7);
            const cls = c.leaving ? (c.leaving.paid ? "mp-cheer" : "mp-shake") : "mp-breathe";
            return (
              <g key={c.id} transform={`translate(${SPOT_X[i]! + dx} 0)`} opacity={1 - outT * 0.9}>
                <image key={m} href={src(`cust-${key}`)} x={-w / 2} y={244 - h} width={w} height={h} className={cls} style={{ animationDelay: `${(c.id % 5) * 0.37}s` }} />
              </g>
            );
          })}

          <image href={src("counter")} x={-22} y={190} width={418} height={418 / RATIO.counter!} preserveAspectRatio="none" />

          {/* What each customer wants, and how long they'll wait. */}
          {s.spots.map((c, i) => {
            if (!waiting(c)) return null;
            const f = c.patience / c.max;
            const cols = Math.min(3, c.order.length);
            const rows = Math.ceil(c.order.length / 3);
            const bw = cols * 30 + 12;
            const bh = rows * 24 + 16;
            const x = Math.max(4, Math.min(W - bw - 4, SPOT_X[i]! - bw / 2));
            const y = 40;
            return (
              <g key={c.id} role="img" aria-label={`Wants ${c.order.map((it) => ITEM_NAME[it]).join(", ")}`}>
                <g filter="url(#mp-ds)">
                  <rect x={x} y={y} width={bw} height={bh} rx="12" fill="#fffdf8" />
                  <path d={`M${SPOT_X[i]! - 7} ${y + bh - 1} l7 8 l7 -8z`} fill="#fffdf8" />
                </g>
                {c.order.map((it, k) => (
                  <Pic key={it} name={`p-${it}`} x={x + 21 + (k % 3) * 30} bottom={y + 30 + Math.floor(k / 3) * 24} w={it === "drink" ? 9 : 28} />
                ))}
                <rect x={x + 8} y={y + bh - 9} width={bw - 16} height="5" rx="2.5" fill="rgba(58,26,8,.15)" />
                <rect x={x + 8} y={y + bh - 9} width={(bw - 16) * f} height="5" rx="2.5" fill={f > 0.5 ? "#2f8a4e" : f > 0.25 ? "#e9a13c" : "#e8563a"} />
              </g>
            );
          })}

          {/* Plates on the counter: tap one to choose which you're dishing onto. */}
          {s.plates.map((p, i) => {
            const sel = s.selected === i;
            const c = s.spots[i];
            const spots = [[-15, -4], [14, -5], [-1, 6], [19, 5], [-19, 7], [3, -11]];
            return (
              <g key={i}>
                <g
                  role="button"
                  tabIndex={0}
                  aria-pressed={sel}
                  aria-label={`Plate ${i + 1}${p.length ? `: ${p.map((x) => ITEM_NAME[x]).join(", ")}` : ", empty"}${sel ? ", dishing onto this one" : ""}`}
                  onClick={() => commit(select(state.current, i))}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && commit(select(state.current, i))}
                  style={{ cursor: "pointer", outline: "none" }}
                >
                  <rect x={SPOT_X[i]! - 56} y={PLATE_Y - 34} width="112" height="64" fill="transparent" />
                  {sel ? <ellipse cx={SPOT_X[i]} cy={PLATE_Y} rx="52" ry="23" fill="none" stroke="#f6c453" strokeWidth="3.5" strokeDasharray="7 4" /> : null}
                  <Pic name="plate" x={SPOT_X[i]!} bottom={PLATE_Y + 30} w={88} />
                  {p.map((it, k) =>
                    it === "rice" ? (
                      <Pic key={it} name="p-rice" x={SPOT_X[i]! + spots[k]![0]!} bottom={PLATE_Y + spots[k]![1]! + 16} w={42} className="mp-drop" />
                    ) : it === "drink" ? (
                      <Pic key={it} name="p-drink" x={SPOT_X[i]! + 42} bottom={PLATE_Y + 20} w={14} className="mp-drop" />
                    ) : (
                      <Pic key={it} name={`f-${it}`} x={SPOT_X[i]! + spots[k]![0]!} bottom={PLATE_Y + spots[k]![1]! + 15} w={38} className="mp-drop" />
                    ),
                  )}
                </g>
                {p.length && waiting(c) ? (
                  <g role="button" tabIndex={0} aria-label={`Serve plate ${i + 1}`} onClick={() => hand(i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && hand(i)} style={{ cursor: "pointer", outline: "none" }}>
                    <rect x={SPOT_X[i]! - 36} y={268} width="72" height="24" rx="12" fill="#1c1416" />
                    <text x={SPOT_X[i]} y={284.5} textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="11" fill="#f6efe6">
                      Serve →
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* The kitchen. */}
          <rect x="0" y="298" width={W} height={H - 298} fill="url(#mp-tiles)" />
          <rect x="0" y="298" width={W} height="10" fill="rgba(58,26,8,.18)" />
          {[386, 476, 578].map((y) => (
            <g key={y}>
              <rect x="6" y={y - 8} width={W - 12} height="12" rx="5" fill="url(#mp-shelf)" />
              <rect x="6" y={y + 3} width={W - 12} height="3" rx="1.5" fill="#9e978c" />
            </g>
          ))}
          {STATIONS.map(([what, pic, x, bottom, w, label]) => (
            <g key={what}>
              <g key={taps[what] ?? 0} className={taps[what] ? "mp-tap" : undefined}>
                {what === "fry" ? (
                  <>
                    <Pic name="stove" x={x} bottom={bottom + 4} w={136} />
                    <Pic name={panPic(s.fry.stage, s.fry.t)} x={x + 2} bottom={bottom - 12} w={s.fry.stage === "burnt" ? 92 : 104} />
                    {s.fry.stage === "frying" || s.fry.stage === "ready" ? (
                      <g className="mp-sizzle" pointerEvents="none">
                        {[-22, -8, 6, 20, -14, 12].map((dx, k) => (
                          <circle key={k} cx={x + dx} cy={bottom - 46 + (k % 2) * 6} r="1.6" fill="none" stroke="#fff8d2" strokeWidth=".9" style={{ animationDelay: `${k * 0.15}s` }} />
                        ))}
                      </g>
                    ) : null}
                    {s.fry.stage === "ready" ? <ellipse cx={x + 2} cy={bottom - 40} rx="40" ry="15" fill="none" stroke="#f6c453" strokeWidth="3" className="mp-ready" /> : null}
                  </>
                ) : (
                  <Pic name={pic} x={x} bottom={bottom} w={w} />
                )}
              </g>
              {STEAMING.has(what) ? steam(x - 2, bottom - w / (RATIO[pic] ?? 1) + 4) : null}
              <text x={x} y={bottom + 18} textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="10" fill={what === "fry" && s.fry.stage === "burnt" ? "#b8261a" : "#2a1d17"} stroke="#f7efe2" strokeWidth="3" paintOrder="stroke">
                {what === "fry" ? panLabel(s.fry.stage) : label}
              </text>
            </g>
          ))}
          {STATIONS.map(([what, , x, bottom, w, label]) => {
            const box = what === "fry" ? { x: x - 68, y: bottom - 92, w: 136, h: 114 } : { x: x - w / 2 - 4, y: bottom - 90, w: w + 8, h: 112 };
            return (
              <rect
                key={what}
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx="12"
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={what === "fry" ? (s.fry.stage === "ready" ? "Dish the dodo" : "Fry dodo") : what === "bin" ? "Bin the plate" : `Add ${label}`}
                onClick={() => use(what)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && use(what)}
                style={{ cursor: "pointer", outline: "none" }}
                className="focus-visible:fill-[rgba(233,177,60,.18)]"
              />
            );
          })}

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
                    style={{ ["--dx" as string]: `${W - 70 - f.x}px`, ["--dy" as string]: `${-f.y - 20}px`, animationDelay: `${k * 0.07}s` } as CSSProperties}
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
      </div>
      <p data-tour="mama-plates" className="mt-3 text-center text-[0.82rem] text-muted">Tap a plate, then tap the food to dish it. Serve it to the person in front. Fry dodo before you need it.</p>
    </div>
  );
}
