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
export type LoopHandle = { setRate(r: number): void; setVolume(v: number): void; /** -1 is the left ear, 1 the right. */ setPan(p: number): void; stop(): void };
const NONE: LoopHandle = { setRate() {}, setVolume() {}, setPan() {}, stop() {} };

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

  /** Call from a tap: phones keep sound asleep until the player touches the screen. */
  wake() {
    this.ctx();
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
    const panner = typeof ac.createStereoPanner === "function" ? ac.createStereoPanner() : null;
    if (panner) g.connect(panner).connect(this.out);
    else g.connect(this.out);
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
      setPan: (p) => panner?.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), ac.currentTime, 0.08),
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
          panner?.disconnect();
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
  const key = name.replace(/^(mp|ok|zs|mq|ba|pa|ca|bl|rx)-/, "");
  switch (key) {
    case "studs":
      [0, 0.12, 0.24, 0.36, 0.48].forEach((t) => setTimeout(() => burst(ac, out, 0.05, 1800, 0.09 * v), t * 1000));
      return;
    case "dummy":
      burst(ac, out, 0.08, 1500, 0.08 * v);
      return;
    case "kick":
      tone(ac, out, 120, 0, 0.12, "sine", 0.35 * v, 55);
      burst(ac, out, 0.06, 2600, 0.18 * v);
      return;
    case "save":
      burst(ac, out, 0.1, 3000, 0.3 * v);
      tone(ac, out, 220, 0, 0.1, "triangle", 0.12 * v, 140);
      return;
    case "roar":
      burst(ac, out, 1.6, 1300, 0.22 * v);
      return;
    case "goal":
      burst(ac, out, 0.35, 4200, 0.12 * v, "highpass");
      tone(ac, out, 330, 0.25, 0.8, "sawtooth", 0.05 * v, 150);
      return;
    case "place":
      // Cloth patted down on wood.
      burst(ac, out, 0.09, 900 * (o.rate ?? 1), 0.16 * v);
      tone(ac, out, 150 * (o.rate ?? 1), 0, 0.08, "sine", 0.12 * v, 100);
      return;
    case "sew":
      // A sewing machine's quick run: a buzz with a fast tick on it.
      for (let i = 0; i < 9; i++) tone(ac, out, 95 * (o.rate ?? 1), i * 0.045, 0.04, "square", 0.05 * v);
      burst(ac, out, 0.42, 2400, 0.06 * v, "bandpass");
      return;
    case "snip":
      burst(ac, out, 0.05, 6000, 0.22 * v, "highpass");
      setTimeout(() => burst(ac, out, 0.06, 5200, 0.2 * v, "highpass"), 110);
      return;
    case "catch":
      // Something soft landing in a woven basket.
      tone(ac, out, 260 * (o.rate ?? 1), 0, 0.1, "sine", 0.16 * v, 150 * (o.rate ?? 1));
      burst(ac, out, 0.07, 1400, 0.1 * v);
      return;
    case "gold":
      [1568, 2093, 2637, 3136].forEach((f, i) => tone(ac, out, f, i * 0.05, 0.3, "sine", 0.06 * v));
      return;
    case "pepper":
      burst(ac, out, 0.7, 4200, 0.18 * v, "highpass");
      tone(ac, out, 420, 0, 0.35, "sawtooth", 0.05 * v, 160);
      return;
    case "miss":
      tone(ac, out, 120, 0, 0.12, "sine", 0.12 * v, 70);
      burst(ac, out, 0.15, 900, 0.06 * v);
      return;
    case "faster":
      tone(ac, out, 1800, 0, 0.12, "sine", 0.06 * v, 2600);
      tone(ac, out, 2600, 0.16, 0.22, "sine", 0.06 * v);
      return;
    case "pump":
      // A squeeze of water through a nozzle: a low gush with a bubble rising out of it.
      burst(ac, out, 0.32, 520 * (o.rate ?? 1), 0.26 * v);
      tone(ac, out, 160 * (o.rate ?? 1), 0, 0.22, "sine", 0.14 * v, 420 * (o.rate ?? 1));
      return;
    case "ring":
      // Plastic on plastic, a little higher with every ring.
      tone(ac, out, 1180 * (o.rate ?? 1), 0, 0.14, "triangle", 0.09 * v, 900 * (o.rate ?? 1));
      tone(ac, out, 1760 * (o.rate ?? 1), 0.05, 0.22, "sine", 0.06 * v);
      return;
    case "tick":
      tone(ac, out, 1900, 0, 0.04, "square", 0.03 * v);
      return;
    case "brick":
      burst(ac, out, 0.16, 1700, 0.2 * v);
      tone(ac, out, 170, 0, 0.09, "triangle", 0.1 * v, 90);
      return;
    case "block":
      tone(ac, out, 240, 0, 0.1, "square", 0.05 * v, 150);
      return;
    case "wood":
      tone(ac, out, 420, 0, 0.09, "triangle", 0.13 * v, 180);
      burst(ac, out, 0.08, 2600, 0.09 * v);
      return;
    case "glass":
      [2640, 3320, 4180].forEach((f, i) => tone(ac, out, f, i * 0.025, 0.2, "sine", 0.05 * v));
      burst(ac, out, 0.22, 6000, 0.1 * v, "highpass");
      return;
    case "rock":
      tone(ac, out, 130, 0, 0.1, "square", 0.07 * v, 80);
      return;
    case "steel":
      [510, 1340].forEach((f) => tone(ac, out, f, 0, 0.32, "triangle", 0.06 * v));
      return;
    case "bounce":
      tone(ac, out, 700, 0, 0.04, "sine", 0.025 * v);
      return;
    case "plank":
      tone(ac, out, 300, 0, 0.09, "triangle", 0.12 * v, 200);
      return;
    case "combo":
      tone(ac, out, 620 * (o.rate ?? 1), 0, 0.16, "sine", 0.06 * v);
      return;
    case "fire":
      burst(ac, out, 0.9, 900, 0.28 * v);
      tone(ac, out, 150, 0, 0.8, "sawtooth", 0.08 * v, 420);
      return;
    case "blast":
      burst(ac, out, 0.9, 1100, 0.42 * v);
      tone(ac, out, 90, 0, 0.6, "sine", 0.3 * v, 34);
      return;
    case "danfo":
      tone(ac, out, 410, 0, 0.16, "square", 0.05 * v);
      tone(ac, out, 330, 0.2, 0.24, "square", 0.05 * v);
      return;
    case "capsule":
      [880, 1175].forEach((f, i) => tone(ac, out, f, i * 0.07, 0.18, "triangle", 0.07 * v));
      return;
    case "shard":
      tone(ac, out, 1900, 0, 0.2, "sawtooth", 0.035 * v, 700);
      return;
    case "drop":
      tone(ac, out, 330, 0, 0.42, "triangle", 0.1 * v, 95);
      return;
    case "floor":
      tone(ac, out, 210, 0, 0.14, "triangle", 0.14 * v, 340);
      return;
    case "clear":
      burst(ac, out, 1.2, 700, 0.22 * v);
      [523, 659, 784, 1046].forEach((f, i) => tone(ac, out, f, 0.35 + i * 0.1, 0.42, "triangle", 0.07 * v));
      return;
    case "splat":
      burst(ac, out, 0.09, 1500, 0.2 * v);
      tone(ac, out, 240, 0, 0.08, "sine", 0.14 * v, 90);
      return;
    case "puff-hit":
      tone(ac, out, 900, 0, 0.05, "triangle", 0.04 * v, 620);
      return;
    case "bite":
      burst(ac, out, 0.07, 3200, 0.3 * v);
      tone(ac, out, 520, 0.08, 0.22, "sawtooth", 0.07 * v, 300);
      return;
    case "blocked":
      tone(ac, out, 1250, 0, 0.12, "sine", 0.06 * v, 1700);
      return;
    case "power":
      [784, 1046, 1318].forEach((f, i) => tone(ac, out, f, i * 0.07, 0.22, "triangle", 0.07 * v));
      return;
    case "fog":
      burst(ac, out, 1.1, 5200, 0.2 * v, "highpass");
      return;
    case "fog-ready":
      [1046, 1568].forEach((f, i) => tone(ac, out, f, i * 0.1, 0.2, "sine", 0.06 * v));
      return;
    case "light-off":
      tone(ac, out, 320, 0, 1.1, "sawtooth", 0.05 * v, 45);
      return;
    case "up-nepa":
      [523, 659, 784, 1046].forEach((f, i) => tone(ac, out, f, i * 0.09, 0.4, "triangle", 0.07 * v));
      burst(ac, out, 1, 2400, 0.05 * v);
      return;
    case "boss":
      tone(ac, out, 110, 0, 1.2, "sawtooth", 0.1 * v, 62);
      return;
    case "boss-hit":
      tone(ac, out, 300, 0, 0.06, "square", 0.03 * v, 190);
      return;
    case "dive":
      tone(ac, out, 900, 0, 0.6, "sawtooth", 0.04 * v, 260);
      return;
    case "boss-down":
      tone(ac, out, 180, 0, 0.9, "sawtooth", 0.1 * v, 40);
      burst(ac, out, 0.8, 1800, 0.2 * v);
      return;
    case "wave":
      [659, 880].forEach((f, i) => tone(ac, out, f, i * 0.1, 0.25, "sine", 0.06 * v));
      return;
    case "puddle":
      tone(ac, out, 700, 0, 0.14, "sine", 0.07 * v, 1200);
      return;
    case "crow":
      [[640, 0, 0.16, 900], [900, 0.2, 0.18, 1150], [1150, 0.42, 0.65, 620]].forEach(([f, t, d, e]) => tone(ac, out, f!, t!, d!, "sawtooth", 0.06 * v, e));
      return;
    case "lose":
      [392, 330, 262].forEach((f, i) => tone(ac, out, f, i * 0.18, 0.4, "triangle", 0.08 * v));
      return;
    case "pick":
      tone(ac, out, 2350, 0, 0.09, "sine", 0.06 * v);
      tone(ac, out, 3120, 0.015, 0.07, "sine", 0.035 * v);
      return;
    case "put":
      tone(ac, out, 1500, 0, 0.07, "sine", 0.05 * v, 1250);
      return;
    case "wrong":
      tone(ac, out, 190, 0, 0.16, "triangle", 0.1 * v, 130);
      return;
    case "cork":
      tone(ac, out, 620, 0, 0.09, "sine", 0.13 * v, 240);
      [1046, 1318, 1760].forEach((f, i) => tone(ac, out, f, 0.1 + i * 0.07, 0.24, "sine", 0.06 * v));
      return;
    case "crate":
      [0, 0.09, 0.2].forEach((t, i) => tone(ac, out, 150 - i * 20, t, 0.1, "square", 0.05 * v, 80));
      burst(ac, out, 0.35, 1400, 0.08 * v);
      return;
    case "reveal":
      tone(ac, out, 880, 0, 0.2, "sine", 0.035 * v, 1320);
      return;
    case "hint":
      [988, 1318].forEach((f, i) => tone(ac, out, f, i * 0.09, 0.2, "sine", 0.06 * v));
      return;
    case "win":
      [659, 784, 988, 1318, 1568].forEach((f, i) => tone(ac, out, f, i * 0.1, 0.42, "triangle", 0.07 * v));
      return;
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
  const key = name.replace(/^(mp|ok|zs|mq|ba|pa|ca|bl|rx)-/, "");
  if (key === "crowd") {
    // A stadium murmur: low, wide noise.
    const s = ac.createBufferSource();
    s.buffer = noise(ac);
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 700;
    const g = ac.createGain();
    g.gain.value = 0.12;
    s.connect(f).connect(g).connect(out);
    s.start();
    return { setRate: () => {}, stop: () => s.stop() };
  }
  if (key === "flame") {
    const s = ac.createBufferSource();
    s.buffer = noise(ac);
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 620;
    const g = ac.createGain();
    g.gain.value = 0.22;
    s.connect(f).connect(g).connect(out);
    s.start();
    return { setRate: () => {}, stop: () => s.stop() };
  }
  if (key === "buzz") {
    // A thin whine that wavers, like the one by your ear at 2am.
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 610 * rate;
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1500;
    f.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.value = 0.09;
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = 7;
    lg.gain.value = 24;
    lfo.connect(lg).connect(o.frequency);
    o.connect(f).connect(g).connect(out);
    o.start();
    lfo.start();
    return {
      setRate: (r: number) => o.frequency.setTargetAtTime(610 * r, ac.currentTime, 0.1),
      stop: () => {
        o.stop();
        lfo.stop();
      },
    };
  }
  if (key === "spray") {
    const s = ac.createBufferSource();
    s.buffer = noise(ac);
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 5200;
    const g = ac.createGain();
    g.gain.value = 0.07;
    s.connect(f).connect(g).connect(out);
    s.start();
    return { setRate: () => {}, stop: () => s.stop() };
  }
  if (key === "pour") {
    // Running liquid: filtered noise that rises in pitch as the bottle fills, with a soft glug.
    const s = ac.createBufferSource();
    s.buffer = noise(ac);
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2.4;
    f.frequency.value = 760 * rate;
    const g = ac.createGain();
    g.gain.value = 0.2;
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = 9;
    lg.gain.value = 0.08;
    lfo.connect(lg).connect(g.gain);
    s.connect(f).connect(g).connect(out);
    s.start();
    lfo.start();
    return {
      setRate: (r: number) => f.frequency.setTargetAtTime(760 * r, ac.currentTime, 0.05),
      stop: () => {
        s.stop();
        lfo.stop();
      },
    };
  }
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
