/**
 * Mama Put's drawings, as SVG strings (no user text ever goes in them). Food is scattered with a
 * seeded random, so a plate looks the same every time it's drawn.
 */
import type { Item, Look } from "@/lib/solo/games/mama";

export const STAGE_W = 374;
export const STAGE_H = 690;
export const SPOT_X = [64, 187, 310] as const;
export const PLATE_Y = 278;

let state = 1;
function seed(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  state = (h >>> 0) % 2147483646 || 1;
}
const rnd = () => (state = (state * 16807) % 2147483647) / 2147483647;
const rr = (a: number, b: number) => a + rnd() * (b - a);
const f1 = (n: number) => n.toFixed(1);

// ---------- food ----------
const grains = (cx: number, cy: number, rx: number, ry: number, n: number, cols: string[]) =>
  Array.from({ length: n }, () => {
    const a = rr(0, 6.283), d = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="2.1" ry="1" fill="${cols[Math.floor(rnd() * cols.length)]}" transform="rotate(${rr(0, 180).toFixed(0)} ${f1(x)} ${f1(y)})"/>`;
  }).join("");
export const jollof = (cx: number, cy: number, rx: number, ry: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#mp-jollof)"/>${grains(cx, cy - 1, rx * 0.95, ry * 0.9, Math.round((rx * ry) / 4), ["#f2873a", "#e86a24", "#ffad5c", "#c94d16"])}${Array.from({ length: 4 }, () => `<circle cx="${f1(cx + rr(-rx * 0.6, rx * 0.6))}" cy="${f1(cy + rr(-ry * 0.5, ry * 0.5))}" r="1.4" fill="#2f8a3e"/>`).join("")}<ellipse cx="${cx - rx * 0.3}" cy="${cy - ry * 0.4}" rx="${rx * 0.35}" ry="${ry * 0.25}" fill="rgba(255,240,200,.25)"/>`;
export const whiteRice = (cx: number, cy: number, rx: number, ry: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#efe9de"/>${grains(cx, cy - 1, rx * 0.95, ry * 0.9, Math.round((rx * ry) / 4), ["#ffffff", "#f7f2e8", "#e0d8c8"])}`;
export const stew = (cx: number, cy: number, rx: number, ry: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#mp-stew)"/>${Array.from({ length: 6 }, () => `<ellipse cx="${f1(cx + rr(-rx * 0.7, rx * 0.7))}" cy="${f1(cy + rr(-ry * 0.6, ry * 0.6))}" rx="${f1(rr(2, 5))}" ry="${f1(rr(1, 2))}" fill="rgba(255,170,60,.55)"/>`).join("")}`;
export const egusi = (cx: number, cy: number, rx: number, ry: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#mp-egusi)"/>${Array.from({ length: Math.round((rx * ry) / 9) }, () => `<circle cx="${f1(cx + rr(-rx * 0.8, rx * 0.8))}" cy="${f1(cy + rr(-ry * 0.7, ry * 0.7))}" r="${f1(rr(1.2, 2.6))}" fill="#f0dc96"/>`).join("")}${Array.from({ length: Math.round(rx / 3) }, () => `<path d="M${f1(cx + rr(-rx * 0.7, rx * 0.6))} ${f1(cy + rr(-ry * 0.6, ry * 0.6))} q4 -4 9 -1 q-4 4 -9 1z" fill="#2f6b2d"/>`).join("")}`;
export const meat = (x: number, y: number, s = 1, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" filter="url(#mp-ds)"><path d="M-9 -6 q4 -4 12 -2 q8 2 7 9 q-2 7 -11 6 q-9 -1 -9 -7z" fill="url(#mp-meat)"/><path d="M-6 -3 q5 -2 10 0" stroke="rgba(255,200,150,.6)" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M-4 3 q3 1 7 0" stroke="#5a1a08" stroke-width=".8" fill="none"/></g>`;
export const chicken = (x: number, y: number, s = 1, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" filter="url(#mp-ds)"><path d="M-14 -4 q2 -12 16 -10 q12 2 10 12 q-2 10 -14 9 q-6 0 -8 -4z" fill="url(#mp-chick)"/><rect x="-24" y="-1" width="14" height="5" rx="2.5" fill="#f6e6c8" transform="rotate(-10)"/><circle cx="-24" cy="1" r="3.4" fill="#f6e6c8"/><circle cx="-24" cy="-3" r="3" fill="#f6e6c8"/><path d="M-6 -8 q6 -2 12 1" stroke="rgba(255,230,170,.7)" stroke-width="1.6" fill="none" stroke-linecap="round"/>${Array.from({ length: 5 }, () => `<circle cx="${f1(rr(-8, 8))}" cy="${f1(rr(-6, 4))}" r=".9" fill="#7a2a08"/>`).join("")}</g>`;
export const fish = (x: number, y: number, s = 1, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" filter="url(#mp-ds)"><path d="M-20 0 q10 -10 26 -6 q8 2 10 6 q-2 4 -10 6 q-16 4 -26 -6z" fill="url(#mp-fish)"/><path d="M16 0 l10 -8 v16z" fill="#a8551a"/><circle cx="-13" cy="-1.5" r="2" fill="#fff"/><circle cx="-13" cy="-1.5" r="1" fill="#1c1416"/>${[-4, 2, 8].map((v) => `<path d="M${v} -5 q2 5 0 10" stroke="#7a3510" stroke-width="1" fill="none"/>`).join("")}</g>`;
export const dodo = (x: number, y: number, s = 1, rot = 0, burnt = false) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse cx="0" cy="1.2" rx="9" ry="5.6" fill="${burnt ? "#1c1416" : "#7a3a0a"}"/><ellipse rx="8.6" ry="5.2" fill="${burnt ? "#3a2210" : "url(#mp-dodo)"}"/><ellipse cx="-2" cy="-1.5" rx="4" ry="1.8" fill="${burnt ? "rgba(90,60,30,.6)" : "rgba(255,240,170,.6)"}"/><ellipse cx="3" cy="1.5" rx="2.2" ry="1.4" fill="rgba(140,60,10,.45)"/></g>`;
export const eba = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#mp-ds)"><path d="M-14 6 q-2 -18 14 -20 q16 2 14 20 q-14 5 -28 0z" fill="url(#mp-eba)"/><ellipse cx="-4" cy="-6" rx="5" ry="3" fill="rgba(255,255,255,.45)"/>${Array.from({ length: 10 }, () => `<circle cx="${f1(rr(-10, 10))}" cy="${f1(rr(-10, 4))}" r=".7" fill="rgba(160,120,30,.45)"/>`).join("")}</g>`;
export const moin = (x: number, y: number, s = 1, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" filter="url(#mp-ds)"><path d="M-14 6 l4 -18 h20 l4 18z" fill="url(#mp-leaf)"/><path d="M-10 -12 l-3 18 M-2 -12 v18 M6 -12 l2 18" stroke="rgba(20,60,20,.5)" stroke-width=".8"/><path d="M-9 -12 h18 l-2 6 h-14z" fill="#d9763a"/><path d="M-6 -11 h10" stroke="rgba(255,220,180,.6)" stroke-width="1.2"/></g>`;
export const bottle = (x: number, y: number, s = 1, color = "#c9301c") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-30" width="6" height="7" fill="#ddd" stroke="rgba(0,0,0,.3)"/><path d="M-6 -24 h12 v30 q0 3 -3 3 h-6 q-3 0 -3 -3z" fill="${color}" stroke="rgba(0,0,0,.35)"/><rect x="-4.5" y="-18" width="2.4" height="22" rx="1.2" fill="rgba(255,255,255,.45)"/></g>`;

/** A plate with whatever is on it, arranged the way a buka would dish it. */
export function plateArt(items: readonly Item[], key: string, rx = 40, ry = 15): string {
  seed(key);
  const has = (i: Item) => items.includes(i);
  const k = rx / 40;
  let food = "";
  if (has("jollof")) food += jollof(-6 * k, -1 * k, 24 * k, 9 * k);
  if (has("rice")) food += whiteRice(-6 * k, -1 * k, 22 * k, 8 * k);
  if (has("eba")) food += eba(-10 * k, -2 * k, 1.05 * k);
  if (has("stew")) food += stew(-4 * k, -2 * k, 12 * k, 5 * k);
  if (has("egusi")) food += egusi(6 * k, 0, 14 * k, 6 * k);
  if (has("beef")) food += meat(18 * k, 1 * k, 0.95 * k, -12) + meat(10 * k, 5 * k, 0.75 * k, 20);
  if (has("chicken")) food += chicken(18 * k, 0, 0.8 * k, -15);
  if (has("fish")) food += fish(16 * k, 3 * k, 0.6 * k, 8);
  if (has("dodo")) food += dodo(22 * k, -6 * k, 0.85 * k, 15) + dodo(28 * k, -1 * k, 0.85 * k, -10) + dodo(16 * k, -9 * k, 0.8 * k, 30);
  if (has("moin")) food += moin(-26 * k, 0, 0.75 * k, -8);
  const rim = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * 6.283;
    return `<circle cx="${f1(Math.cos(a) * rx * 0.89)}" cy="${f1(Math.sin(a) * ry * 0.87)}" r="${f1(1.6 * k)}" fill="#3f74d8" opacity=".7"/><circle cx="${f1(Math.cos(a + 0.3) * rx * 0.89)}" cy="${f1(Math.sin(a + 0.3) * ry * 0.87)}" r="${f1(1 * k)}" fill="#e8563a" opacity=".7"/>`;
  }).join("");
  const drink = has("drink") ? bottle(rx + 8 * k, -2 * k, 0.75 * k) : "";
  return `<ellipse cx="2" cy="${ry * 0.45}" rx="${rx + 2}" ry="${ry + 1}" fill="rgba(0,0,0,.22)"/><ellipse rx="${rx}" ry="${ry}" fill="#fdfbf6" stroke="#cfc8bd" stroke-width="1"/><ellipse rx="${rx * 0.78}" ry="${ry * 0.74}" fill="#f4efe6"/>${rim}${food}${drink}`;
}

// ---------- people ----------
const SKIN: [string, string][] = [["#8a5a3c", "#6b4128"], ["#5a3a26", "#3f2818"], ["#a06a46", "#7a4c30"], ["#704630", "#52321f"]];
const CLOTH: [string, string][] = [["#2f6b9a", "ank1"], ["#f6efe6", "ank2"], ["#7a1f6b", "ank3"], ["#2f8a4e", "ank1"], ["#e8563a", "ank2"], ["#e9b13c", "ank3"]];

export function personArt(look: Look, mood: "happy" | "wait" | "angry"): string {
  const [skin, shade] = SKIN[look.skin % SKIN.length]!;
  const [cloth, pat] = CLOTH[look.cloth % CLOTH.length]!;
  const eyes =
    mood === "angry"
      ? `<path d="M-13 -8 l8 3 M13 -8 l-8 3" stroke="#1c1416" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="-8" cy="-1" rx="3.4" ry="3" fill="#fff"/><ellipse cx="8" cy="-1" rx="3.4" ry="3" fill="#fff"/><circle cx="-8" cy="-.5" r="1.8" fill="#1c1416"/><circle cx="8" cy="-.5" r="1.8" fill="#1c1416"/>`
      : `<path d="M-13 -9 q5 -3 9 0 M4 -9 q5 -3 9 0" stroke="#1c1416" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse cx="-8" cy="-1" rx="3.4" ry="3.6" fill="#fff"/><ellipse cx="8" cy="-1" rx="3.4" ry="3.6" fill="#fff"/><circle cx="-7.5" cy="-.5" r="2.1" fill="#2a1a10"/><circle cx="8.5" cy="-.5" r="2.1" fill="#2a1a10"/><circle cx="-7" cy="-1.3" r=".7" fill="#fff"/><circle cx="9" cy="-1.3" r=".7" fill="#fff"/>`;
  const mouth = {
    happy: `<path d="M-7 12 q7 7 14 0 q-7 3 -14 0z" fill="#7a1f1f"/><path d="M-5 12.5 h10" stroke="#fff" stroke-width="1.6"/>`,
    wait: `<path d="M-5 13 q5 1.5 10 0" stroke="#5a2a1a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    angry: `<path d="M-7 15 q7 -6 14 0" stroke="#5a2a1a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  }[mood];
  let back = "", hair = "", extra = "";
  switch (look.style % 4) {
    case 0: // gele
      hair = `<path d="M-25 -6 q-4 -28 25 -30 q30 2 25 30 q-6 -14 -25 -16 q-19 2 -25 16z" fill="${cloth === "#e8563a" ? "#e9b13c" : "#e8563a"}"/><path d="M-25 -6 q-4 -28 25 -30 q30 2 25 30 q-6 -14 -25 -16 q-19 2 -25 16z" fill="url(#mp-ank2)"/><path d="M14 -28 q22 -16 24 6 q-10 -6 -20 2z" fill="${cloth === "#e8563a" ? "#e9b13c" : "#e8563a"}"/><path d="M-30 -20 q-10 4 -6 14 q4 -8 10 -8z" fill="#c43c22"/>`;
      extra = `<circle cx="-23" cy="9" r="2.6" fill="#e9b13c"/><circle cx="23" cy="9" r="2.6" fill="#e9b13c"/>`;
      break;
    case 1: // fila cap
      hair = `<path d="M-23 -10 q0 -22 23 -22 q23 0 23 22 q-2 -6 -10 -9 q-13 -4 -26 0 q-8 3 -10 9z" fill="#1c1416"/>`;
      extra = `<path d="M-25 -10 q0 -24 28 -24 q18 2 22 16 q-1 8 -6 8 h-40z" fill="#3f74d8"/><path d="M-25 -10 q0 -24 28 -24 q18 2 22 16 q-1 8 -6 8 h-40z" fill="url(#mp-ank2)" opacity=".55"/><path d="M-25 -10 h44" stroke="#2a4f9a" stroke-width="3"/>`;
      break;
    case 2: // braids
      back = [-1, 1].map((sd) => Array.from({ length: 5 }, (_, i) => `<path d="M${sd * (16 + i * 2.5)} -14 q${sd * 6} 26 ${sd * (6 + i * 2)} 52" stroke="#2a1a10" stroke-width="3.4" fill="none" stroke-linecap="round"/>`).join("")).join("");
      hair = `<path d="M-25 -2 q-3 -28 25 -30 q28 2 25 30 q-8 -16 -25 -16 q-17 0 -25 16z" fill="#2a1a10"/>`;
      break;
    default: // low cut
      hair = `<path d="M-23 -8 q0 -22 23 -22 q23 0 23 22 q-4 -10 -23 -11 q-19 1 -23 11z" fill="#1c1416"/>`;
  }
  return `<g transform="translate(0 182)">${back}
    <path d="M-46 110 q-2 -50 20 -62 q26 -10 52 0 q22 12 20 62z" fill="${cloth}"/><path d="M-46 110 q-2 -50 20 -62 q26 -10 52 0 q22 12 20 62z" fill="url(#mp-${pat})"/><path d="M-46 110 q-2 -50 20 -62 q26 -10 52 0 q22 12 20 62z" fill="url(#mp-bodyShade)"/>
    <path d="M-12 40 q12 14 24 0 v10 q-12 10 -24 0z" fill="${shade}"/><rect x="-8" y="26" width="16" height="20" rx="6" fill="${skin}"/><rect x="-8" y="26" width="16" height="8" fill="${shade}" opacity=".6"/>
    <ellipse cx="-23" cy="2" rx="5" ry="7" fill="${shade}"/><ellipse cx="23" cy="2" rx="5" ry="7" fill="${shade}"/>
    <ellipse cx="0" cy="0" rx="23" ry="27" fill="${skin}"/><ellipse cx="0" cy="0" rx="23" ry="27" fill="url(#mp-faceShade)"/>
    ${eyes}<path d="M-1 3 q-3 5 0 7 q3 1 5 -1" stroke="${shade}" stroke-width="1.8" fill="none" stroke-linecap="round"/>${mouth}
    <ellipse cx="-14" cy="9" rx="4" ry="2.4" fill="#e8563a" opacity=".18"/><ellipse cx="14" cy="9" rx="4" ry="2.4" fill="#e8563a" opacity=".18"/>
    ${hair}${extra}</g>`;
}

// ---------- the room and kitchen (never changes) ----------
const steam = (x: number, y: number) => `<g class="mp-steam" fill="none" stroke="#fff" stroke-linecap="round">${[-10, 0, 10].map((dx, i) => `<path d="M${x + dx} ${y} q-6 -8 0 -16 q6 -8 0 -16" stroke-width="${3 - i * 0.5}" opacity="${0.55 - i * 0.1}" style="animation-delay:${i * 0.6}s"/>`).join("")}</g>`;
const burner = (x: number, y: number) => `<g transform="translate(${x} ${y})"><ellipse rx="34" ry="11" fill="#2a2a2a"/><ellipse rx="22" ry="7" fill="#444"/><g class="mp-flame">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 6.283; return `<path d="M${f1(Math.cos(a) * 16)} ${f1(Math.sin(a) * 5)} q${f1(Math.cos(a) * 4)} -9 ${f1(Math.cos(a) * 2)} -13" stroke="#5ab0ff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/><path d="M${f1(Math.cos(a) * 16)} ${f1(Math.sin(a) * 5)} q${f1(Math.cos(a) * 2)} -5 ${f1(Math.cos(a) * 1)} -7" stroke="#e9f6ff" stroke-width="1.4" fill="none" stroke-linecap="round"/>`; }).join("")}</g></g>`;
const cooler = (x: number, y: number, w: number, h: number, col: "R" | "B", food: (cx: number, cy: number, rx: number, ry: number) => string, label: string) =>
  `<g transform="translate(${x} ${y})" filter="url(#mp-ds2)"><path d="M0 18 h${w} l-4 ${h} q0 6 -6 6 h${-(w - 20)} q-6 0 -6 -6z" fill="url(#mp-cool${col})"/><path d="M6 30 h${w - 12}" stroke="rgba(255,255,255,.35)" stroke-width="2"/><rect x="${w / 2 - 14}" y="${h * 0.55}" width="28" height="8" rx="4" fill="rgba(0,0,0,.18)"/><ellipse cx="${w / 2}" cy="18" rx="${w / 2}" ry="12" fill="#f4f0e8" stroke="rgba(0,0,0,.25)"/>${food(w / 2, 18, w / 2 - 6, 9)}<path d="M-2 14 q${w / 2} -40 ${w + 4} -10 l-2 -10 q${-w / 2} -30 ${-w} 8z" fill="url(#mp-lid)"/><path d="M8 0 q${w / 2 - 8} -20 ${w - 14} -6" stroke="rgba(255,255,255,.5)" stroke-width="2" fill="none"/><text x="${w / 2}" y="${h + 36}" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="10" fill="#1c1416">${label}</text>${steam(w / 2, -2)}</g>`;

export const DEFS = `
  <filter id="mp-ds" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-opacity=".35"/></filter>
  <filter id="mp-ds2" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="3" flood-opacity=".35"/></filter>
  <linearGradient id="mp-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c77a"/><stop offset="1" stop-color="#e9a94f"/></linearGradient>
  <linearGradient id="mp-counterTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a4a"/><stop offset="1" stop-color="#9c6230"/></linearGradient>
  <linearGradient id="mp-counterFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4518"/><stop offset="1" stop-color="#4f2a0c"/></linearGradient>
  <linearGradient id="mp-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f2f2"/><stop offset=".5" stop-color="#b9bcc0"/><stop offset="1" stop-color="#8a8e94"/></linearGradient>
  <linearGradient id="mp-potSide" x1="0" x2="1"><stop offset="0" stop-color="#6a6e74"/><stop offset=".25" stop-color="#e8eaec"/><stop offset=".55" stop-color="#9da1a6"/><stop offset="1" stop-color="#55595e"/></linearGradient>
  <linearGradient id="mp-pan" x1="0" x2="1"><stop offset="0" stop-color="#1c1c1c"/><stop offset=".4" stop-color="#4a4a4a"/><stop offset="1" stop-color="#151515"/></linearGradient>
  <radialGradient id="mp-oil"><stop offset="0" stop-color="#e9b13c"/><stop offset="1" stop-color="#a8620f"/></radialGradient>
  <radialGradient id="mp-jollof"><stop offset="0" stop-color="#ef7a2c"/><stop offset="1" stop-color="#b8401a"/></radialGradient>
  <radialGradient id="mp-stew"><stop offset="0" stop-color="#d33a1e"/><stop offset="1" stop-color="#8a1a0c"/></radialGradient>
  <radialGradient id="mp-egusi"><stop offset="0" stop-color="#d9b44a"/><stop offset="1" stop-color="#9c7a1f"/></radialGradient>
  <radialGradient id="mp-meat" cx=".35" cy=".3"><stop offset="0" stop-color="#b8401a"/><stop offset=".7" stop-color="#7a2408"/><stop offset="1" stop-color="#4a1404"/></radialGradient>
  <radialGradient id="mp-chick" cx=".35" cy=".3"><stop offset="0" stop-color="#f2a64a"/><stop offset=".6" stop-color="#c9681a"/><stop offset="1" stop-color="#8a3a08"/></radialGradient>
  <linearGradient id="mp-fish" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9893a"/><stop offset="1" stop-color="#8a4a12"/></linearGradient>
  <radialGradient id="mp-dodo" cx=".4" cy=".35"><stop offset="0" stop-color="#ffcf5a"/><stop offset=".6" stop-color="#f09a2a"/><stop offset="1" stop-color="#b85a10"/></radialGradient>
  <radialGradient id="mp-eba" cx=".4" cy=".3"><stop offset="0" stop-color="#fff2b8"/><stop offset=".7" stop-color="#ecd27a"/><stop offset="1" stop-color="#c9a43a"/></radialGradient>
  <linearGradient id="mp-leaf" x1="0" x2="1"><stop offset="0" stop-color="#2f6b2d"/><stop offset=".5" stop-color="#5aa04a"/><stop offset="1" stop-color="#2f6b2d"/></linearGradient>
  <linearGradient id="mp-coolR" x1="0" x2="1"><stop offset="0" stop-color="#a81e1e"/><stop offset=".3" stop-color="#e8443a"/><stop offset="1" stop-color="#8a1414"/></linearGradient>
  <linearGradient id="mp-coolB" x1="0" x2="1"><stop offset="0" stop-color="#1e3f8a"/><stop offset=".3" stop-color="#3f74d8"/><stop offset="1" stop-color="#16306a"/></linearGradient>
  <linearGradient id="mp-lid" x1="0" x2="1"><stop offset="0" stop-color="#f6f2ea"/><stop offset="1" stop-color="#cfc8bd"/></linearGradient>
  <linearGradient id="mp-bodyShade" x1="0" x2="1"><stop offset="0" stop-color="rgba(0,0,0,.25)"/><stop offset=".35" stop-color="rgba(0,0,0,0)"/><stop offset=".75" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.3)"/></linearGradient>
  <radialGradient id="mp-faceShade" cx=".4" cy=".35" r=".75"><stop offset=".7" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.25)"/></radialGradient>
  <linearGradient id="mp-glass" x1="0" x2="1"><stop offset="0" stop-color="rgba(200,235,255,.55)"/><stop offset="1" stop-color="rgba(160,210,240,.3)"/></linearGradient>
  <pattern id="mp-ank1" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="5" fill="none" stroke="#e9b13c" stroke-width="2"/><circle cx="8" cy="8" r="1.8" fill="#e8563a"/><circle cx="0" cy="0" r="2" fill="#f6efe6"/><circle cx="16" cy="16" r="2" fill="#f6efe6"/></pattern>
  <pattern id="mp-ank2" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7 l7 -7 l7 7 l-7 7z" fill="none" stroke="#f6efe6" stroke-width="1.5" opacity=".7"/><circle cx="7" cy="7" r="2" fill="#e9b13c"/></pattern>
  <pattern id="mp-ank3" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 q4.5 -9 9 0 t9 0" fill="none" stroke="#2a1a3a" stroke-width="2"/><circle cx="9" cy="3" r="2" fill="#f6c453"/></pattern>
  <pattern id="mp-tile" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#f4f1ea"/><rect width="21" height="21" fill="#fbfaf6"/><path d="M11 3 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#3f74d8" opacity=".25"/></pattern>
  <pattern id="mp-curtain" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#2f8a4e"/><circle cx="10" cy="10" r="6" fill="#e9b13c"/><circle cx="10" cy="10" r="3" fill="#e8563a"/><circle cx="0" cy="0" r="3" fill="#f6efe6"/><circle cx="20" cy="20" r="3" fill="#f6efe6"/></pattern>`;

export const CSS = `
  .mp-steam path { animation: mp-rise 2.4s ease-in-out infinite; }
  @keyframes mp-rise { 0% { transform: translateY(6px); opacity: 0; } 30% { opacity: .7; } 100% { transform: translateY(-10px); opacity: 0; } }
  .mp-fan { animation: mp-fan .35s linear infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes mp-fan { 0% { transform: scaleX(1); } 50% { transform: scaleX(-1); } 100% { transform: scaleX(1); } }
  .mp-flame { animation: mp-flick .18s ease-in-out infinite alternate; transform-origin: center; }
  @keyframes mp-flick { from { opacity: .8; } to { opacity: 1; } }
  .mp-bubble { animation: mp-pop 1.1s ease-in infinite; }
  @keyframes mp-pop { 0% { opacity: 0; transform: translateY(2px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-3px); } }
  @media (prefers-reduced-motion: reduce) { .mp-steam path, .mp-fan, .mp-flame, .mp-bubble { animation: none; } }`;

/** Everything that stays still: the shop, the counter and the kitchen stations. */
export function backdropArt(): string {
  seed("mama-put-backdrop");
  const W = STAGE_W;
  return `
  <rect width="${W}" height="262" fill="url(#mp-wall)"/>
  <rect y="160" width="${W}" height="102" fill="url(#mp-tile)"/><rect y="158" width="${W}" height="4" fill="#c98a4a"/>
  <g transform="translate(14 8) scale(.62)"><rect width="128" height="80" rx="4" fill="#9fd6f0"/><rect y="50" width="128" height="30" fill="#8a8a8a"/><rect y="56" width="128" height="3" fill="#f6c453" opacity=".8"/>
    <g transform="translate(36 30)"><path d="M0 26 v-16 q0 -8 8 -8 h46 q10 0 12 10 l6 14z" fill="#f2b705" stroke="#1c1416" stroke-width="1.5"/><rect x="5" y="6" width="12" height="9" rx="2" fill="#bfe3ea"/><rect x="20" y="6" width="12" height="9" rx="2" fill="#bfe3ea"/><rect x="35" y="6" width="12" height="9" rx="2" fill="#bfe3ea"/><path d="M0 18 h70" stroke="#1c1416" stroke-width="3"/><circle cx="14" cy="27" r="6" fill="#1c1416"/><circle cx="56" cy="27" r="6" fill="#1c1416"/></g>
    <rect width="128" height="80" rx="4" fill="none" stroke="#7a4518" stroke-width="6"/><path d="M64 0 v80" stroke="#7a4518" stroke-width="4"/>
    <path d="M-6 -6 q16 46 6 94 h-10z" fill="url(#mp-curtain)"/><path d="M134 -6 q-16 46 -6 94 h10z" fill="url(#mp-curtain)"/><rect x="-10" y="-10" width="148" height="7" rx="3" fill="#5a3510"/></g>
  <g transform="translate(160 0)"><rect x="-2" y="0" width="4" height="9" fill="#555"/><g class="mp-fan"><ellipse cx="-30" cy="12" rx="26" ry="3.5" fill="#8a8a8a" opacity=".85"/><ellipse cx="30" cy="12" rx="26" ry="3.5" fill="#8a8a8a" opacity=".55"/></g><ellipse cx="0" cy="11" rx="8" ry="4" fill="#777"/></g>
  <g transform="translate(160 42)"><circle r="12" fill="#fff" stroke="#7a4518" stroke-width="3"/><path d="M0 0 v-8 M0 0 l5 3" stroke="#1c1416" stroke-width="1.6" stroke-linecap="round"/></g>
  <g transform="translate(206 4)"><rect x="0" y="48" width="156" height="7" rx="2" fill="#7a4518"/><rect x="0" y="55" width="156" height="4" fill="rgba(0,0,0,.2)"/>
    ${[0, 1, 2].map((i) => `<g transform="translate(${6 + i * 20} 22)"><rect width="16" height="26" rx="3" fill="${["#e8563a", "#f6efe6", "#3f74d8"][i]}" stroke="#1c1416" stroke-width="1"/><rect y="8" width="16" height="9" fill="${["#f6efe6", "#e9b13c", "#f6efe6"][i]}" opacity=".9"/><rect x="2" width="3" height="26" fill="rgba(255,255,255,.4)"/></g>`).join("")}
    <g transform="translate(70 28)"><rect width="30" height="20" rx="3" fill="#e9b13c" stroke="#1c1416" stroke-width="1"/><rect x="3" y="6" width="24" height="6" fill="#e8563a"/></g>
    <g transform="translate(110 12)"><path d="M4 36 q-4 -28 16 -28 q20 0 16 28z" fill="url(#mp-steel)" stroke="#555" stroke-width="1"/><path d="M34 18 q9 -2 11 -11" stroke="#555" stroke-width="3" fill="none"/><path d="M9 8 q11 -11 22 0" stroke="#1c1416" stroke-width="3" fill="none"/></g></g>`;
}

/** The counter sits in front of the customers. */
export function counterArt(): string {
  const W = STAGE_W;
  return `<path d="M0 262 H${W} V294 H0z" fill="url(#mp-counterTop)"/><path d="M0 262 H${W}" stroke="#e0a868" stroke-width="2"/>
  <rect y="294" width="${W}" height="24" fill="url(#mp-counterFront)"/><text x="${W / 2}" y="311" text-anchor="middle" font-family="Fraunces, serif" font-weight="900" font-size="12" fill="#f6c453" letter-spacing="1.5">MAMA PUT · FOOD IS READY · COME AND CHOP</text>`;
}

/** The kitchen stations (the frying pan is drawn separately, since it changes). */
export function kitchenArt(): string {
  seed("mama-put-kitchen");
  const W = STAGE_W, H = STAGE_H;
  return `
  <rect y="318" width="${W}" height="${H - 318}" fill="url(#mp-tile)"/><rect y="318" width="${W}" height="${H - 318}" fill="rgba(60,30,10,.06)"/>
  <rect y="440" width="${W}" height="12" fill="url(#mp-steel)"/><rect y="${H - 128}" width="${W}" height="12" fill="url(#mp-steel)"/>
  ${cooler(18, 348, 90, 54, "R", jollof, "Jollof")}
  ${cooler(124, 348, 90, 54, "B", whiteRice, "White rice")}
  <g transform="translate(298 404)">${burner(0, 18)}
    <path d="M-40 -46 v40 q0 22 40 22 q40 0 40 -22 v-40z" fill="url(#mp-potSide)" stroke="#444" stroke-width="1.2" filter="url(#mp-ds2)"/>
    <rect x="-54" y="-44" width="16" height="7" rx="3.5" fill="#333"/><rect x="38" y="-44" width="16" height="7" rx="3.5" fill="#333"/>
    <ellipse cx="0" cy="-46" rx="40" ry="11" fill="#5a5e63"/>${stew(0, -46, 36, 9)}${meat(-14, -48, 0.9, 10)}${meat(10, -45, 0.9, -20)}
    <g class="mp-bubble">${Array.from({ length: 6 }, () => `<circle cx="${f1(rr(-28, 28))}" cy="${f1(rr(-52, -42))}" r="${f1(rr(1.2, 2.6))}" fill="none" stroke="rgba(255,160,90,.85)" stroke-width="1"/>`).join("")}</g>
    ${steam(-6, -60)}<text y="34" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="10" fill="#1c1416">Stew</text></g>
  <g transform="translate(212 466)" filter="url(#mp-ds2)"><rect x="-60" y="0" width="120" height="58" rx="8" fill="url(#mp-steel)" stroke="#777"/>
    ${[-40, 0, 40].map((cx) => `<rect x="${cx - 18}" y="5" width="36" height="48" rx="5" fill="#d7d9dc"/>`).join("")}
    ${meat(-44, 18, 1)}${meat(-36, 38, 1, 40)}${chicken(4, 20, 0.85, -20)}${chicken(2, 40, 0.8, 160)}${fish(40, 18, 0.62, 10)}${fish(40, 40, 0.62, -10)}
    <g font-family="Manrope, sans-serif" font-weight="800" font-size="9.5" fill="#1c1416" text-anchor="middle"><text x="-40" y="72">Beef</text><text x="0" y="72">Chicken</text><text x="40" y="72">Fish</text></g></g>
  <g transform="translate(316 486)"><ellipse cx="0" cy="22" rx="42" ry="12" fill="rgba(0,0,0,.2)"/><path d="M-40 4 q0 22 40 22 q40 0 40 -22z" fill="#e8f0f4" stroke="#9fb0bc"/>
    <ellipse cx="0" cy="4" rx="40" ry="9" fill="#f6fafc" stroke="#9fb0bc"/>${eba(-16, 0, 0.9)}${eba(-2, -2, 0.85)}${moin(22, 0, 0.85, 8)}
    <g font-family="Manrope, sans-serif" font-weight="800" font-size="9.5" fill="#1c1416" text-anchor="middle"><text x="-14" y="46">Eba</text><text x="22" y="46">Moin moin</text></g></g>
  <g transform="translate(16 ${H - 112})">
    <rect width="128" height="88" rx="10" fill="#e8f4fa" stroke="#7aa6c0" stroke-width="2"/><rect x="6" y="8" width="116" height="72" rx="6" fill="url(#mp-glass)"/>
    ${[0, 1, 2, 3, 4].map((i) => `<g transform="translate(${18 + i * 22} 22)"><rect x="-5" y="-14" width="10" height="8" fill="#ddd"/><path d="M-8 -6 h16 v44 q0 4 -4 4 h-8 q-4 0 -4 -4z" fill="${["#8f1d40", "#f08a1a", "#2f8a4e", "#c9301c", "#e9dcc0"][i]}" stroke="rgba(0,0,0,.3)"/><rect x="-6" y="0" width="3" height="32" rx="1.5" fill="rgba(255,255,255,.45)"/></g>`).join("")}
    ${Array.from({ length: 9 }, () => `<rect x="${f1(rr(8, 112))}" y="${f1(rr(60, 74))}" width="8" height="7" rx="2" fill="rgba(255,255,255,.75)" transform="rotate(${f1(rr(-20, 20))})"/>`).join("")}
    <text x="64" y="104" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="10" fill="#1c1416">Cold drinks</text></g>
  <g transform="translate(196 ${H - 58})"><path d="M-46 0 v18 q0 18 46 18 q46 0 46 -18 v-18" fill="url(#mp-potSide)" stroke="#444"/><ellipse cx="0" cy="0" rx="46" ry="13" fill="none" stroke="#5a5e63" stroke-width="5"/>${egusi(0, 0, 40, 10)}${steam(0, -14)}<text y="50" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="10" fill="#1c1416">Egusi</text></g>
  <g transform="translate(318 ${H - 66})"><path d="M-24 -18 h48 l-5 46 h-38z" fill="#4a4f55" stroke="#2a2a2a" stroke-width="1.5"/><rect x="-28" y="-24" width="56" height="8" rx="3" fill="#5f656c" stroke="#2a2a2a"/><path d="M-12 -8 v28 M0 -8 v28 M12 -8 v28" stroke="rgba(255,255,255,.18)" stroke-width="2"/><text y="44" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="10" fill="#1c1416">Bin the plate</text></g>`;
}

/** The frying pan, which shows what's happening to the dodo. */
export function panArt(stage: "idle" | "frying" | "ready" | "burnt", t: number): string {
  seed("mama-put-pan-" + stage);
  const slices = stage === "idle" ? "" : [[-22, 0, 20], [-6, -4, -10], [10, 2, 30], [26, -2, -25], [-12, 8, 5], [14, 9, -5]].map(([x, y, r]) => dodo(x!, y!, 1.1, r, stage === "burnt")).join("");
  const sizzle = stage === "frying" || stage === "ready" ? `<g class="mp-bubble">${Array.from({ length: 14 }, () => `<circle cx="${f1(rr(-38, 38))}" cy="${f1(rr(-8, 12))}" r="${f1(rr(0.8, 2))}" fill="none" stroke="rgba(255,250,210,.9)" stroke-width=".8"/>`).join("")}</g>` : "";
  const smoke = stage === "burnt" ? `<g opacity=".7">${[-14, 0, 14].map((dx) => `<path d="M${dx} -8 q-10 -14 0 -28 q10 -14 0 -28" stroke="#555" stroke-width="5" fill="none" stroke-linecap="round" opacity=".5"/>`).join("")}</g>` : "";
  const label = stage === "idle" ? "Tap to fry dodo" : stage === "frying" ? "Frying…" : stage === "ready" ? "Dodo ready: tap to dish" : "Burnt! Tap to fry again";
  const ring = stage === "frying" ? `<g transform="translate(36 -26)"><circle r="12" fill="#fff" stroke="#e9b13c" stroke-width="3"/><path d="M0 0 L${f1(Math.sin(t * 2.094) * 8)} ${f1(-Math.cos(t * 2.094) * 8)}" stroke="#1c1416" stroke-width="1.8" stroke-linecap="round"/></g>` : stage === "ready" ? `<g transform="translate(36 -26)"><circle r="12" fill="#2f8a4e" stroke="#fff" stroke-width="2"/><path d="M-5 0 l3 4 l7 -8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>` : "";
  return `<g transform="translate(70 512)">${burner(0, 22)}<rect x="44" y="-2" width="54" height="9" rx="4.5" fill="#2a2a2a" transform="rotate(-8 44 2)"/>
    <ellipse cx="0" cy="6" rx="52" ry="20" fill="#111" filter="url(#mp-ds2)"/><ellipse cx="0" cy="2" rx="48" ry="17" fill="url(#mp-pan)"/><ellipse cx="0" cy="2" rx="42" ry="14" fill="url(#mp-oil)" opacity="${stage === "idle" ? 0.55 : 0.9}"/>
    ${slices}${sizzle}${smoke}${ring}
    <text y="50" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="9.5" fill="${stage === "burnt" ? "#b8261a" : "#1c1416"}">${label}</text></g>`;
}
