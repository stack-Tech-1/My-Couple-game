import { AVATAR_MOTIFS, type AvatarMotif } from "@/design/Avatar";

/**
 * Share posters in four styles, each drawn as an SVG (1080 by 1920, WhatsApp Status size) and
 * turned into a picture on the phone. Pure: the same data always gives the same poster.
 *
 *  - danfo: hand-painted bus lettering, yellow and black, a red banner, a saying.
 *  - studio: the old painted-backdrop photo studio, or the couple's own photo in the mount.
 *  - owambe: an invitation card, gold on emerald, for big moments.
 *  - nollywood: a film poster for the rivalry, with the stats as credits.
 */
export const POSTER_W = 1080;
export const POSTER_H = 1920;
export const POSTER_STYLES = ["danfo", "studio", "owambe", "nollywood"] as const;
export type PosterStyle = (typeof POSTER_STYLES)[number];
export const STYLE_NAMES: Record<PosterStyle, string> = { danfo: "Danfo", studio: "Studio", owambe: "Owambe", nollywood: "Nollywood" };

export type PosterFace = { name: string; motif: string; hue: number };
export type PosterStat = { value: string; label: string };
export type PosterData = {
  /** One person (Solo, friend rooms) or two (a couple). */
  people: PosterFace[];
  /** "Level 6" and "Soulmates", or a score headline for Solo. */
  level: { number: number; name: string } | null;
  /** The big moment in a few words when there's no level: "New best: 2,400 points". */
  headline: string | null;
  /** Up to three numbers. */
  stats: PosterStat[];
  /** A rivalry: what is counted ("Wins") and the two scores, in the order of `people`. */
  rivalry: { label: string; scores: [number, number] } | null;
  /** The game this is about (Solo) or the one they play most. */
  game: string | null;
  year: number;
  /** A photo the person chose (data URL). Studio only; never leaves the phone. */
  photo: string | null;
  /** Varies the sayings and quotes between people, but not between renders. */
  seed: string;
};

// ---- helpers ------------------------------------------------------------------------------------

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Rough width of `text` at `size` in a font whose average letter is `factor` of the size. */
const widthOf = (text: string, size: number, factor: number) => [...text].length * size * factor;
/** The biggest size, up to `size`, at which `text` fits in `max` pixels. */
export const fitSize = (text: string, size: number, max: number, factor: number) => Math.max(18, Math.min(size, Math.floor(max / Math.max(1, [...text].length * factor))));

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pickFrom = <T,>(xs: readonly T[], seed: string) => xs[hash(seed) % xs.length]!;

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

const first = (d: PosterData) => d.people[0]?.name ?? "Me";
const second = (d: PosterData) => d.people[1]?.name ?? null;
/** "Ada & Tobi", or just "Ada". */
export const namesOf = (d: PosterData, join = " & ") => (second(d) ? `${first(d)}${join}${second(d)}` : first(d));
const levelLine = (d: PosterData) => (d.level ? `Level ${d.level.number}: ${d.level.name}` : (d.headline ?? "On Amah"));

/** An Amah avatar as SVG: tinted disc, outline, the person's motif. */
export function avatarSvg(p: PosterFace, cx: number, cy: number, r: number, ring?: { color: string; width: number }): string {
  const path = AVATAR_MOTIFS[(p.motif in AVATAR_MOTIFS ? p.motif : "fig") as AvatarMotif];
  const s = (r * 1.16) / 24;
  return `<g>
    ${ring ? `<circle cx="${cx}" cy="${cy}" r="${r + ring.width / 2}" fill="${ring.color}"/>` : ""}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${p.hue} 52% 86%)" stroke="hsl(${p.hue} 40% 28%)" stroke-width="${Math.max(3, r * 0.03)}"/>
    <g transform="translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})"><path d="${path}" fill="none" stroke="hsl(${p.hue} 45% 24%)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>
  </g>`;
}

const svgOpen = (bg: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${POSTER_W}" height="${POSTER_H}" viewBox="0 0 ${POSTER_W} ${POSTER_H}"><defs>${defs}</defs><rect width="${POSTER_W}" height="${POSTER_H}" fill="${bg}"/>`;

const text = (x: number, y: number, s: string, attrs: string) => `<text x="${x}" y="${y}" ${attrs}>${esc(s)}</text>`;

// ---- danfo --------------------------------------------------------------------------------------

const SAYINGS = ["No shaking", "Love na teamwork", "We move", "Enjoy your life", "God's time is the best", "No food for lazy man", "Slow and steady", "Who no play no win"];

function danfo(d: PosterData): string {
  const Y = "#f7c600";
  const K = "#111111";
  const R = "#d6261d";
  const saying = pickFrom(SAYINGS, d.seed);
  const top = pickFrom(["OSHODI", "OBALENDE", "YABA", "OJUELEGBA", "CMS", "IKEJA"], d.seed + "a");
  const out: string[] = [svgOpen(Y)];
  // Black bands with the route, like the side of the bus.
  out.push(`<rect y="0" width="1080" height="96" fill="${K}"/><rect y="118" width="1080" height="26" fill="${K}"/>`);
  out.push(text(540, 66, `${top}  ·  AMAH  ·  ${top === "CMS" ? "YABA" : "CMS"}`, `text-anchor="middle" font-family="Bungee" font-size="44" letter-spacing="6" fill="${Y}"`));
  out.push(text(540, 250, saying.toUpperCase(), `text-anchor="middle" font-family="Bungee" font-size="${fitSize(saying, 52, 900, 0.72)}" letter-spacing="3" fill="${K}"`));
  // The names, painted big with a red drop shadow.
  const names = d.people.map((p) => p.name.toUpperCase());
  const lines = names.length === 2 ? [names[0]!, "&", names[1]!] : [names[0]!];
  let y = names.length === 2 ? 440 : 760;
  for (const line of lines) {
    const amp = line === "&";
    const size = amp ? 150 : fitSize(line, 220, 940, 0.78);
    for (const [dx, fill] of [[8, R], [0, K]] as const) out.push(text(540 + dx, y + dx, line, `text-anchor="middle" font-family="Alfa Slab One" font-size="${size}" fill="${fill}"`));
    y += amp ? 190 : size * 0.95;
  }
  // The red banner.
  const banner = levelLine(d).toUpperCase();
  out.push(`<g transform="rotate(-3 540 1010)"><rect x="90" y="925" width="900" height="150" fill="${K}"/><rect x="78" y="913" width="900" height="150" fill="${R}" stroke="${K}" stroke-width="8"/>`);
  out.push(text(528, 1010, banner, `text-anchor="middle" dominant-baseline="middle" font-family="Alfa Slab One" font-size="${fitSize(banner, 64, 820, 0.62)}" fill="#fff7d0"`) + "</g>");
  // Stat panels.
  const stats = d.stats.slice(0, 2);
  stats.forEach((s, i) => {
    const x = 70 + i * 480;
    out.push(`<rect x="${x}" y="1140" width="${stats.length === 1 ? 940 : 460}" height="230" rx="24" fill="${K}"/>`);
    out.push(text(x + 36, 1270, s.value, `font-family="Bungee" font-size="${fitSize(s.value, 120, 390, 0.78)}" fill="${Y}"`));
    out.push(text(x + 36, 1335, s.label.toUpperCase(), `font-family="Bungee" font-size="${fitSize(s.label, 34, 390, 0.7)}" fill="#ffffff"`));
  });
  if (d.rivalry && d.people.length === 2) {
    const [a, b] = d.rivalry.scores;
    const lead = a === b ? "LEVEL" : `${(a > b ? names[0] : names[1])!.slice(0, 10)} LEADS`;
    out.push(`<rect x="70" y="1395" width="940" height="160" rx="24" fill="${K}"/>`);
    out.push(text(110, 1490, d.rivalry.label.toUpperCase().slice(0, 12), `font-family="Bungee" font-size="${fitSize(d.rivalry.label, 40, 260, 0.75)}" fill="#ffffff"`));
    out.push(text(540, 1515, `${a} : ${b}`, `text-anchor="middle" font-family="Bungee" font-size="100" fill="${Y}"`));
    out.push(text(980, 1490, lead, `text-anchor="end" font-family="Bungee" font-size="${fitSize(lead, 30, 250, 0.7)}" fill="#ffffff"`));
  }
  out.push(text(540, 1660, `"${pickFrom(SAYINGS.filter((s) => s !== saying), d.seed + "b")}"`, `text-anchor="middle" font-family="Alfa Slab One" font-size="54" fill="${K}"`));
  // Number plate.
  out.push(`<rect x="190" y="1730" width="700" height="110" rx="16" fill="#ffffff" stroke="${K}" stroke-width="6"/>`);
  out.push(text(225, 1778, "LAGOS", `font-family="Bungee" font-size="24" fill="#0a7a3c"`) + text(225, 1808, "AMAH", `font-family="Bungee" font-size="24" fill="#0a7a3c"`));
  out.push(text(860, 1804, "PLAYAMAH.APP", `text-anchor="end" font-family="Bungee" font-size="46" letter-spacing="2" fill="${K}"`));
  for (const [cx, cy] of [[34, 170], [1046, 170], [34, 1886], [1046, 1886]] as const) out.push(`<circle cx="${cx}" cy="${cy}" r="13" fill="#555"/><circle cx="${cx - 4}" cy="${cy - 4}" r="4" fill="#ddd"/>`);
  out.push("</svg>");
  return out.join("");
}

// ---- studio -------------------------------------------------------------------------------------

function studioScene(): string {
  return `
  <rect width="860" height="1300" fill="url(#sky)"/>
  <circle cx="660" cy="230" r="86" fill="url(#sun)"/>
  <g fill="#fff" opacity=".9"><ellipse cx="200" cy="190" rx="110" ry="34"/><ellipse cx="270" cy="170" rx="80" ry="40"/><ellipse cx="560" cy="400" rx="90" ry="26"/></g>
  <g transform="translate(400 300) rotate(-8)"><path d="M0 0 L120 -8 L140 0 L120 8 Z" fill="#f4f4f4" stroke="#55606a" stroke-width="3"/><path d="M50 -4 L30 -50 L70 -4 Z M50 4 L30 50 L70 4Z" fill="#dfe6ea" stroke="#55606a" stroke-width="3"/><path d="M8 -2 L-6 -26 L14 -2Z" fill="#c33"/></g>
  <g transform="translate(470 520)">
    <rect x="0" y="80" width="330" height="260" fill="#fbf3e2" stroke="#8c6a45" stroke-width="4"/>
    <path d="M-20 90 L165 -10 L350 90 Z" fill="#c7553a" stroke="#7a3221" stroke-width="4"/>
    <rect x="30" y="130" width="70" height="80" fill="#7fb7d6" stroke="#8c6a45" stroke-width="4"/><rect x="230" y="130" width="70" height="80" fill="#7fb7d6" stroke="#8c6a45" stroke-width="4"/>
    <rect x="135" y="230" width="60" height="110" fill="#8a5a33"/>
  </g>
  <g stroke="#6b4423" stroke-width="16" fill="none" stroke-linecap="round"><path d="M120 880 Q140 680 110 540"/><path d="M780 900 Q760 740 800 620"/></g>
  <g fill="#2f8a4a"><path d="M110 540 q-90 -10 -150 40 q80 -20 150 -40z"/><path d="M110 540 q80 -60 170 -30 q-90 0 -170 30z"/><path d="M110 540 q-30 -80 -110 -100 q60 40 110 100z"/><path d="M110 540 q40 -90 130 -110 q-80 50 -130 110z"/>
  <path d="M800 620 q-90 -10 -150 40 q80 -20 150 -40z"/><path d="M800 620 q80 -60 160 -30 q-90 0 -160 30z"/><path d="M800 620 q-30 -80 -110 -100 q60 40 110 100z"/></g>
  <path d="M0 920 L860 920 L860 1300 L0 1300Z" fill="url(#floor)"/>
  <g stroke="#a8693a" stroke-width="3" opacity=".6"><path d="M0 1000 L860 1000 M0 1100 L860 1100 M0 1210 L860 1210"/><path d="M430 920 L200 1300 M430 920 L660 1300 M430 920 L430 1300"/></g>
  <path d="M0 0 L120 0 Q90 460 140 920 L0 920Z" fill="#7a1f2b" opacity=".92"/><path d="M860 0 L740 0 Q770 460 720 920 L860 920Z" fill="#7a1f2b" opacity=".92"/>`;
}

function studio(d: PosterData): string {
  const defs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb6d9"/><stop offset=".55" stop-color="#bfe2ea"/><stop offset=".56" stop-color="#f3d9a0"/><stop offset="1" stop-color="#e9b977"/></linearGradient>
    <radialGradient id="sun"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffd66b"/></radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2834a"/><stop offset="1" stop-color="#7d4b25"/></linearGradient>
    <radialGradient id="vignette" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".55"/></radialGradient>
    <clipPath id="photo"><rect x="110" y="110" width="860" height="1300"/></clipPath>`;
  const out: string[] = [svgOpen("#efe3c8", defs)];
  // The mount and its shadow.
  out.push(`<rect x="70" y="82" width="940" height="1380" fill="#d8c8a8"/><rect x="60" y="60" width="960" height="1390" fill="#fffaf0"/>`);
  out.push(`<g clip-path="url(#photo)">`);
  if (d.photo) {
    // Their own photo, warmed up like an old studio print.
    out.push(`<image href="${esc(d.photo)}" x="110" y="110" width="860" height="1300" preserveAspectRatio="xMidYMid slice"/>`);
    out.push(`<rect x="110" y="110" width="860" height="1300" fill="#e8b46a" opacity=".12"/><rect x="110" y="110" width="860" height="1300" fill="url(#vignette)"/>`);
  } else {
    out.push(`<g transform="translate(110 110)">${studioScene()}`);
    // The two of them stand in front of the painting.
    if (d.people.length === 2) out.push(avatarSvg(d.people[0]!, 270, 960, 130, { color: "#fffaf0", width: 16 }) + avatarSvg(d.people[1]!, 590, 985, 130, { color: "#fffaf0", width: 16 }));
    else out.push(avatarSvg(d.people[0]!, 430, 975, 150, { color: "#fffaf0", width: 16 }));
    out.push("</g>");
  }
  out.push("</g>");
  // The caption card on the photo.
  const label = levelLine(d);
  const sub = d.stats[0] ? `${d.stats[0].value} ${d.stats[0].label}` : "";
  out.push(`<rect x="250" y="1250" width="580" height="${sub ? 130 : 96}" rx="20" fill="#fffaf0" opacity=".94"/>`);
  out.push(text(540, 1308, label, `text-anchor="middle" font-family="Fraunces" font-weight="800" font-size="${fitSize(label, 54, 540, 0.56)}" fill="#3a2a1e"`));
  if (sub) out.push(text(540, 1356, sub, `text-anchor="middle" font-family="Manrope" font-weight="800" font-size="${fitSize(sub, 34, 520, 0.58)}" fill="#7a1f2b"`));
  // Handwritten caption and the studio stamp.
  const caption = `${namesOf(d)}, Lagos, ${d.year}`;
  out.push(text(540, 1600, caption, `text-anchor="middle" font-family="Caveat" font-weight="600" font-size="${fitSize(caption, 86, 900, 0.42)}" fill="#3a2a1e"`));
  out.push(`<g transform="translate(200 1760) rotate(-12)"><circle r="100" fill="none" stroke="#7a1f2b" stroke-width="6"/><circle r="84" fill="none" stroke="#7a1f2b" stroke-width="2"/>`);
  out.push(text(0, -18, "STUDIO", `text-anchor="middle" font-family="Manrope" font-weight="800" font-size="30" fill="#7a1f2b"`) + text(0, 18, "AMAH", `text-anchor="middle" font-family="Manrope" font-weight="800" font-size="36" fill="#7a1f2b"`) + text(0, 50, `EST. ${d.year}`, `text-anchor="middle" font-family="Manrope" font-weight="700" font-size="18" fill="#7a1f2b"`) + "</g>");
  const more = d.stats.slice(1, 3).map((s) => `${s.value} ${s.label}`);
  more.forEach((m, i) => out.push(text(990, 1730 + i * 44, m, `text-anchor="end" font-family="Manrope" font-weight="800" font-size="${fitSize(m, 32, 600, 0.58)}" fill="#3a2a1e"`)));
  out.push(text(990, 1730 + more.length * 44 + 6, "playamah.app", `text-anchor="end" font-family="Manrope" font-weight="800" font-size="32" fill="#7a1f2b"`));
  out.push("</svg>");
  return out.join("");
}

// ---- owambe -------------------------------------------------------------------------------------

const GOLD = `<linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a6b1f"/><stop offset=".28" stop-color="#f9e08a"/><stop offset=".5" stop-color="#c9952e"/><stop offset=".68" stop-color="#fff1b8"/><stop offset="1" stop-color="#a8761f"/></linearGradient>`;

function owambe(d: PosterData): string {
  const defs = `${GOLD}<radialGradient id="em" cx=".5" cy="0" r="1.1"><stop offset="0" stop-color="#0f6b52"/><stop offset=".55" stop-color="#06402f"/><stop offset="1" stop-color="#032a1f"/></radialGradient>`;
  const out: string[] = [svgOpen("#06402f", defs), `<rect width="1080" height="1920" fill="url(#em)"/>`];
  out.push(`<rect x="44" y="44" width="992" height="1832" rx="30" fill="none" stroke="#d6ad55" stroke-width="6"/><rect x="66" y="66" width="948" height="1788" rx="22" fill="none" stroke="#d6ad55" stroke-opacity=".6" stroke-width="2"/>`);
  out.push(`<g transform="translate(330 110)"><path d="M10 60 Q110 0 210 60 Q310 120 410 60" stroke="url(#gold)" stroke-width="5" fill="none"/><path d="M10 60 Q110 120 210 60 Q310 0 410 60" stroke="url(#gold)" stroke-width="5" fill="none"/><circle cx="210" cy="60" r="16" fill="url(#gold)"/></g>`);
  const two = d.people.length === 2;
  out.push(text(540, 330, two ? "The families of" : "The family of", `text-anchor="middle" font-family="Playfair Display" font-style="italic" font-weight="600" font-size="52" fill="#e8d39b"`));
  const names = namesOf(d);
  out.push(text(540, 540, names, `text-anchor="middle" font-family="Pinyon Script" font-size="${fitSize(names, 190, 900, 0.42)}" fill="url(#gold)"`));
  const announce = d.level ? (two ? "joyfully announce that they have reached" : "joyfully announces reaching") : two ? "joyfully announce" : "joyfully announces";
  out.push(text(540, 740, announce, `text-anchor="middle" font-family="Playfair Display" font-style="italic" font-weight="600" font-size="${fitSize(announce, 50, 900, 0.46)}" fill="#e8d39b"`));
  const big = d.level ? `LEVEL ${numberWord(d.level.number).toUpperCase()}` : (d.headline ?? "A NEW BEST").toUpperCase();
  out.push(text(540, 930, big, `text-anchor="middle" font-family="Playfair Display" font-weight="700" font-size="${fitSize(big, 150, 900, 0.68)}" letter-spacing="6" fill="url(#gold)"`));
  if (d.level) {
    const nm = d.level.name.toUpperCase();
    const w = Math.min(860, widthOf(nm, 52, 0.95) + 110);
    out.push(`<rect x="${540 - w / 2}" y="985" width="${w}" height="96" rx="48" fill="url(#gold)"/>`);
    out.push(text(540, 1050, nm, `text-anchor="middle" font-family="Manrope" font-weight="800" font-size="${fitSize(nm, 52, w - 80, 0.95)}" letter-spacing="10" fill="#062e22"`));
  }
  out.push(`<line x1="140" y1="1170" x2="940" y2="1170" stroke="#d6ad55" stroke-opacity=".55" stroke-width="3"/>`);
  out.push(text(540, 1250, "Order of events", `text-anchor="middle" font-family="Playfair Display" font-style="italic" font-weight="600" font-size="44" fill="#e8d39b"`));
  const events = [...d.stats.map((s) => `${s.value} ${s.label}`), ...(d.rivalry && d.people.length === 2 ? [`${d.rivalry.label}: ${d.people[0]!.name} ${d.rivalry.scores[0]}, ${d.people[1]!.name} ${d.rivalry.scores[1]}`] : [])].slice(0, 4);
  events.forEach((e, i) => out.push(text(540, 1340 + i * 68, e, `text-anchor="middle" font-family="Manrope" font-weight="700" font-size="${fitSize(e, 40, 820, 0.55)}" fill="#f4e2b0"`)));
  out.push(text(540, 1700, pickFrom(["Aso-ebi optional. Jollof plenty.", "Small chops will be served.", "Dress code: your best agbada.", "Spraying is allowed."], d.seed), `text-anchor="middle" font-family="Playfair Display" font-style="italic" font-weight="600" font-size="40" fill="#cdb57a"`));
  out.push(text(540, 1800, "PLAYAMAH.APP", `text-anchor="middle" font-family="Manrope" font-weight="800" font-size="40" letter-spacing="6" fill="url(#gold)"`));
  out.push("</svg>");
  return out.join("");
}

// ---- nollywood ----------------------------------------------------------------------------------

const FILM_TITLES: Record<string, string> = {
  Whot: "Whot Wahala",
  Ludo: "Ludo Loyalty",
  Ayo: "Ayo Assassins",
  Chess: "Checkmate in Ikeja",
  Draughts: "King Me, Lagos",
  "Connect Four": "Four Corners",
  "X and O": "X Marks the Heart",
  "Box Am": "Box Am Gidigba",
  "Naija Landlord": "Landlord of Lekki",
  "Spell Am": "Spell Am Well",
  "Word Duel": "Word of Honour",
  "Mama Put": "Mama Put Millionaire",
  "Okada Rush": "Okada Rush Hour",
  "Pump Am": "Pump Am Again",
  "Bash Am": "Bash Am Boys",
  "Catch Am": "Catch Me If You Can",
  "Mosquito Wahala": "Night of the Mosquito",
  "Zobo Sort": "The Zobo Code",
};
export const filmTitle = (game: string | null) => (game ? (FILM_TITLES[game] ?? `${game} Palava`) : "Love and Wahala");
const QUOTES = ["Them no dey gree each other.", "I laughed, I cried, I asked for a rematch.", "Two people. One phone. No peace.", "The rivalry of the year.", "Better than my landlord's generator."];
const BY = ["THE WHOLE COMPOUND", "THEIR GROUP CHAT", "THE NEIGHBOURS", "MAMA PUT CUSTOMERS", "EVERY AUNTY AT THE PARTY"];

function nollywood(d: PosterData): string {
  const defs = `<radialGradient id="glow" cx=".5" cy=".34" r=".7"><stop offset="0" stop-color="#c2321f"/><stop offset=".45" stop-color="#5a1210"/><stop offset=".8" stop-color="#120708"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120708" stop-opacity="0"/><stop offset="1" stop-color="#120708"/></linearGradient>`;
  const out: string[] = [svgOpen("#120708", defs), `<rect width="1080" height="1920" fill="url(#glow)"/>`];
  out.push(text(540, 130, "★★★★★", `text-anchor="middle" font-family="Anton" font-size="46" letter-spacing="12" fill="#f2c94c"`));
  const starring = `${namesOf(d, " & ").toUpperCase()} IN`;
  out.push(text(540, 200, starring, `text-anchor="middle" font-family="Anton" font-size="${fitSize(starring, 42, 900, 0.5)}" letter-spacing="8" fill="#e9d7c9"`));
  // The stars of the film.
  if (d.photo) {
    out.push(`<clipPath id="ph"><circle cx="540" cy="620" r="330"/></clipPath><image href="${esc(d.photo)}" x="210" y="290" width="660" height="660" preserveAspectRatio="xMidYMid slice" clip-path="url(#ph)"/>`);
  } else if (d.people.length === 2) {
    out.push(avatarSvg(d.people[0]!, 390, 620, 250) + avatarSvg(d.people[1]!, 700, 660, 250, { color: "#120708", width: 36 }));
  } else out.push(avatarSvg(d.people[0]!, 540, 640, 290));
  out.push(`<rect x="0" y="880" width="1080" height="200" fill="url(#fade)"/>`);
  const title = filmTitle(d.game).toUpperCase();
  const words = title.split(" ");
  const split = words.length >= 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [title];
  split.forEach((line, i) => {
    const size = fitSize(line, 230, 980, 0.46);
    for (const [dy, fill] of [[8, "#c2321f"], [0, "#fff2e6"]] as const) out.push(text(540, 1180 + i * 210 + dy, line, `text-anchor="middle" font-family="Anton" font-size="${size}" fill="${fill}"`));
  });
  const qy = split.length === 2 ? 1520 : 1340;
  out.push(text(540, qy, `"${pickFrom(QUOTES, d.seed)}"`, `text-anchor="middle" font-family="Playfair Display" font-style="italic" font-weight="600" font-size="44" fill="#f2c94c"`));
  out.push(text(540, qy + 64, pickFrom(BY, d.seed + "q"), `text-anchor="middle" font-family="Anton" font-size="28" letter-spacing="6" fill="#b79c8f"`));
  // The credits block: the stats, in tiny condensed caps.
  const credits = [
    ["STARRING", namesOf(d, " AND ").toUpperCase()],
    ...(d.level ? [["LEVEL", `${d.level.number} ${d.level.name.toUpperCase()}`]] : d.headline && !d.stats.length ? [["FEATURING", d.headline.toUpperCase()]] : []),
    ...d.stats.slice(0, 3).map((s) => [s.value, s.label.toUpperCase()]),
    ...(d.rivalry ? [["SCORE", `${d.rivalry.scores[0]} TO ${d.rivalry.scores[1]}`]] : []),
  ];
  const line1 = credits.slice(0, 3).map(([k, v]) => `${k} ${v}`).join("  /  ");
  const line2 = credits.slice(3).map(([k, v]) => `${k} ${v}`).join("  /  ");
  out.push(text(540, qy + 160, line1, `text-anchor="middle" font-family="Anton" font-size="${fitSize(line1, 32, 920, 0.42)}" letter-spacing="2" fill="#e9d7c9"`));
  if (line2) out.push(text(540, qy + 206, line2, `text-anchor="middle" font-family="Anton" font-size="${fitSize(line2, 32, 920, 0.42)}" letter-spacing="2" fill="#e9d7c9"`));
  out.push(text(540, 1860, "NOW SHOWING ON PLAYAMAH.APP", `text-anchor="middle" font-family="Anton" font-size="44" letter-spacing="10" fill="#f2c94c"`));
  out.push("</svg>");
  return out.join("");
}

export function posterSvg(style: PosterStyle, d: PosterData): string {
  return style === "danfo" ? danfo(d) : style === "studio" ? studio(d) : style === "owambe" ? owambe(d) : nollywood(d);
}

/** The style that suits the moment best, shown first. */
export function defaultStyle(d: PosterData): PosterStyle {
  if (d.photo) return "studio";
  if (d.rivalry) return "nollywood";
  if (d.level && d.people.length === 2) return "owambe";
  return "danfo";
}
