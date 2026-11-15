/**
 * Turns the recordings in "game sounds/" (see docs/audio/sound-pack.md) into small MP3s in
 * public/sounds/, and lists them in src/lib/sound-files.ts for the games.
 *
 *   node scripts/audio/build-sounds.mjs
 *
 * - Sound effects: silence trimmed off both ends, volume evened out, mono.
 * - Loops (sizzle, engine, street…) and music: the end blended into the start so they repeat
 *   without a click or a jump.
 * - Voices (v-…): background hiss cleaned, volume evened out, and each take said into the file
 *   becomes its own variant (v-mp-wait-1, v-mp-wait-2 …) so customers don't sound the same twice.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

const SRC = "game sounds";
const OUT = "public/sounds";
const MANIFEST = "src/lib/sound-files.ts";
const RATE = 44100;
const LOOPS = /-(sizzle|amala|grill|deepfry|simmer|street|engine|idle|bridge|night)$/;

const run = (args, input) => {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args], { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return r.stdout;
};
/** Decode to raw 32-bit float samples. */
const decode = (file, filters, channels) => {
  const raw = run(["-i", file, ...(filters ? ["-af", filters] : []), "-ac", String(channels), "-ar", String(RATE), "-f", "f32le", "-"]);
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
};
const encode = (samples, channels, out, kbps) => {
  run(["-f", "f32le", "-ac", String(channels), "-ar", String(RATE), "-i", "-", "-codec:a", "libmp3lame", "-b:a", `${kbps}k`, "-y", out], Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
};
/** Blend the last `secs` into the first `secs`, so the sound loops without a seam. */
function seamless(x, channels, secs) {
  const n = Math.min(Math.floor(secs * RATE), Math.floor(x.length / channels / 3)) * channels;
  const out = x.slice(0, x.length - n);
  for (let i = 0; i < n; i++) {
    const a = i / n;
    out[i] = x[x.length - n + i] * (1 - a) + x[i] * a;
  }
  return out;
}
/** Where speech is: [start, end] seconds of each take, split on half a second of quiet. */
function takes(x) {
  const win = Math.floor(RATE * 0.02);
  const loud = [];
  let peak = 0;
  for (let i = 0; i < x.length; i += win) {
    let s = 0;
    for (let j = i; j < Math.min(x.length, i + win); j++) s += x[j] * x[j];
    const rms = Math.sqrt(s / win);
    loud.push(rms);
    peak = Math.max(peak, rms);
  }
  const on = loud.map((r) => r > peak * 0.08);
  const out = [];
  let start = -1, quiet = 0;
  on.forEach((v, k) => {
    if (v) {
      if (start < 0) start = k;
      quiet = 0;
    } else if (start >= 0 && ++quiet > 25) {
      out.push([start, k - quiet + 1]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, on.length]);
  // Keep real words (a quarter of a second or more), with a little air either side.
  return out.filter(([a, b]) => b - a > 12).map(([a, b]) => [Math.max(0, a - 4) * win, Math.min(x.length, (b + 6) * win)]);
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(path.join(OUT, f));
const names = [];
let total = 0;
for (const file of readdirSync(SRC).filter((f) => /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(f)).sort()) {
  const name = path.parse(file).name.toLowerCase().trim().replace(/\s+/g, "-");
  const src = path.join(SRC, file);
  const save = (samples, channels, kbps, as = name) => {
    const out = path.join(OUT, `${as}.mp3`);
    encode(samples, channels, out, kbps);
    names.push(as);
    total += statSync(out).size;
  };
  if (name.includes("-music-")) {
    save(seamless(decode(src, "loudnorm=I=-20:TP=-2", 2), 2, 2), 2, 96);
  } else if (name.startsWith("v-")) {
    const x = decode(src, "highpass=f=90,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5", 1);
    const parts = takes(x);
    if (parts.length <= 1) save(parts.length ? x.slice(...parts[0]) : x, 1, 64);
    else parts.slice(0, 4).forEach(([a, b], k) => save(x.slice(a, b), 1, 64, `${name}-${k + 1}`));
  } else if (LOOPS.test(name)) {
    save(seamless(decode(src, "loudnorm=I=-20:TP=-2", 1), 1, 0.25), 1, 64);
  } else {
    // Trim quiet off both ends (reverse, trim, reverse back), then even out.
    save(decode(src, "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5", 1), 1, 64);
  }
  console.log("·", name);
}
names.sort();
writeFileSync(MANIFEST, `// Made by scripts/audio/build-sounds.mjs: the recordings in public/sounds. Don't edit.\nexport const SOUND_FILES: ReadonlySet<string> = new Set<string>(${JSON.stringify(names, null, 2)});\n`);
console.log(`${names.length} sounds, ${(total / 1024).toFixed(0)} KB in ${OUT}`);
