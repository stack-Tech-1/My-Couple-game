/**
 * Road pictures for Okada Rush: find the painted lane lines, then crop and stretch the road so
 * its three lanes sit exactly where the game puts them, and make it repeat end to end.
 */
import sharp from "sharp";

/** The two dashed lines between the three lanes: their x in the picture. */
export async function laneLines(image) {
  const { data, info } = await image.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const frac = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = 0; y < H; y += 2) {
      const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.min(r, g, b) > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 40) n++;
    }
    frac[x] = n / Math.ceil(H / 2);
  }
  // Dashes: white for part of the height, never all of it (kerbs and railings are solid).
  const runs = [];
  for (let x = 0; x < W; x++) {
    if (frac[x] < 0.18 || frac[x] > 0.8) continue;
    const last = runs[runs.length - 1];
    if (last && x - last.x1 <= 2) (last.x1 = x), (last.w += frac[x]), (last.sx += x * frac[x]);
    else runs.push({ x0: x, x1: x, w: frac[x], sx: x * frac[x] });
  }
  const mid = W / 2;
  const near = runs.filter((r) => Math.abs((r.x0 + r.x1) / 2 - mid) < W * 0.3).sort((a, b) => b.w - a.w).slice(0, 2);
  if (near.length < 2) throw new Error(`lane lines not found (${runs.length} candidates)`);
  const xs = near.map((r) => r.sx / r.w).sort((a, b) => a - b);
  return { left: xs[0], right: xs[1], width: W, height: H };
}

/**
 * Crop and scale so the road's lanes take `road` of the output width, centred, and blend the
 * bottom rows into the top so the strip repeats without a seam.
 */
export async function fitRoad(image, { outWidth = 1080, road = 0.8, blend = 0.12 } = {}) {
  const { left, right, width, height } = await laneLines(image);
  const lane = right - left;
  const roadW = lane * 3;
  const cropW = Math.round(roadW / road);
  const x0 = Math.round(left - lane - (cropW - roadW) / 2);
  // Outside the picture? Pad with a mirror of the pavement.
  const padL = Math.max(0, -x0), padR = Math.max(0, x0 + cropW - width);
  let img = image.clone();
  if (padL || padR) img = sharp(await img.extend({ left: padL, right: padR, extendWith: "mirror" }).png().toBuffer());
  const strip = await img.extract({ left: x0 + padL, top: 0, width: cropW, height }).resize({ width: outWidth }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = strip;
  const W = info.width, H = info.height;
  const b = Math.round(H * blend);
  // The last b rows fade into the first b rows; the strip then ends where it began.
  const out = Buffer.alloc(W * (H - b) * 3);
  data.copy(out, 0, 0, W * (H - b) * 3);
  for (let y = 0; y < b; y++) {
    const a = y / b;
    for (let x = 0; x < W; x++) {
      const top = (y * W + x) * 3, bottom = ((H - b + y) * W + x) * 3;
      for (let c = 0; c < 3; c++) out[top + c] = Math.round(data[bottom + c] * (1 - a) + data[top + c] * a);
    }
  }
  return { image: sharp(out, { raw: { width: W, height: H - b, channels: 3 } }), lane, left, right };
}
