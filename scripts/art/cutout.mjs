/**
 * Cut the separate items out of an AI-made art sheet.
 *
 * Works on both kinds of sheet the image tools give back:
 * - real transparency (the item pixels are kept as they are);
 * - a painted grey-and-white checkerboard pretending to be transparency (it is flooded away from
 *   the edges, plus any checkerboard pockets left between arms and handles).
 *
 * Returns the items in reading order: top row first, left to right.
 */
import sharp from "sharp";

export async function cutSheet(file, { minArea = 4000, backdrop = "auto", pockets = true } = {}) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const real = meta.hasAlpha ? await sharp(file).ensureAlpha().raw().toBuffer() : null;
  const W = info.width, H = info.height, N = W * H;
  const alpha = new Uint8Array(N);
  const q = new Int32Array(N);
  const near = (i, W, H) => {
    const x = i % W, y = (i / W) | 0;
    return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
  };

  // "grey": a flat grey studio backdrop (sometimes partly see-through) instead of transparency.
  // "dark": a black backdrop, or a see-through one with dark smudges painted on it.
  if (backdrop === "dark") {
    const bgLike = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      bgLike[i] = (real && real[i * 4 + 3] < 200) || (sat < 24 && Math.max(r, g, b) < 72) ? 1 : 0;
    }
    const bg = new Uint8Array(N);
    let h = 0, t = 0;
    const push = (i) => {
      if (!bg[i] && bgLike[i]) (bg[i] = 1), (q[t++] = i);
    };
    for (let x = 0; x < W; x++) push(x), push((H - 1) * W + x);
    for (let y = 0; y < H; y++) push(y * W), push(y * W + W - 1);
    while (h < t) for (const j of near(q[h++], W, H)) if (j >= 0) push(j);
    for (let i = 0; i < N; i++) if (!bg[i]) alpha[i] = near(i, W, H).some((j) => j >= 0 && bg[j]) ? 150 : 255;
  } else if (real && backdrop !== "grey") {
    for (let i = 0; i < N; i++) alpha[i] = real[i * 4 + 3] > 24 ? real[i * 4 + 3] : 0;
  } else {
    const bgLike = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      bgLike[i] =
        backdrop === "grey"
          ? (real && real[i * 4 + 3] < 200) || (sat < 16 && Math.min(r, g, b) > 80 && Math.max(r, g, b) < 215)
            ? 1
            : 0
          : sat < 14 && Math.min(r, g, b) > 196
            ? 1
            : 0;
    }
    const bg = new Uint8Array(N);
    let h = 0, t = 0;
    const push = (i) => {
      if (!bg[i] && bgLike[i]) {
        bg[i] = 1;
        q[t++] = i;
      }
    };
    for (let x = 0; x < W; x++) push(x), push((H - 1) * W + x);
    for (let y = 0; y < H; y++) push(y * W), push(y * W + W - 1);
    while (h < t) for (const j of near(q[h++], W, H)) if (j >= 0) push(j);
    // Checkerboard pockets enclosed by the item: grey regions with both checker tones in them.
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (bg[s] || !bgLike[s] || seen[s]) continue;
      h = 0;
      t = 0;
      q[t++] = s;
      seen[s] = 1;
      let light = 0, mid = 0;
      while (h < t) {
        const i = q[h++];
        const v = data[i * 3];
        if (v > 246) light++;
        else if (v > 212 && v < 236) mid++;
        for (const j of near(i, W, H)) if (j >= 0 && !seen[j] && bgLike[j] && !bg[j]) (seen[j] = 1), (q[t++] = j);
      }
      const pocket = !pockets ? false : backdrop === "grey" ? t > 400 : t > 250 && light > t * 0.2 && mid > t * 0.2;
      if (pocket) for (let k = 0; k < t; k++) bg[q[k]] = 1;
    }
    for (let i = 0; i < N; i++) if (!bg[i]) alpha[i] = near(i, W, H).some((j) => j >= 0 && bg[j]) ? 150 : 255;
  }

  // Each connected blob is one item.
  const lab = new Int32Array(N).fill(-1);
  const blobs = [];
  for (let s = 0; s < N; s++) {
    if (!alpha[s] || lab[s] >= 0) continue;
    let h = 0, t = 0;
    q[t++] = s;
    lab[s] = blobs.length;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (h < t) {
      const i = q[h++], x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const j of near(i, W, H)) if (j >= 0 && alpha[j] && lab[j] < 0) (lab[j] = blobs.length), (q[t++] = j);
    }
    blobs.push({ k: blobs.length, x0, y0, x1, y1, n: t });
  }
  const items = [];
  for (const b of blobs.filter((b) => b.n >= minArea)) {
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    const px = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (b.y0 + y) * W + b.x0 + x, o = (y * w + x) * 4;
        if (lab[i] !== b.k) continue;
        px[o] = data[i * 3];
        px[o + 1] = data[i * 3 + 1];
        px[o + 2] = data[i * 3 + 2];
        px[o + 3] = alpha[i];
      }
    items.push({ x: b.x0, y: b.y0, w, h, cy: b.y0 + h / 2, image: sharp(px, { raw: { width: w, height: h, channels: 4 } }) });
  }
  // Reading order: group into rows by vertical overlap, then left to right.
  items.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const it of items) {
    const row = rows.find((r) => Math.abs(r[0].cy - it.cy) < Math.min(r[0].h, it.h) / 2);
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

/**
 * Split one cut item into n side-by-side items (pots joined by their shadows): cuts at the
 * emptiest column near each expected boundary, then trims each piece.
 */
export async function splitItem(it, n) {
  const { data, info } = await it.image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const col = new Float64Array(W);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) col[x] += data[(y * W + x) * 4 + 3];
  const cuts = [0];
  for (let k = 1; k < n; k++) {
    const mid = Math.round((W * k) / n);
    const span = Math.round(W / n / 4);
    let best = mid;
    for (let x = mid - span; x <= mid + span; x++) if (col[x] < col[best]) best = x;
    cuts.push(best);
  }
  cuts.push(W);
  const out = [];
  for (let k = 0; k < n; k++) {
    const piece = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract({ left: cuts[k], top: 0, width: cuts[k + 1] - cuts[k], height: H }).png().toBuffer();
    const trimmed = await sharp(piece).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
    out.push({ w: trimmed.info.width, h: trimmed.info.height, image: sharp(trimmed.data) });
  }
  return out;
}

/** Join items that came apart (a string of lights cut in two) into one picture. */
export async function joinItems(items) {
  const x0 = Math.min(...items.map((i) => i.x)), y0 = Math.min(...items.map((i) => i.y));
  const x1 = Math.max(...items.map((i) => i.x + i.w)), y1 = Math.max(...items.map((i) => i.y + i.h));
  const layers = await Promise.all(items.map(async (i) => ({ input: await i.image.clone().png().toBuffer(), left: i.x - x0, top: i.y - y0 })));
  const buf = await sharp({ create: { width: x1 - x0, height: y1 - y0, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, image: sharp(buf) };
}

/**
 * Lift food off its plate: removes the white and grey plate that's connected to the outside,
 * leaving the coloured food. Not for white food (rice), which would go with the plate.
 */
export async function offThePlate(image) {
  const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const plate = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    return a < 30 || (Math.max(r, g, b) - Math.min(r, g, b) < 30 && Math.min(r, g, b) > 120) || Math.max(r, g, b) < 70;
  };
  const gone = new Uint8Array(N);
  const q = new Int32Array(N);
  let h = 0, t = 0;
  const push = (i) => {
    if (!gone[i] && plate(i)) (gone[i] = 1), (q[t++] = i);
  };
  for (let x = 0; x < W; x++) push(x), push((H - 1) * W + x);
  for (let y = 0; y < H; y++) push(y * W), push(y * W + W - 1);
  while (h < t) {
    const i = q[h++], x = i % W, y = (i / W) | 0;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }
  for (let i = 0; i < N; i++) if (gone[i]) data[i * 4 + 3] = 0;
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 1 });
}
