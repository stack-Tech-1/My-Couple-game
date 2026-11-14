"use client";

import { POSTER_H, POSTER_W, posterSvg, type PosterData, type PosterStyle } from "@/lib/poster/styles";

/**
 * Turns a poster SVG into a PNG on the phone. The fonts are embedded in the SVG (an SVG drawn as
 * an image can't fetch anything), and a chosen photo is shrunk first, so nothing is uploaded.
 */
const FONTS: [family: string, file: string, weight: number, style: "normal" | "italic"][] = [
  ["Alfa Slab One", "alfa-slab-one", 400, "normal"],
  ["Bungee", "bungee", 400, "normal"],
  ["Anton", "anton", 400, "normal"],
  ["Pinyon Script", "pinyon-script", 400, "normal"],
  ["Playfair Display", "playfair-700", 700, "normal"],
  ["Playfair Display", "playfair-600i", 600, "italic"],
  ["Caveat", "caveat-600", 600, "normal"],
  ["Fraunces", "fraunces-800", 800, "normal"],
  ["Manrope", "manrope-700", 700, "normal"],
  ["Manrope", "manrope-800", 800, "normal"],
];

let fontCss: Promise<string> | null = null;
function toBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
/** @font-face rules with the fonts inlined, loaded once per visit. */
export function posterFonts(): Promise<string> {
  return (fontCss ??= Promise.all(
    FONTS.map(async ([family, file, weight, style]) => {
      const res = await fetch(`/fonts/poster/${file}.woff2`);
      if (!res.ok) return "";
      return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${toBase64(await res.arrayBuffer())}) format("woff2");}`;
    }),
  ).then((rules) => rules.join("")));
}

/** The SVG with its fonts, ready to show or draw. */
export async function posterMarkup(style: PosterStyle, d: PosterData): Promise<string> {
  const css = await posterFonts();
  return posterSvg(style, d).replace("<defs>", `<defs><style>${css}</style>`);
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The poster didn't draw."));
    img.src = src;
  });

/** The poster as a PNG. */
export async function renderPoster(style: PosterStyle, d: PosterData): Promise<Blob> {
  const svg = await posterMarkup(style, d);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImg(url);
    // Safari sometimes draws embedded fonts a beat late: give it a moment.
    await new Promise((r) => setTimeout(r, 60));
    const canvas = document.createElement("canvas");
    canvas.width = POSTER_W;
    canvas.height = POSTER_H;
    canvas.getContext("2d")!.drawImage(img, 0, 0, POSTER_W, POSTER_H);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The poster didn't draw."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A photo from the phone, shrunk and turned into a data URL for the poster. Never uploaded. */
export async function photoForPoster(file: File, max = 1400): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
