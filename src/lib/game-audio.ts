"use client";

import { SOUND_FILES } from "./sound-files";

/**
 * Game sound: real recordings when they're there (public/sounds, built by
 * scripts/audio/build-sounds.mjs from docs/audio/sound-pack.md), stand-ins made on the spot when
 * they aren't, so every game can be wired up before its sounds are recorded.
 *
 * - `sfx`: a one-off sound (a horn, a coin).
 * - `loop`: a sound that keeps going until stopped (the engine, oil sizzling), whose speed and
 *   volume can change as it plays (the engine revs with the okada's speed).
 * - `voice`: a line of speech, picked at random from its takes (v-mp-wait-1, -2, -3), and never
 *   twice too close together, so customers don't talk over each other.
 * - `music`: the background track, streamed (not downloaded up front), with its own on/off
 *   switch kept on the phone.
 *
 * Nothing plays while the member's sound is off.
 */
type Opts = { volume?: number; rate?: number };
export type LoopHandle = { setRate(r: number): void; setVolume(v: number): void; stop(): void };
const NONE: LoopHandle = { setRate() {}, setVolume() {}, stop() {} };

const MUSIC_KEY = "amah:music";
export const musicPreferred = () => {
  try {
    return localStorage.getItem(MUSIC_KEY) !== "off";
  } catch {
    return true;
  }
};
export const setMusicPreferred = (on: boolean) => {
  try {
    localStorage.setItem(MUSIC_KEY, on ? "on" : "off");
  } catch {
    // Fine: the switch just won't be remembered.
  }
};

const url = (name: string) => `/sounds/${name}.mp3`;
const have = (name: string) => SOUND_FILES.has(name);

export class GameAudio {
  private ac: AudioContext | null = null;
  private out: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private loops = new Set<LoopHandle>();
  private lastVoice = new Map<string, number>();
  private anyVoiceUntil = 0;
  private track: HTMLAudioElement | null = null;
  private trackName: string | null = null;

  constructor(private enabled: boolean) {}

  private ctx() {
    if (!this.enabled || typeof window === "undefined") return null;
    if (!this.ac) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ac = new Ctor();
      this.out = this.ac.createGain();
      this.out.gain.value = 0.9;
      this.out.connect(this.ac.destination);
    }
    if (this.ac.state === "suspended") void this.ac.resume();
    return this.ac;
  }

  /** Fetch and decode sounds ahead of time, so the first sizzle isn't late. */
  preload(names: string[]) {
    for (const n of names) if (have(n)) void this.buffer(n);
  }

  private buffer(name: string) {
    let p = this.buffers.get(name);
    if (!p) {
      const ac = this.ctx();
      p = ac
        ? fetch(url(name))
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
            .then((b) => ac.decodeAudioData(b))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(name, p);
    }
    return p;
  }

  sfx(name: string, o: Opts = {}) {
    const ac = this.ctx();
    if (!ac || !this.out) return;
    if (!have(name)) return standIn(ac, this.out, name, o);
    void this.buffer(name).then((b) => {
      if (!b || !this.out) return;
      const src = ac.createBufferSource();
      src.buffer = b;
      src.playbackRate.value = o.rate ?? 1;
      const g = ac.createGain();
      g.gain.value = o.volume ?? 1;
      src.connect(g).connect(this.out);
      src.start();
    });
  }

  loop(name: string, o: Opts = {}): LoopHandle {
    const ac = this.ctx();
    if (!ac || !this.out) return NONE;
    const g = ac.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(o.volume ?? 1, ac.currentTime, 0.08);
    g.connect(this.out);
    let rate = o.rate ?? 1;
    let src: AudioBufferSourceNode | null = null;
    let stopped = false;
    let synth: { setRate(r: number): void; stop(): void } | null = null;
    if (have(name)) {
      void this.buffer(name).then((b) => {
        if (!b || stopped) return;
        src = ac.createBufferSource();
        src.buffer = b;
        src.loop = true;
        src.playbackRate.value = rate;
        src.connect(g);
        src.start();
      });
    } else synth = standInLoop(ac, g, name, rate);
    const h: LoopHandle = {
      setRate: (r) => {
        rate = r;
        if (src) src.playbackRate.setTargetAtTime(r, ac.currentTime, 0.1);
        synth?.setRate(r);
      },
      setVolume: (v) => g.gain.setTargetAtTime(v, ac.currentTime, 0.1),
      stop: () => {
        if (stopped) return;
        stopped = true;
        g.gain.setTargetAtTime(0, ac.currentTime, 0.06);
        setTimeout(() => {
          try {
            src?.stop();
          } catch {
            // Never started.
          }
          synth?.stop();
          g.disconnect();
        }, 400);
        this.loops.delete(h);
      },
    };
    this.loops.add(h);
    return h;
  }

  /**
   * Say a line: `group` "mp-wait" plays v-mp-wait, or one of v-mp-wait-1, -2, -3 at random. Waits
   * `gap` seconds before the same group speaks again, and won't talk over another line.
   */
  voice(group: string, gap = 4, volume = 1) {
    const now = performance.now() / 1000;
    if (now < this.anyVoiceUntil || now - (this.lastVoice.get(group) ?? -99) < gap) return;
    const takes = [`v-${group}`, ...[1, 2, 3, 4].map((k) => `v-${group}-${k}`)].filter(have);
    if (!takes.length) return;
    this.lastVoice.set(group, now);
    this.anyVoiceUntil = now + 1.2;
    this.sfx(takes[Math.floor(Math.random() * takes.length)]!, { volume });
  }

  /** The background track (null stops it). Streams, loops, and fades in. */
  music(name: string | null, volume = 0.32) {
    if (name === this.trackName) return;
    this.track?.pause();
    this.track = null;
    this.trackName = name;
    if (!name || !this.enabled || !musicPreferred() || !have(name)) return;
    const a = new Audio(url(name));
    a.loop = true;
    a.volume = 0;
    a.preload = "auto";
    void a.play().catch(() => {});
    let v = 0;
    const id = setInterval(() => {
      v = Math.min(volume, v + volume / 20);
      a.volume = v;
      if (v >= volume) clearInterval(id);
    }, 60);
    this.track = a;
  }
  /** Quiet the music (paused game) or bring it back. */
  pauseMusic(paused: boolean) {
    if (!this.track) return;
    if (paused) this.track.pause();
    else void this.track.play().catch(() => {});
  }
  setMusic(on: boolean) {
    setMusicPreferred(on);
    const name = this.trackName;
    this.trackName = null;
    if (on) this.music(name);
    else {
      this.track?.pause();
      this.track = null;
      this.trackName = name;
    }
  }

  stopLoops() {
    for (const l of [...this.loops]) l.stop();
  }
  dispose() {
    this.stopLoops();
    this.track?.pause();
    this.track = null;
    void this.ac?.close().catch(() => {});
    this.ac = null;
  }
}

/* ---- Stand-ins: made on the spot until the recordings arrive. ---- */

let noiseBuf: AudioBuffer | null = null;
function noise(ac: AudioContext) {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(ac: AudioContext, out: AudioNode, f: number, t: number, d: number, type: OscillatorType, v: number, slide?: number) {
  const now = ac.currentTime + t;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, now);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, now + d);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(v, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  o.connect(g).connect(out);
  o.start(now);
  o.stop(now + d + 0.05);
}

function burst(ac: AudioContext, out: AudioNode, d: number, freq: number, v: number, type: BiquadFilterType = "lowpass") {
  const now = ac.currentTime;
  const s = ac.createBufferSource();
  s.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(v, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  s.connect(f).connect(g).connect(out);
  s.start(now);
  s.stop(now + d + 0.05);
}

function standIn(ac: AudioContext, out: AudioNode, name: string, o: Opts) {
  const v = o.volume ?? 1;
  const key = name.replace(/^(mp|ok)-/, "");
  switch (key) {
    case "coins":
    case "cash":
      [1318, 1568, 2093].forEach((f, i) => tone(ac, out, f, i * 0.06, 0.18, "triangle", 0.07 * v));
      return;
    case "star":
      [784, 988, 1175, 1568].forEach((f, i) => tone(ac, out, f, i * 0.08, 0.3, "sine", 0.08 * v));
      return;
    case "bell":
      tone(ac, out, 1760, 0, 0.6, "sine", 0.08 * v);
      return;
    case "horn":
      tone(ac, out, 440, 0, 0.12, "square", 0.05 * v);
      tone(ac, out, 440, 0.17, 0.14, "square", 0.05 * v);
      return;
    case "whistle":
      tone(ac, out, 2600, 0, 0.18, "sine", 0.06 * v);
      tone(ac, out, 2600, 0.25, 0.3, "sine", 0.06 * v);
      return;
    case "pothole":
      tone(ac, out, 120, 0, 0.25, "sine", 0.25 * v, 50);
      burst(ac, out, 0.2, 900, 0.12 * v);
      return;
    case "crash":
      burst(ac, out, 1.2, 2500, 0.25 * v);
      tone(ac, out, 90, 0, 0.5, "sawtooth", 0.12 * v, 40);
      return;
    case "splash":
    case "sand":
      burst(ac, out, 0.45, key === "splash" ? 1800 : 3500, 0.12 * v, key === "splash" ? "lowpass" : "highpass");
      return;
    case "oil-drop":
    case "burnt":
      burst(ac, out, 0.9, 5000, 0.08 * v, "highpass");
      return;
    case "gas-out":
      burst(ac, out, 0.6, 600, 0.1 * v);
      return;
    case "gas-new":
    case "charcoal":
    case "start":
      tone(ac, out, 180, 0, 0.35, "sawtooth", 0.06 * v, 320);
      return;
    case "brakes":
      tone(ac, out, 1900, 0, 0.5, "sawtooth", 0.025 * v, 1500);
      return;
    case "pass":
      burst(ac, out, 0.6, 700, 0.08 * v);
      return;
    case "scoop":
    case "plate":
    case "bin":
      tone(ac, out, key === "bin" ? 220 : 520, 0, 0.08, "triangle", 0.07 * v, key === "bin" ? 120 : 380);
      return;
    default:
      tone(ac, out, 660, 0, 0.05, "triangle", 0.05 * v);
  }
}

/** Continuous stand-ins: an engine that revs, oil that sizzles, a pot that bubbles. Ambience stays silent. */
function standInLoop(ac: AudioContext, out: AudioNode, name: string, rate: number) {
  const key = name.replace(/^(mp|ok)-/, "");
  if (key === "engine" || key === "idle") {
    const o = ac.createOscillator();
    o.type = "sawtooth";
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = ac.createGain();
    g.gain.value = 0.05;
    // A slow wobble, so it putters rather than drones.
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = 22;
    lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    const base = key === "idle" ? 38 : 55;
    o.frequency.value = base * rate;
    o.connect(f).connect(g).connect(out);
    o.start();
    lfo.start();
    return {
      setRate: (r: number) => {
        o.frequency.setTargetAtTime(base * r, ac.currentTime, 0.15);
        lfo.frequency.setTargetAtTime(22 * r, ac.currentTime, 0.15);
      },
      stop: () => {
        o.stop();
        lfo.stop();
      },
    };
  }
  if (["sizzle", "grill", "deepfry", "simmer", "amala"].includes(key)) {
    const s = ac.createBufferSource();
    s.buffer = noise(ac);
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = key === "simmer" || key === "amala" ? "lowpass" : "highpass";
    f.frequency.value = key === "simmer" || key === "amala" ? 500 : 4200;
    const g = ac.createGain();
    g.gain.value = 0.05;
    s.connect(f).connect(g).connect(out);
    s.start();
    return { setRate: () => {}, stop: () => s.stop() };
  }
  return null;
}
