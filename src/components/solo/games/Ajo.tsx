"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AJO_LAST, LESSON, N, canMove, move, newAjo, newAjoLesson, noteOf, type AjoLast, type AjoState, type Dir } from "@/lib/solo/games/ajo";
import { GameAudio } from "@/lib/game-audio";
import type { SoloApi } from "../SoloShell";

const ART = "/games/ajo/";
const SOUNDS = ["aj-slide", "aj-merge", "aj-stamp", "aj-top", "aj-lose"];
/** Each level's own colour, under the painting while it loads (and for the top-note chip). */
const TONE = ["#b9a2d8", "#e9a77d", "#9cc79a", "#7fb0d8", "#f2a0b0", "#d9c27a", "#6fb8b0", "#f0c27a", "#e0b25a", "#d9a043", "#c98a2e", "#c0392b", "#b03028", "#9c2a20", "#3a3a3a"];
/** Levels 1 to 8 are notes (the value goes in the oval); from 9 they're bundles of money. */
const isNote = (v: number) => v <= 8;
const STAMP_MS = 750;
/** How long a note takes to glide to its new square. */
const GLIDE_MS = 140;
const LEARNED = "amah:ajo:learned";
/** The ladder above the board: ₦5 up to ₦1,000. */
const LADDER = 8;
const ARROW: Record<Dir, string> = { left: "←", right: "→", up: "↑", down: "↓" };
const COACH = [
  "Swipe left. Watch the two ₦5 notes at the top slide together and join into ₦10.",
  "A new ₦5 landed at the bottom (the gold ring). Swipe up: the two ₦5s on the left slide up, meet and join.",
  "Two ₦10 notes, one above the other. Swipe up again to join them into ₦20.",
];

function Tile({ v, size }: { v: number; size: number }) {
  const label = noteOf(v);
  if (isNote(v))
    return (
      <span className="relative grid h-full w-full place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a painted note */}
        <img src={`${ART}tile-${v}.webp`} alt="" className="w-[96%] drop-shadow-[0_2px_2px_rgba(42,26,16,.35)]" />
        <span className="absolute font-display font-black tabular text-[#2a1a10]" style={{ fontSize: Math.max(11, size * (label.length > 4 ? 0.17 : 0.21)) }}>
          {label}
        </span>
      </span>
    );
  return (
    <span className="relative grid h-full w-full place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a painted bundle */}
      <img src={`${ART}tile-${v}.webp`} alt="" className="max-h-[84%] max-w-[90%] drop-shadow-[0_3px_3px_rgba(42,26,16,.4)]" />
      <span className="absolute bottom-[2%] rounded-full bg-[#2a1a10] px-1.5 font-display font-black tabular text-[#f6c453]" style={{ fontSize: Math.max(10, size * 0.16) }}>
        {label}
      </span>
    </span>
  );
}

type Fx = { id: number; i: number };
/** A note that joined another: it glides onto its partner, then it's gone. */
type Ghost = { id: number; v: number; at: number };

export function Ajo({ api }: { api: SoloApi<AjoState> }) {
  const [s, setS] = useState<AjoState>(() => api.saved ?? newAjo(api.seed));
  // Each note keeps an id while it slides around, so the screen can glide it rather than redraw it.
  const nextId = useRef(1);
  const label = (tiles: number[]) => tiles.map((v) => (v ? nextId.current++ : 0));
  const [ids, setIds] = useState<number[]>(() => label(s.tiles));
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [pops, setPops] = useState<Set<number>>(() => new Set());
  const [fresh, setFresh] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [stamps, setStamps] = useState<Fx[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [width, setWidth] = useState(320);
  /** The first game's lesson: which step (0 to 2), done (3: the last word), or none. */
  const [lesson, setLesson] = useState<number | null>(null);
  const [nudge, setNudge] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fxId = useRef(1);
  const ended = useRef(false);
  const over = !canMove(s);

  const audio = useRef<GameAudio | null>(null);
  useEffect(() => {
    const au = new GameAudio(api.soundOn);
    audio.current = au;
    au.preload(SOUNDS);
    try {
      sessionStorage.removeItem(AJO_LAST);
    } catch {
      // Nothing to clear.
    }
    return () => au.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one mixer for the life of the game
  }, []);

  // A first game on this phone (not a challenge or today's game) starts with the lesson.
  useEffect(() => {
    if (api.saved || api.mode !== "normal" || api.target != null) return;
    let learned = true;
    try {
      learned = localStorage.getItem(LEARNED) === "1";
    } catch {
      // No storage: skip the lesson rather than repeat it every time.
    }
    if (learned) return;
    const first = newAjoLesson();
    setS(first);
    setIds(label(first.tiles));
    setLesson(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the game opens
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    api.save(s);
    if (over && !ended.current) {
      ended.current = true;
      try {
        sessionStorage.setItem(AJO_LAST, JSON.stringify({ best: s.best, moves: s.moves } satisfies AjoLast));
      } catch {
        // The finish just shows fewer numbers.
      }
      audio.current?.sfx("aj-lose", { volume: 0.8 });
      api.end(s.score, { best: noteOf(s.best), moves: s.moves });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the board changes
  }, [s, over]);

  const go = useCallback(
    (dir: Dir) => {
      if (api.paused || over) return;
      const step = lesson != null && lesson < LESSON.length ? LESSON[lesson]! : null;
      // In the lesson, only the move the coach asked for; anything else gives the coach a nudge.
      if (step && dir !== step.dir) return setNudge((n) => n + 1);
      const r = move(api.seed, s, dir, step?.spawn);
      if (!r) return;
      const au = audio.current;
      au?.wake();
      // Where each note went: it keeps its id and glides; the second of a joining pair glides onto
      // its partner and disappears.
      const next = Array<number>(N * N).fill(0);
      const gone: Ghost[] = [];
      const popped = new Set<number>();
      for (const w of r.went) {
        if (!next[w.to]) {
          next[w.to] = ids[w.from]!;
          if (w.joined) popped.add(ids[w.from]!);
        } else gone.push({ id: ids[w.from]!, v: s.tiles[w.from]!, at: w.to });
      }
      if (r.spawnedAt != null) next[r.spawnedAt] = nextId.current++;
      setIds(next);
      setGhosts(gone);
      setPops(popped);
      setFresh(r.spawnedAt != null ? next[r.spawnedAt]! : null);
      setTimeout(() => setGhosts((g) => (g === gone ? [] : g)), GLIDE_MS + 20);
      setS(r.state);
      if (step) {
        const done = (lesson ?? 0) + 1;
        setLesson(done);
        if (done >= LESSON.length)
          try {
            localStorage.setItem(LEARNED, "1");
          } catch {
            // It'll teach again next time; no harm.
          }
      } else if (lesson != null) setLesson(null);
      au?.sfx("aj-slide", { volume: 0.6, rate: 0.95 + Math.random() * 0.1 });
      if (r.mergedAt.length) {
        // A PAID stamp on every merge, and a snap of cash, higher for bigger notes.
        const marks: Fx[] = r.mergedAt.map((i) => ({ id: fxId.current++, i }));
        setTimeout(() => setStamps((l) => [...l, ...marks]), GLIDE_MS);
        setTimeout(() => setStamps((l) => l.filter((m) => !marks.includes(m))), GLIDE_MS + STAMP_MS);
        au?.sfx("aj-merge", { volume: 0.85, rate: 0.9 + Math.min(14, r.merged) * 0.03 });
        setTimeout(() => au?.sfx("aj-stamp", { volume: 0.7 }), 90);
      }
      // A new top note: ka-ching, and its value across the card.
      if (r.merged > s.best) {
        const id = fxId.current++;
        setToast({ id, text: `${noteOf(r.merged)}!` });
        setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1300);
        if (r.merged >= 4) setTimeout(() => au?.sfx("aj-top", { volume: 0.85 }), 140);
      }
      if (r.merged >= 8 && !s.won) setSaid("₦1,000 note! Keep going.");
      else setSaid(r.merged ? `Merged into ${noteOf(r.merged)}. ${r.points} points.` : "Moved.");
    },
    [api, s, over, ids, lesson],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" } as Record<string, Dir>)[e.key];
      if (dir) {
        e.preventDefault();
        go(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // The board's squares: 12px padding, 8px gaps.
  const cell = Math.max(10, (width - 24 - 8 * (N - 1)) / N);
  const pos = (i: number) => `translate(${12 + (i % N) * (cell + 8)}px, ${12 + Math.floor(i / N) * (cell + 8)}px)`;
  const coaching = lesson != null && lesson < LESSON.length ? LESSON[lesson]! : null;
  const notes = [
    ...s.tiles.map((v, i) => ({ id: ids[i]!, v, at: i, ghost: false })).filter((t) => t.v && t.id),
    ...ghosts.map((g) => ({ ...g, ghost: true })),
  ];

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-end justify-between px-1">
        <p className="display text-[2rem] leading-none tabular">{s.score.toLocaleString("en-NG")}</p>
        <p className="flex items-center gap-1.5 text-[0.85rem] font-semibold text-muted">
          Top:
          <span key={s.best} className={cn("aj-chip rounded-full px-2 py-0.5 font-extrabold", s.best >= 12 ? "text-[#fff6e8]" : "text-[#2a1a10]")} style={{ background: TONE[Math.max(0, (s.best || 1) - 1)] }}>
            {s.best ? noteOf(s.best) : "₦5"}
          </span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>

      {/* The first game's coach: what to swipe, and what will happen. */}
      {lesson != null ? (
        <div key={nudge} role="status" className={cn("cut-sm mt-3 flex items-center gap-3 bg-indigo px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#f6efe6]", nudge > 0 && "aj-nudge")}>
          <span
            aria-hidden
            className="aj-arrow shrink-0 text-[1.6rem] leading-none text-[#f2b705]"
            style={{
              ["--nx" as string]: coaching?.dir === "left" ? "-6px" : coaching?.dir === "right" ? "6px" : "0px",
              ["--ny" as string]: coaching?.dir === "up" ? "-6px" : coaching?.dir === "down" ? "6px" : "0px",
            }}
          >
            {coaching ? ARROW[coaching.dir] : "★"}
          </span>
          <span>{coaching ? COACH[lesson] : "That's it. Keep joining notes and climb the ladder to ₦1,000. Keep your biggest note in a corner."}</span>
        </div>
      ) : null}

      {/* The ladder: every note up to ₦1,000, lit once you've made it, the next one marked. */}
      <div aria-label={`Notes made so far, up to ${noteOf(Math.max(1, s.best))}`} className="mt-3 flex gap-[3px]">
        {Array.from({ length: LADDER }, (_, k) => {
          const lv = k + 1;
          const got = lv <= s.best;
          return (
            <span
              key={lv}
              className={cn("flex-1 rounded-[4px] py-1 text-center text-[0.62rem] font-extrabold", got ? "text-[#2a1a10]" : "bg-sunk text-muted", lv === s.best + 1 && "outline-dashed outline-2 outline-offset-1 outline-fg")}
              style={got ? { background: TONE[k] } : undefined}
            >
              {noteOf(lv)}
            </span>
          );
        })}
      </div>

      <div
        ref={boardRef}
        data-tour="ajo-board"
        role="grid"
        aria-label="Ajo board. Swipe or use the arrow keys to slide the notes."
        tabIndex={0}
        className="relative mt-2 aspect-square w-full touch-none rounded-[18px] bg-[#f2a7b5] bg-cover shadow-[0_20px_40px_-26px_rgba(28,20,22,.8)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#e8563a]"
        style={{ backgroundImage: `url(${ART}card.webp)` }}
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.clientX - t.x;
          const dy = e.clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}
      >
        {/* The empty squares. */}
        {Array.from({ length: N * N }, (_, i) => (
          <span key={`c${i}`} aria-hidden className="absolute left-0 top-0 rounded-[10px] border-[1.5px] border-dashed border-[rgba(179,38,30,.35)] bg-[rgba(255,255,255,.18)]" style={{ width: cell, height: cell, transform: pos(i) }} />
        ))}
        {/* The notes, each gliding to its square. */}
        {notes.map((t) => {
          const isNew = t.id === fresh;
          const popped = pops.has(t.id);
          return (
            <div
              key={`t${t.id}`}
              role={t.ghost ? undefined : "gridcell"}
              aria-label={t.ghost ? undefined : noteOf(t.v)}
              aria-hidden={t.ghost || undefined}
              className="aj-glide absolute left-0 top-0"
              style={{ width: cell, height: cell, transform: pos(t.at), zIndex: t.ghost ? 1 : 2 }}
            >
              <div key={popped || isNew ? `${t.id}-${s.moves}` : t.id} className={cn("relative h-full w-full", popped && "aj-merge", isNew && "aj-in")}>
                <Tile v={t.v} size={cell} />
                {isNew ? <span aria-hidden className="aj-ring pointer-events-none absolute -inset-1 rounded-[13px] border-[3px] border-[#f2b705]" /> : null}
              </div>
            </div>
          );
        })}
        {stamps.map((m) => (
          <span key={m.id} aria-hidden className="pointer-events-none absolute left-0 top-0 z-10" style={{ width: cell, height: cell, transform: pos(m.i) }}>
            <span className="aj-stamp absolute left-1/2 top-1/2 rounded-[6px] border-[3px] border-[#b3261e] px-1.5 font-display font-black text-[#b3261e]" style={{ fontSize: Math.max(10, cell * 0.17) }}>
              PAID
            </span>
          </span>
        ))}
        {toast ? (
          <span key={toast.id} aria-hidden className="aj-toast pointer-events-none absolute inset-x-0 top-[40%] z-20 text-center font-display text-[2.4rem] font-black text-[#fff6d6]" style={{ WebkitTextStroke: "1.6px #2a1a10" }}>
            {toast.text}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:hidden" aria-hidden>
        {(["left", "up", "down", "right"] as Dir[]).map((d) => (
          <button key={d} type="button" tabIndex={-1} onClick={() => go(d)} className="glass h-11 rounded-full text-[1.1rem] font-bold">
            {ARROW[d]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted">Swipe to slide every note. Two the same make the next one up. Reach ₦1,000, then keep saving.</p>
      <style>{`
        .aj-glide { transition: transform ${GLIDE_MS}ms ease-out; }
        .aj-merge { animation: aj-merge .28s cubic-bezier(.3,1.6,.5,1) ${GLIDE_MS}ms both; }
        @keyframes aj-merge { from { transform: scale(1.22); } to { transform: scale(1); } }
        .aj-in { animation: aj-in .22s ease-out ${GLIDE_MS}ms both; }
        .aj-ring { animation: aj-ring 1.2s ease-out ${GLIDE_MS}ms both; }
        @keyframes aj-ring { 0%, 60% { opacity: 1; } to { opacity: 0; } }
        .aj-arrow { animation: aj-arrow 1s ease-in-out infinite; }
        @keyframes aj-arrow { 50% { transform: translate(var(--nx), var(--ny)); } }
        .aj-nudge { animation: aj-nudge .35s ease-in-out; }
        @keyframes aj-nudge { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes aj-in { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .aj-stamp { animation: aj-stamp ${STAMP_MS}ms ease-out both; }
        @keyframes aj-stamp { 0% { transform: translate(-50%, -50%) rotate(-14deg) scale(1.9); opacity: 0; } 18% { transform: translate(-50%, -50%) rotate(-14deg) scale(1); opacity: .95; } 70% { opacity: .9; } 100% { transform: translate(-50%, -50%) rotate(-14deg) scale(1); opacity: 0; } }
        .aj-toast { animation: aj-toast 1.3s ease-out both; }
        @keyframes aj-toast { from { transform: scale(.5); opacity: 0; } 15% { transform: scale(1.1); opacity: 1; } 70% { opacity: 1; } to { transform: translateY(-30px); opacity: 0; } }
        .aj-chip { animation: aj-chip .35s cubic-bezier(.3,1.7,.5,1) both; }
        @keyframes aj-chip { from { transform: scale(.5); } to { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .aj-merge, .aj-in, .aj-chip, .aj-arrow, .aj-nudge { animation: none; }
          .aj-glide { transition: none; }
          .aj-ring { animation: aj-fade 1.2s ease-out both; }
          .aj-stamp { animation: aj-fade ${STAMP_MS}ms ease-out both; transform: translate(-50%, -50%) rotate(-14deg); }
          .aj-toast { animation: aj-fade 1.3s ease-out both; }
          @keyframes aj-fade { from, 70% { opacity: 1; } to { opacity: 0; } }
        }
      `}</style>
    </div>
  );
}
