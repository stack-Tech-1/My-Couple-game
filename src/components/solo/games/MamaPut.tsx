"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ITEM_NAME, LEAVE_SECONDS, RUSH_SECONDS, STAR_AT, add, bin, fry, newMama, select, serve, stars, tick, waiting, type Customer, type Item, type MamaState } from "@/lib/solo/games/mama";
import { CSS, DEFS, PLATE_Y, SPOT_X, STAGE_H, STAGE_W, backdropArt, counterArt, kitchenArt, panArt, personArt, plateArt } from "./mama-art";
import type { SoloApi } from "../SoloShell";

type Pop = { id: number; x: number; y: number; text: string; color: string; at: number };

/** Tap targets over the kitchen drawing: [item or action, x, y, w, h, label]. */
const STATIONS: [Item | "fry" | "bin", number, number, number, number, string][] = [
  ["jollof", 14, 324, 100, 110, "Jollof rice"],
  ["rice", 120, 324, 100, 110, "White rice"],
  ["stew", 250, 330, 100, 108, "Stew"],
  ["fry", 14, 470, 126, 100, "Frying pan"],
  ["beef", 152, 462, 40, 84, "Beef"],
  ["chicken", 192, 462, 40, 84, "Chicken"],
  ["fish", 232, 462, 40, 84, "Fish"],
  ["eba", 274, 462, 42, 84, "Eba"],
  ["moin", 316, 462, 54, 84, "Moin moin"],
  ["drink", 14, 574, 134, 112, "Cold drinks"],
  ["egusi", 148, 600, 98, 88, "Egusi"],
  ["bin", 286, 590, 72, 96, "Bin the plate"],
];

function mood(c: Customer): "happy" | "wait" | "angry" {
  if (c.leaving) return c.leaving.paid > 0 ? "happy" : "angry";
  const f = c.patience / c.max;
  return f > 0.6 ? "happy" : f > 0.25 ? "wait" : "angry";
}

export function MamaPut({ api }: { api: SoloApi<MamaState> }) {
  const [s, setS] = useState<MamaState>(() => api.saved ?? newMama(api.seed));
  const state = useRef(s);
  const [pops, setPops] = useState<Pop[]>([]);
  const [said, setSaid] = useState("");
  const popId = useRef(1);
  const ended = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const still = useMemo(() => ({ back: backdropArt(), counter: counterArt(), kitchen: kitchenArt() }), []);

  const commit = (next: MamaState) => {
    state.current = next;
    setS(next);
  };
  const pop = (x: number, y: number, text: string, color = "#2f8a4e") => {
    const p = { id: popId.current++, x, y, text, color, at: state.current.time };
    setPops((ps) => [...ps.filter((q) => state.current.time - q.at < 1.4), p]);
  };

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
          pop(SPOT_X[i]!, 140, "Ehn?!", "#e8563a");
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
      api.sound(stars(s.money) >= 2 ? "win" : "lose");
      api.end(s.money, { served: s.served, lost: s.lost, stars: stars(s.money) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes
  }, [s]);

  const use = (what: Item | "fry" | "bin") => {
    const a = apiRef.current;
    if (a.paused || state.current.over) return;
    const cur = state.current;
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
      if (r.why === "fry") pop(70, 470, "Fry the dodo first", "#b8261a");
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
      pop(SPOT_X[i]!, 222, `+₦${(r.paid + r.tip).toLocaleString("en-NG")}`);
      setSaid(`Served. ₦${r.paid + r.tip}${r.tip ? `, with a ₦${r.tip} tip` : ""}.`);
    } else {
      a.sound("lose");
      pop(SPOT_X[i]!, 140, "This no be wetin I order!", "#e8563a");
      setSaid("Wrong plate. They left without paying.");
    }
  };

  const left = Math.max(0, Math.ceil(RUSH_SECONDS - s.time));
  const st = stars(s.money);
  return (
    <div className="mx-auto max-w-[440px] select-none">
      <div className="flex items-center justify-between px-1">
        <p className="display text-[1.5rem] leading-none tabular" aria-label={`${left} seconds left`}>
          ⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </p>
        <p className="display text-[1.6rem] leading-none tabular text-[#2f8a4e]">₦{s.money.toLocaleString("en-NG")}</p>
        <p className="text-[1.2rem] leading-none tracking-[0.1em]" aria-label={`${st} of 3 stars. Next star at ₦${(STAR_AT[st] ?? STAR_AT[2]).toLocaleString("en-NG")}`}>
          {"★".repeat(st)}
          <span className="opacity-30">{"★".repeat(3 - st)}</span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div data-tour="mama-shop" className="mt-2 overflow-hidden rounded-[22px] shadow-[0_16px_30px_-18px_rgba(28,20,22,.7)]">
        <svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} className="block w-full touch-manipulation" role="group" aria-label="Mama Put. The counter is at the top, the kitchen below.">
          <style>{CSS}</style>
          <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
          <g dangerouslySetInnerHTML={{ __html: still.back }} />

          {/* Customers, walking in and out. */}
          {s.spots.map((c, i) => {
            if (!c) return null;
            const inT = Math.min(1, (s.time - c.arrived) / 0.6);
            const outT = c.leaving ? Math.min(1, (s.time - c.leaving.at) / LEAVE_SECONDS) : 0;
            const dx = (1 - inT) * (i === 0 ? -160 : 160) + outT * (c.leaving?.paid ? 160 : -160);
            const f = c.patience / c.max;
            const R = 31, C = 2 * Math.PI * R;
            return (
              <g key={c.id} transform={`translate(${SPOT_X[i]! + dx} 0)`} opacity={1 - outT * 0.9}>
                {!c.leaving ? (
                  <g transform="translate(0 102)" aria-label={`Wants ${c.order.map((x) => ITEM_NAME[x]).join(", ")}`} role="img">
                    <path d="M-8 30 l8 14 l8 -14z" fill="#fff" />
                    <circle r="36" fill="#fff" filter="url(#mp-ds)" />
                    <circle r={R} fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="5" />
                    <circle r={R} fill="none" stroke={f > 0.5 ? "#2f8a4e" : f > 0.25 ? "#e9b13c" : "#e8563a"} strokeWidth="5" strokeDasharray={`${C * f} ${C}`} transform="rotate(-90)" strokeLinecap="round" />
                    <g transform="scale(.62)" dangerouslySetInnerHTML={{ __html: plateArt(c.order, `order-${c.id}`, 40, 15) }} />
                  </g>
                ) : null}
                <g dangerouslySetInnerHTML={{ __html: personArt(c.look, mood(c)) }} />
              </g>
            );
          })}

          <g dangerouslySetInnerHTML={{ __html: still.counter }} />

          {/* Plates on the counter: tap one to choose which you're dishing onto. */}
          {s.plates.map((p, i) => {
            const sel = s.selected === i;
            const c = s.spots[i];
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
                  transform={`translate(${SPOT_X[i]} ${PLATE_Y})`}
                >
                  <rect x="-56" y="-26" width="112" height="44" fill="transparent" />
                  {sel ? <ellipse rx="50" ry="20" fill="none" stroke="#e9b13c" strokeWidth="3.5" strokeDasharray="6 4" /> : null}
                  <g dangerouslySetInnerHTML={{ __html: plateArt(p, `plate-${i}-${p.join("")}`) }} />
                </g>
                {p.length && waiting(c) ? (
                  <g role="button" tabIndex={0} aria-label={`Serve plate ${i + 1}`} onClick={() => hand(i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && hand(i)} style={{ cursor: "pointer", outline: "none" }} transform={`translate(${SPOT_X[i]} 246)`}>
                    <rect x="-32" y="-12" width="64" height="22" rx="11" fill="#1c1416" />
                    <text y="4" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="10.5" fill="#f6efe6">Serve →</text>
                  </g>
                ) : null}
              </g>
            );
          })}

          <g dangerouslySetInnerHTML={{ __html: still.kitchen }} />
          <g dangerouslySetInnerHTML={{ __html: panArt(s.fry.stage, s.fry.t) }} />

          {STATIONS.map(([what, x, y, w, h, label]) => (
            <rect
              key={what}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="12"
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={what === "fry" ? (s.fry.stage === "ready" ? "Dish the dodo" : "Fry dodo") : what === "bin" ? label : `Add ${label}`}
              onClick={() => use(what)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && use(what)}
              style={{ cursor: "pointer", outline: "none" }}
              className="hover:fill-[rgba(255,255,255,.12)] focus-visible:fill-[rgba(233,177,60,.18)]"
            />
          ))}

          {pops.map((p) => {
            const age = s.time - p.at;
            if (age > 1.4) return null;
            return (
              <g key={p.id} transform={`translate(${p.x} ${p.y - age * 24})`} opacity={1 - age / 1.4}>
                <rect x={-p.text.length * 4.2 - 8} y="-14" width={p.text.length * 8.4 + 16} height="22" rx="11" fill="#fff" stroke={p.color} strokeWidth="1.5" />
                <text y="2" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="900" fontSize="12.5" fill={p.color}>
                  {p.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p data-tour="mama-plates" className="mt-3 text-center text-[0.82rem] text-muted">Tap a plate, then tap the food to dish it. Serve it to the person in front. Fry dodo before you need it.</p>
    </div>
  );
}
