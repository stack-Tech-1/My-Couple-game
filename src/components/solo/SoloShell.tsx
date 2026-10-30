"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { playSound } from "@/lib/sound";
import type { SoundName } from "@/games/_engine/types";
import { finishRun, startRun, type FinishResult } from "@/lib/solo/actions";
import { formatScore, soloGame } from "@/lib/solo/catalog";
import { makePoster, sharePoster } from "./poster";
import { ChallengeSheet } from "./ChallengeSheet";

/** What every Solo game gets from the frame. */
export type SoloApi<S> = {
  seed: string;
  /** A game saved on this phone, to carry on from (null for a fresh game). */
  saved: S | null;
  paused: boolean;
  /** Keep the game's state on the phone. Cheap to call often. */
  save: (state: S) => void;
  /** The game is over: save the score. */
  end: (score: number, meta?: Record<string, number | string | boolean>) => void;
  sound: (n: SoundName) => void;
  /** Challenges: the score to beat. */
  target: number | null;
};

type Saved<S> = { runId: string; seed: string; target: number | null; elapsed: number; state: S; at: number };
const KEY = (gameId: string, mode: string) => `amah:solo:${gameId}:${mode}`;
const DAY = 24 * 3600_000;

function readSave<S>(key: string): Saved<S> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved<S>;
    return Date.now() - s.at < DAY ? s : null;
  } catch {
    return null;
  }
}

export type PosterExtra = { photoUrl?: string; credit?: string | null };

export function SoloShell<S>({
  gameId,
  mode = "normal",
  seed: fixedSeed,
  challenge,
  myName,
  soundOn,
  poster,
  backHref = "/solo",
  header,
  children,
}: {
  gameId: string;
  mode?: string;
  /** Daily boards: everyone gets the same seed. */
  seed?: string;
  challenge?: string | null;
  myName: string;
  soundOn: boolean;
  poster?: PosterExtra;
  backHref?: string;
  header?: ReactNode;
  children: (api: SoloApi<S>) => ReactNode;
}) {
  const game = soloGame(gameId)!;
  const key = KEY(gameId, mode);
  const [phase, setPhase] = useState<"loading" | "ask" | "playing" | "done">("loading");
  const [run, setRun] = useState<{ runId: string; seed: string; target: number | null } | null>(null);
  const [saved, setSaved] = useState<S | null>(null);
  const [hidden, setHidden] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [result, setResult] = useState<(FinishResult & { score: number }) | null>(null);
  const [round, setRound] = useState(0);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const elapsed = useRef(0);
  const since = useRef<number | null>(null);
  const lastState = useRef<S | null>(null);
  const lastWrite = useRef(0);
  const paused = hidden || userPaused || phase !== "playing";

  // Time only counts while the game is on screen and running.
  useEffect(() => {
    if (paused) {
      if (since.current !== null) elapsed.current += performance.now() - since.current;
      since.current = null;
    } else since.current = performance.now();
  }, [paused]);
  const playedMs = () => Math.round(elapsed.current + (since.current !== null ? performance.now() - since.current : 0));

  const write = useCallback(() => {
    if (!run || lastState.current === null) return;
    try {
      localStorage.setItem(key, JSON.stringify({ ...run, elapsed: playedMs(), state: lastState.current, at: Date.now() } satisfies Saved<S>));
    } catch {
      // Storage full or blocked: the game just can't carry on after a restart.
    }
  }, [key, run]);

  // Pause when the app is hidden or the phone locks, and save straight away.
  useEffect(() => {
    const onVis = () => {
      const h = document.visibilityState === "hidden";
      setHidden(h);
      if (h) write();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", write);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", write);
    };
  }, [write]);

  const begin = useCallback(async () => {
    setPhase("loading");
    setResult(null);
    setSaved(null);
    elapsed.current = 0;
    lastState.current = null;
    const r = await startRun({ gameId, mode, ...(fixedSeed ? { seed: fixedSeed } : {}), ...(challenge ? { challenge } : {}) });
    if (!r.ok) {
      toast.error(r.error);
      // Offline or signed out: still playable, the score just isn't saved.
      setRun({ runId: "", seed: fixedSeed ?? Math.random().toString(36).slice(2), target: null });
    } else setRun(r.data);
    setRound((n) => n + 1);
    setPhase("playing");
  }, [gameId, mode, fixedSeed, challenge]);

  // First load: offer to carry on a game saved on this phone, unless this is a challenge.
  useEffect(() => {
    const s = challenge ? null : readSave<S>(key);
    if (s && (!fixedSeed || s.seed === fixedSeed)) {
      setRun({ runId: s.runId, seed: s.seed, target: s.target });
      setSaved(s.state);
      elapsed.current = s.elapsed;
      lastState.current = s.state;
      setPhase("ask");
    } else void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const api: SoloApi<S> = {
    seed: run?.seed ?? "",
    saved,
    paused,
    target: run?.target ?? null,
    sound: (n) => soundOn && playSound(n),
    save: (state) => {
      lastState.current = state;
      if (Date.now() - lastWrite.current > 1500) {
        lastWrite.current = Date.now();
        write();
      }
    },
    end: (score, meta) => {
      if (phase !== "playing" || !run) return;
      const ms = playedMs();
      setPhase("done");
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing to clear.
      }
      if (!run.runId) {
        setResult({ score, scoreId: "", best: score, newBest: false, plays: 0, challenge: null });
        return;
      }
      void finishRun({ runId: run.runId, score, durationMs: ms, meta }).then((r) => {
        if (!r.ok) {
          toast.error(r.error);
          setResult({ score, scoreId: "", best: score, newBest: false, plays: 0, challenge: null });
          return;
        }
        if ((r.data.newBest || r.data.challenge?.result === "won") && soundOn) playSound("win");
        setResult({ ...r.data, score });
      });
    },
  };

  async function share() {
    if (!result) return;
    const blob = await makePoster({
      gameName: game.name,
      scoreText: formatScore(game, result.score),
      headline: result.newBest ? `${myName}'s new best` : `${myName} scored`,
      name: myName,
      challenge: false,
      bg: game.look.bg,
      ink: game.look.ink,
      accent: game.look.accent,
      ...poster,
    });
    const how = await sharePoster(blob, `I scored ${formatScore(game, result.score)} in ${game.name} on Amah.`, "https://playamah.app");
    if (how === "copied") toast.success("Poster saved and message copied.", "Paste it anywhere.");
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <Link prefetch={false} href={backHref} className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-semibold">
          <Icon name="arrowLeft" size={16} /> Solo
        </Link>
        {phase === "playing" ? (
          <button type="button" onClick={() => setUserPaused((p) => !p)} className="glass rounded-full px-4 py-2 text-[0.9rem] font-semibold" aria-pressed={userPaused}>
            {userPaused ? "Resume" : "Pause"}
          </button>
        ) : null}
      </div>
      {header}
      {run?.target != null && phase === "playing" ? (
        <p className="glass mt-3 rounded-[16px] px-4 py-2 text-center text-[0.9rem] font-semibold">Challenge: beat {formatScore(game, run.target)}</p>
      ) : null}

      {phase === "ask" ? (
        <div className="glass mt-6 rounded-[24px] p-6 text-center">
          <p className="display text-[1.6rem]">Carry on?</p>
          <p className="mt-1 text-muted">Your last game of {game.name} is saved on this phone.</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => setPhase("playing")}>Carry on</Button>
            <Button size="lg" variant="outline" onClick={() => void begin()}>Start fresh</Button>
          </div>
        </div>
      ) : null}

      {phase === "playing" || phase === "done" ? (
        <div className="relative mt-4" key={round}>
          {children(api)}
          {userPaused && phase === "playing" ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[24px] bg-[rgba(28,20,22,.55)] backdrop-blur-sm">
              <Button size="lg" onClick={() => setUserPaused(false)}>Resume</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "done" ? (
        <section aria-live="polite" aria-labelledby="solo-result-h" className="glass mt-5 rounded-[26px] p-5 text-center">
          {result ? (
            <>
              <p id="solo-result-h" className="display text-[2.4rem] leading-none">{formatScore(game, result.score)}</p>
              <p className="mt-2 font-semibold">
                {result.challenge
                  ? result.challenge.result === "won"
                    ? `You beat ${result.challenge.from}'s ${formatScore(game, result.challenge.target)}.`
                    : `${result.challenge.from}'s ${formatScore(game, result.challenge.target)} still stands. So close.`
                  : result.newBest
                    ? gameId === "okada-rush" ? "New best. Okada don fly." : "New best. Who taught you this?"
                    : game.kind === "bot"
                      ? result.score
                        ? "You beat the bot."
                        : "The bot got this one. Rematch?"
                      : `Your best: ${formatScore(game, result.best)}`}
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <Button size="lg" onClick={() => void begin()}>Play again</Button>
                {game.kind !== "bot" && game.kind !== "daily" ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button size="lg" variant="outline" onClick={() => void share()}>Share</Button>
                    <Button size="lg" variant="outline" disabled={!result.scoreId} onClick={() => setChallengeOpen(true)}>Challenge</Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p id="solo-result-h" className="text-muted">Saving your score…</p>
          )}
        </section>
      ) : null}

      {result?.scoreId ? (
        <ChallengeSheet
          open={challengeOpen}
          onClose={() => setChallengeOpen(false)}
          scoreId={result.scoreId}
          poster={{ gameName: game.name, scoreText: formatScore(game, result.score), name: myName, bg: game.look.bg, ink: game.look.ink, accent: game.look.accent, ...poster }}
        />
      ) : null}
    </div>
  );
}
