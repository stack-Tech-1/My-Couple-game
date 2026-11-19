"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { makeRng } from "@/games/_engine/rng";
import { cn } from "@/lib/cn";
import { GameAudio, type LoopHandle } from "@/lib/game-audio";
import { REFLEX_LAST, SAVE_MS, type ReflexLast } from "@/lib/solo/reflex";
import { RATIO } from "./reflex-art";
import type { SoloApi } from "../SoloShell";

const ROUNDS = 5;
const ART = "/games/reflex/";
const SOUNDS = ["rx-studs", "rx-kick", "rx-save", "rx-roar", "rx-goal", "rx-whistle", "rx-dummy"];
/** The striker's run to the ball, before the wait for the kick. */
const RUN_MS = 600;
/** How long the ball takes from the spot to the net. */
const FLIGHT_MS = 380;
type Saved = { times: number[] };

/** Where things sit on the pitch picture, as % of its width (x) and height (y). */
const SPOT = { x: 50, y: 74 };
const CORNERS = [
  { x: 23, y: 31 },
  { x: 23, y: 43 },
  { x: 77, y: 31 },
  { x: 77, y: 43 },
] as const;

type Phase = "ready" | "run" | "wait" | "go" | "early" | "shot";
type Shot = { ms: number; saved: boolean; corner: number };

const img = (name: string) => `${ART}${name}.webp`;
/** A picture `h`% of the pitch's height tall; its width follows from its shape (the pitch is 3:4). */
const tall = (name: string, h: number): CSSProperties => ({ height: `${h}%`, width: `${(h * (4 / 3) * (RATIO[name] ?? 1)).toFixed(2)}%` });

/** Five penalties: wait for the kick, then tap to dive. Your score is your average time. */
export function ReflexTraining({ api }: { api: SoloApi<Saved> }) {
  const [times, setTimes] = useState<number[]>(api.saved?.times ?? []);
  const [phase, setPhase] = useState<Phase>("ready");
  const [shot, setShot] = useState<Shot | null>(null);
  const [corner, setCorner] = useState(0);
  const [dummy, setDummy] = useState(false);
  const [flying, setFlying] = useState(false);
  const goAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const crowd = useRef<LoopHandle | null>(null);
  const audio = useRef<GameAudio | null>(null);
  const round = times.length;
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const later = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
  const clearAll = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };

  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    try {
      sessionStorage.removeItem(REFLEX_LAST);
    } catch {
      // Nothing to clear.
    }
    return () => {
      clearAll();
      au.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the game
  }, []);

  // Leaving the app mid-kick makes that round start again.
  useEffect(() => {
    if (api.paused && (phase === "run" || phase === "wait" || phase === "go")) {
      clearAll();
      crowd.current?.setVolume(0.25);
      setDummy(false);
      setFlying(false);
      setPhase("ready");
    }
  }, [api.paused, phase]);

  const begin = () => {
    const au = audio.current;
    au?.wake();
    if (!crowd.current && au) crowd.current = au.loop("rx-crowd", { volume: 0.25 });
    // The same wait as ever (1.4 to 4 seconds), now spent running in, then dummying at the ball.
    const rng = makeRng(api.seed, round);
    const wait = 1400 + rng.int(2600);
    setCorner(rng.int(CORNERS.length));
    setShot(null);
    setFlying(false);
    setDummy(false);
    setPhase("run");
    au?.sfx("rx-studs", { volume: 0.7 });
    crowd.current?.setVolume(0.12);
    later(RUN_MS, () => setPhase("wait"));
    // A dummy or two while he stands over the ball: they mean nothing, so don't dive.
    for (let t = RUN_MS + 350 + Math.random() * 500; t < wait - 350; t += 600 + Math.random() * 900) {
      later(t, () => {
        setDummy(true);
        au?.sfx("rx-dummy", { volume: 0.5 });
      });
      later(t + 220, () => setDummy(false));
    }
    later(wait, () => {
      goAt.current = performance.now();
      setDummy(false);
      setPhase("go");
      au?.sfx("rx-kick", { volume: 0.95 });
      // Next frame, so the ball starts on the spot and flies.
      requestAnimationFrame(() => setFlying(true));
    });
  };

  const tap = () => {
    if (api.paused) return;
    const au = audio.current;
    if (phase === "ready" || phase === "early" || phase === "shot") {
      if (round >= ROUNDS) return;
      return begin();
    }
    if (phase === "run" || phase === "wait") {
      // Dived before the kick: the dummy got you, and the kick is taken again.
      clearAll();
      au?.sfx("rx-whistle", { volume: 0.85 });
      crowd.current?.setVolume(0.25);
      setDummy(false);
      return setPhase("early");
    }
    if (phase !== "go") return;
    clearAll();
    const ms = Math.round(performance.now() - goAt.current);
    const saved = ms < SAVE_MS;
    const next = [...times, ms];
    setTimes(next);
    api.save({ times: next });
    setShot({ ms, saved, corner });
    setPhase("shot");
    crowd.current?.setVolume(0.3);
    if (saved) {
      au?.sfx("rx-save", { volume: 0.95 });
      au?.sfx("rx-roar", { volume: 0.8 });
    } else au?.sfx("rx-goal", { volume: 0.85 });
    if (next.length >= ROUNDS) {
      const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
      try {
        sessionStorage.setItem(REFLEX_LAST, JSON.stringify({ times: next } satisfies ReflexLast));
      } catch {
        // The finish just shows fewer numbers.
      }
      later(900, () => {
        crowd.current?.stop();
        crowd.current = null;
        api.end(avg, { best: Math.min(...next) });
      });
    }
  };

  const label =
    phase === "run" || phase === "wait"
      ? "Wait for the kick…"
      : phase === "go"
        ? "Dive!"
        : phase === "early"
          ? "Too early. The dummy got you. Tap to face that kick again."
          : phase === "shot" && shot
            ? round >= ROUNDS
              ? shot.saved
                ? "Saved! That's all five."
                : "Goal. That's all five."
              : `${shot.saved ? "Saved!" : "Goal."} Tap for kick ${round + 1}.`
            : round
              ? `Kick ${round + 1} of ${ROUNDS}. Tap when you're ready.`
              : "Tap to start. Dive the moment the ball is struck.";

  // Where the ball is: on the spot, flying to its corner, or stopped by the keeper.
  const target = CORNERS[corner]!;
  const shotCorner = shot ? CORNERS[shot.corner]! : target;
  const ballAt = phase === "shot" && shot ? (shot.saved ? { x: shotCorner.x + (shotCorner.x < 50 ? 4 : -4), y: shotCorner.y + 2 } : shotCorner) : phase === "go" && flying ? target : SPOT;
  const inGoal = phase === "shot" || (phase === "go" && flying);
  const diveSide = (phase === "shot" && shot ? shot.corner : corner) < 2 ? "l" : "r";
  const keeper = phase === "shot" || phase === "early" ? `keeper-dive-${phase === "early" ? (round % 2 ? "l" : "r") : diveSide}` : "keeper-ready";
  const high = (phase === "shot" && shot ? shot.corner : corner) % 2 === 0;
  const striker = phase === "go" || phase === "shot" ? "striker-kick" : phase === "run" || dummy ? "striker-run" : "striker-stand";
  const strikerSize = 27;
  // The kick picture's foot (85% across, 80% down) meets the ball on the spot.
  const strikerPos: CSSProperties =
    striker === "striker-kick"
      ? { left: `${SPOT.x - 0.85 * strikerSize * (4 / 3) * (RATIO["striker-kick"] ?? 1)}%`, top: `${SPOT.y - 0.8 * strikerSize}%` }
      : phase === "ready" || phase === "early"
        ? { left: "22%", top: `${SPOT.y + 8 - strikerSize}%` }
        : { left: dummy ? "33%" : "31%", top: `${SPOT.y + 5 - strikerSize}%` };

  return (
    <div className="mx-auto max-w-[420px] select-none text-center">
      <div data-tour="reflex-times" className="flex justify-center gap-1.5" aria-label="Your times">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "min-w-[3.6rem] rounded-full px-2 py-1 text-[0.8rem] font-bold tabular",
              times[i] == null ? "glass text-muted" : times[i]! < SAVE_MS ? "bg-[#19a35a] text-white" : "bg-[#e04a2f] text-white",
              times[i] != null && i === times.length - 1 && "rx-pill",
            )}
          >
            {times[i] != null ? `${times[i]} ms` : i + 1}
          </span>
        ))}
      </div>
      <button
        type="button"
        data-tour="reflex-pad"
        onPointerDown={tap}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), tap())}
        aria-label={label}
        className={cn("relative mx-auto mt-4 block aspect-[3/4] w-full overflow-hidden rounded-[22px] border-[3px] border-[#0f2a1c] bg-[#1f6a3a] bg-cover bg-center shadow-[0_24px_40px_-24px_rgba(28,20,22,.8)]", phase === "early" && !calm && "rx-shake")}
        style={{ backgroundImage: `url(${img("pitch")})` }}
      >
        {/* The keeper: ready in the middle, or diving the way the ball went. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- painted sprites placed on the pitch */}
        <img
          src={img(keeper)}
          alt=""
          className={cn("absolute", keeper === "keeper-ready" && phase === "wait" && !calm && "rx-bounce")}
          style={
            keeper === "keeper-ready"
              ? { ...tall("keeper-ready", 17), left: "50%", top: "31.5%", transform: "translateX(-50%)" }
              : { ...tall(keeper, high ? 13 : 12), top: high ? "25%" : "34%", ...(keeper.endsWith("-l") ? { left: "9%" } : { right: "9%" }) }
          }
        />
        {/* The ball: on the spot, flying (smaller as it goes away), or in the net. */}
        {shot && !shot.saved ? (
          // eslint-disable-next-line @next/next/no-img-element -- painted sprite
          <img src={img("net")} alt="" className="rx-net absolute" style={{ width: "17%", left: `${shotCorner.x}%`, top: `${shotCorner.y}%`, transform: "translate(-50%, -50%)" }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- painted sprite
          <img
            src={img("ball")}
            alt=""
            className="absolute"
            style={{
              width: inGoal ? "4.2%" : "6%",
              left: `${ballAt.x}%`,
              top: `${ballAt.y}%`,
              transform: "translate(-50%, -50%)",
              transition: phase === "go" && flying && !calm ? `left ${FLIGHT_MS}ms linear, top ${FLIGHT_MS}ms cubic-bezier(.2,.6,.4,1), width ${FLIGHT_MS}ms linear` : "none",
            }}
          />
        )}
        {/* The striker, from behind: waiting, running in (and dummying), striking. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- painted sprite */}
        <img
          src={img(striker)}
          alt=""
          className="absolute"
          style={{ ...tall(striker, strikerSize), ...strikerPos, transition: phase === "run" && !calm ? `left ${RUN_MS}ms ease-out, top ${RUN_MS}ms ease-out` : "none" }}
        />
        {phase === "early" ? (
          // eslint-disable-next-line @next/next/no-img-element -- painted sprite
          <img src={img("whistle")} alt="" className="rx-whistle absolute" style={{ width: "17%", left: "56%", top: "52%" }} />
        ) : null}
        {phase === "shot" && shot ? (
          <span className="rx-tag absolute inset-x-0 top-[50%] font-display text-[2.4rem] font-black leading-none text-white" style={{ WebkitTextStroke: "1.6px #0f2a1c" }}>
            {shot.saved ? "Saved!" : "Goal"}
            <span className="mt-1 block text-[1.3rem]">{shot.ms} ms</span>
          </span>
        ) : null}
        <span aria-live="assertive" className={cn("absolute inset-x-3 bottom-3 rounded-full px-4 py-2.5 text-[0.95rem] font-extrabold", phase === "go" ? "bg-[#f6c453] text-[#1c1416]" : phase === "early" ? "bg-[#e04a2f] text-white" : "bg-[rgba(15,42,28,.82)] text-white")}>
          {label}
        </span>
      </button>
      <style>{`
        .rx-bounce { animation: rx-bounce .5s ease-in-out infinite; }
        @keyframes rx-bounce { 0%, 100% { margin-top: 0; } 50% { margin-top: -1.2%; } }
        .rx-tag { animation: rx-tag .4s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes rx-tag { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .rx-net { animation: rx-net .35s ease-out both; }
        @keyframes rx-net { from { transform: translate(-50%, -50%) scale(.6); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
        .rx-whistle { animation: rx-whistle .5s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes rx-whistle { from { transform: scale(.3) rotate(-30deg); opacity: 0; } to { transform: scale(1) rotate(-8deg); opacity: 1; } }
        .rx-shake { animation: rx-shake .35s linear; }
        @keyframes rx-shake { 0%, 100% { transform: none; } 25% { transform: translateX(-6px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-3px); } }
        .rx-pill { animation: rx-pill .35s cubic-bezier(.3,1.7,.5,1) both; }
        @keyframes rx-pill { from { transform: scale(.6); } to { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .rx-tag, .rx-net, .rx-whistle, .rx-pill { animation: none; } }
      `}</style>
    </div>
  );
}
