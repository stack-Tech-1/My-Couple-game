"use client";

/**
 * Share posters for Solo scores and challenges, drawn on a canvas on the phone (no server work).
 * 1080×1350, the shape WhatsApp and Instagram show without cropping.
 */
export type PosterInput = {
  gameName: string;
  /** "2,400 points" */
  scoreText: string;
  /** "Ada scored" / "Beat Ada's" */
  headline: string;
  name: string;
  challenge: boolean;
  bg: string;
  ink: string;
  accent: string;
  /** Fix Am: the finished photo, and its credit (shown, as the licence asks). */
  photoUrl?: string;
  credit?: string | null;
};

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The ilu pattern (squares split into light and dark triangles), Solo's own print. */
function ilu(c: CanvasRenderingContext2D, bg: string, ink: string, light: string) {
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  const s = 90;
  for (let y = 0; y < H; y += s)
    for (let x = 0; x < W; x += s) {
      c.fillStyle = ink;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + s / 2, y);
      c.lineTo(x + s / 2, y + s / 2);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(x + s / 2, y + s / 2);
      c.lineTo(x + s, y + s / 2);
      c.lineTo(x + s, y + s);
      c.closePath();
      c.fill();
      c.fillStyle = light;
      c.beginPath();
      c.moveTo(x + s / 2, y);
      c.lineTo(x + s, y + s / 2);
      c.lineTo(x + s / 2, y + s / 2);
      c.closePath();
      c.fill();
    }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** The largest font size (from `size` down) at which `text` fits in `max` pixels. `font` has "SIZE" where the size goes. */
function fit(c: CanvasRenderingContext2D, text: string, max: number, size: number, font: string) {
  let s = size;
  for (; s > 24; s -= 4) {
    c.font = font.replace("SIZE", String(s));
    if (c.measureText(text).width <= max) break;
  }
  return s;
}

export async function makePoster(p: PosterInput): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return null;

  ilu(c, "#c98a12", "#b07510", "#dda02a");
  const glow = c.createRadialGradient(W, 0, 40, W, 0, 900);
  glow.addColorStop(0, "rgba(232,86,58,.45)");
  glow.addColorStop(1, "rgba(232,86,58,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);

  // The card.
  const cx = 70;
  const cy = 150;
  const cw = W - 140;
  const ch = H - 300;
  c.save();
  c.shadowColor = "rgba(28,20,22,.35)";
  c.shadowBlur = 50;
  c.shadowOffsetY = 20;
  roundRect(c, cx, cy, cw, ch, 56);
  c.fillStyle = "#fbf7f1";
  c.fill();
  c.restore();

  // Top band: the photo (Fix Am) or the game's colour.
  const bandH = 520;
  c.save();
  roundRect(c, cx + 20, cy + 20, cw - 40, bandH, 40);
  c.clip();
  const photo = p.photoUrl ? await loadImage(p.photoUrl) : null;
  if (photo) {
    const scale = Math.max((cw - 40) / photo.width, bandH / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    c.drawImage(photo, cx + 20 + (cw - 40 - w) / 2, cy + 20 + (bandH - h) / 2, w, h);
  } else {
    c.fillStyle = p.bg;
    c.fillRect(cx + 20, cy + 20, cw - 40, bandH);
    c.fillStyle = p.ink;
    for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) {
      c.beginPath();
      c.arc(cx + 60 + i * 80, cy + 60 + j * 90, 18, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#fbf7f1";
    c.textAlign = "center";
    const s = fit(c, p.gameName, cw - 120, 120, "500 SIZEpx Fraunces, Georgia, serif");
    c.font = `500 ${s}px Fraunces, Georgia, serif`;
    c.fillText(p.gameName, W / 2, cy + 20 + bandH / 2 + s / 3);
  }
  c.restore();

  c.textAlign = "left";
  let y = cy + bandH + 110;
  c.fillStyle = "#82601f";
  c.font = "800 38px Manrope, Arial, sans-serif";
  c.fillText(p.challenge ? `CHALLENGE FROM ${p.name.toUpperCase()}`.slice(0, 40) : p.gameName.toUpperCase(), cx + 60, y);
  y += 110;
  c.fillStyle = "#1c1416";
  const s1 = fit(c, p.scoreText, cw - 120, 120, "500 SIZEpx Fraunces, Georgia, serif");
  c.font = `500 ${s1}px Fraunces, Georgia, serif`;
  c.fillText(p.scoreText, cx + 60, y);
  y += 80;
  c.fillStyle = "#57474a";
  c.font = "600 44px Manrope, Arial, sans-serif";
  c.fillText(p.challenge ? `Can you beat ${p.name} at ${p.gameName}?` : `${p.headline} in ${p.gameName}.`, cx + 60, y, cw - 120);
  if (p.credit) {
    c.font = "500 26px Manrope, Arial, sans-serif";
    c.fillStyle = "#8a7a7c";
    c.fillText(p.credit, cx + 60, cy + ch - 40, cw - 120);
  }

  // Footer on the pattern.
  c.fillStyle = "#2a1a05";
  c.font = "500 64px Fraunces, Georgia, serif";
  c.textAlign = "left";
  c.fillText("amah", 80, H - 62);
  c.textAlign = "right";
  c.font = "800 38px Manrope, Arial, sans-serif";
  c.fillText(p.challenge ? "Play it on playamah.app" : "playamah.app", W - 80, H - 72);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Share a poster with a message and link: the phone's share sheet, or download and copy. */
export async function sharePoster(blob: Blob | null, text: string, url: string): Promise<"shared" | "copied" | "cancelled"> {
  const file = blob ? new File([blob], "amah.png", { type: "image/png" }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (file && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text: `${text} ${url}` });
      return "shared";
    }
    if (nav.share) {
      await nav.share({ text, url });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
  }
  // Computers: save the poster, copy the message and link.
  if (blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "amah.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    // Clipboard blocked: the poster still downloaded.
  }
  return "copied";
}
