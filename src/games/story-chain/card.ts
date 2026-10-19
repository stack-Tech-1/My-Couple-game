"use client";

import { APP_NAME } from "@/lib/config";

/** Draws a finished story as a 1080×1350 card (Instagram portrait) and returns a PNG blob. */
export async function renderStoryCard(opts: { title: string; opener: string; lines: { text: string; mine: boolean }[]; names: [string, string] }): Promise<Blob> {
  await document.fonts.ready;
  const css = getComputedStyle(document.documentElement);
  const serif = css.getPropertyValue("--font-fraunces").trim() || "Georgia, serif";
  const sans = css.getPropertyValue("--font-manrope").trim() || "system-ui, sans-serif";

  const W = 1080;
  const H = 1350;
  const pad = 96;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  c.fillStyle = "#f6efe6";
  c.fillRect(0, 0, W, H);
  c.strokeStyle = "#1c1416";
  c.lineWidth = 3;
  c.strokeRect(40, 40, W - 80, H - 80);

  const wrap = (text: string, font: string, maxW: number): string[] => {
    c.font = font;
    const words = text.split(/\s+/);
    const out: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (c.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
    return out;
  };

  let y = pad + 40;
  c.fillStyle = "#b5371d";
  c.font = `700 26px ${sans}`;
  c.fillText("A STORY BY TWO", pad, y);
  y += 96;

  c.fillStyle = "#1c1416";
  for (const l of wrap(opts.title, `500 76px ${serif}`, W - pad * 2)) {
    c.fillText(l, pad, y);
    y += 82;
  }
  y += 24;

  // Body: shrink the type until the whole story fits.
  const all = [{ text: opts.opener, mine: null as boolean | null }, ...opts.lines];
  let size = 38;
  let laid: { lines: string[]; mine: boolean | null }[] = [];
  for (; size >= 22; size -= 2) {
    laid = all.map((p) => ({ lines: wrap(p.text, `400 ${size}px ${serif}`, W - pad * 2 - 24), mine: p.mine }));
    const h = laid.reduce((a, p) => a + p.lines.length * size * 1.35 + size * 0.6, 0);
    if (y + h < H - pad - 80) break;
  }
  for (const p of laid) {
    c.fillStyle = p.mine === null ? "#57474a" : p.mine ? "#1c1416" : "#5b1a2b";
    c.font = `${p.mine === null ? "italic " : ""}400 ${size}px ${serif}`;
    if (p.mine !== null) {
      c.fillStyle = p.mine ? "#e8563a" : "#5b1a2b";
      c.fillRect(pad, y - size * 0.8, 6, p.lines.length * size * 1.35 - size * 0.3);
      c.fillStyle = p.mine ? "#1c1416" : "#5b1a2b";
    }
    for (const l of p.lines) {
      c.fillText(l, pad + 24, y);
      y += size * 1.35;
    }
    y += size * 0.6;
  }

  c.fillStyle = "#57474a";
  c.font = `italic 400 ${size}px ${serif}`;
  c.fillText("The End.", pad + 24, y + size * 0.4);

  c.fillStyle = "#57474a";
  c.font = `600 26px ${sans}`;
  c.fillText(`${opts.names[0]} & ${opts.names[1]}`, pad, H - pad + 10);
  c.textAlign = "right";
  c.fillText(APP_NAME.toLowerCase(), W - pad, H - pad + 10);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png"));
}