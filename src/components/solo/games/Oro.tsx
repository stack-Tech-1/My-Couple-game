"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { playSound } from "@/lib/sound";
import { guessOro, type OroState } from "@/lib/solo/oro";
import type { Mark } from "@/lib/solo/oro-words";
import { makePoster, sharePoster } from "../poster";
import { SoloTour, soloTourDue } from "../SoloTour";

const ROWS = 6;
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MARK_LABEL: Record<Mark, string> = { hit: "right place", near: "in the word, wrong place", miss: "not in the word" };

/** Our own look: indigo for the right place, marigold for wrong place, each with its own shape. */
function Tile({ letter, mark, small }: { letter: string; mark?: Mark; small?: boolean }) {
  return (
    <span
      className={cn(
        "relative flex items-center justify-center rounded-[10px] border-2 font-extrabold uppercase",
        small ? "h-5 w-5 rounded-[5px] border text-[0]" : "aspect-square text-[1.45rem]",
        mark === "hit" ? "border-[#24305e] bg-[#24305e] text-[#f6efe6]" : mark === "near" ? "border-[#1c1416] bg-[#e9b13c] text-[#1c1416]" : mark === "miss" ? "border-[#8a7d74] bg-[#8a7d74] text-[#f6efe6]" : letter ? "border-[#1c1416] bg-raised" : "border-line bg-raised/50",
      )}
    >
      {small ? null : letter}
      {/* Shapes, so colour is never the only clue: a dot for right place, a ring for wrong place. */}
      {mark === "hit" ? <span aria-hidden className={cn("absolute rounded-full bg-[#f6d26a]", small ? "h-1.5 w-1.5" : "right-1.5 top-1.5 h-2 w-2")} /> : null}
      {mark === "near" ? <span aria-hidden className={cn("absolute rounded-full border-2 border-[#1c1416]", small ? "h-2 w-2 border" : "right-1 top-1 h-2.5 w-2.5")} /> : null}
    </span>
  );
}

export function Oro({ initial, myName, soundOn, toured = false }: { initial: OroState; myName: string; soundOn: boolean; toured?: boolean }) {
  const [s, setS] = useState(initial);
  const [touring, setTouring] = useState(false);
  // First visit: the how-to-play tour, unless today's word is already done.
  useEffect(() => {
    if (initial.finished || !soloTourDue("oro", toured)) return;
    const t = setTimeout(() => setTouring(true), 400);
    return () => clearTimeout(t);
  }, [initial.finished, toured]);
  const endTour = useCallback(() => setTouring(false), []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const sound = (n: Parameters<typeof playSound>[0]) => soundOn && playSound(n);

  const keyMark = (k: string): Mark | undefined => {
    let best: Mark | undefined;
    s.guesses.forEach((g, gi) =>
      [...g].forEach((ch, i) => {
        if (ch !== k) return;
        const m = s.marks[gi]![i]!;
        if (m === "hit" || (m === "near" && best !== "hit") || (m === "miss" && !best)) best = m;
      }),
    );
    return best;
  };

  const submit = useCallback(async () => {
    if (busy || s.finished) return;
    if (draft.length !== 5) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setBusy(true);
    const r = await guessOro(draft);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setS(r.data);
    setDraft("");
    sound(r.data.solved ? "win" : r.data.finished ? "lose" : "flip");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sound only reads soundOn
  }, [busy, draft, s.finished]);

  const press = useCallback(
    (k: string) => {
      if (s.finished) return;
      if (k === "enter") return void submit();
      if (k === "back") return setDraft((d) => d.slice(0, -1));
      if (/^[a-z]$/.test(k)) setDraft((d) => (d.length < 5 ? d + k : d));
    },
    [s.finished, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (touring || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key === "Enter" ? "enter" : e.key === "Backspace" ? "back" : e.key.toLowerCase();
      if (k === "enter" || k === "back" || /^[a-z]$/.test(k)) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, touring]);

  async function share() {
    const tries = s.solved ? `${s.guesses.length}/6` : "X/6";
    const blob = await makePoster({ gameName: "Ọ̀rọ̀ of the Day", scoreText: tries, headline: `${myName} got today's word`, name: myName, challenge: false, bg: "#24305e", ink: "#33427c", accent: "#e9b13c" });
    const how = await sharePoster(blob, `Ọ̀rọ̀ of the Day ${s.day}: ${tries}${s.naija ? " (Naija word Friday)" : ""}. Can you get it?`, "https://playamah.app");
    if (how === "copied") toast.success("Poster saved and message copied.");
  }

  const rows = Array.from({ length: ROWS }, (_, r) => {
    if (r < s.guesses.length) return { letters: [...s.guesses[r]!], marks: s.marks[r] };
    if (r === s.guesses.length && !s.finished) return { letters: [...draft.padEnd(5, " ")].map((x) => x.trim()), marks: undefined };
    return { letters: ["", "", "", "", ""], marks: undefined };
  });

  return (
    <div className="mx-auto max-w-[420px] select-none">
      <div className="flex items-center justify-between gap-3">
        <Link prefetch={false} href="/solo" className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-semibold">
          <Icon name="arrowLeft" size={16} /> Solo
        </Link>
        <div className="flex gap-2">
          {!s.finished ? (
            <button type="button" onClick={() => setTouring(true)} className="glass rounded-full px-3.5 py-2 text-[0.85rem] font-semibold">
              How to play
            </button>
          ) : null}
          <span className="glass rounded-full px-3.5 py-2 text-[0.85rem] font-bold">{s.streak ? `${s.streak}-day streak` : "Day one"}</span>
        </div>
      </div>
      <h1 className="display mt-5 text-[2.2rem] leading-none">Ọ̀rọ̀ of the Day</h1>
      <p className="mt-1.5 text-muted">{s.naija ? `Friday: it's a Naija word. Hint: ${s.hint}` : "One five-letter word. Six guesses. Same word for everyone today."}</p>

      <div data-tour="oro-board" role="grid" aria-label="Your guesses" className={cn("mt-5 flex flex-col gap-1.5", shake && "animate-[shake_.35s]")}>
        {rows.map((row, r) => (
          <div key={r} role="row" className="grid grid-cols-5 gap-1.5">
            {row.letters.map((l, i) => (
              <span key={i} role="gridcell" aria-label={l ? `${l.toUpperCase()}${row.marks ? `, ${MARK_LABEL[row.marks[i]!]}` : ""}` : "Empty"}>
                <Tile letter={l} mark={row.marks?.[i]} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.78rem] text-muted">
        <span className="inline-flex items-center gap-1.5"><Tile letter="" mark="hit" small /> right place</span>
        <span className="inline-flex items-center gap-1.5"><Tile letter="" mark="near" small /> wrong place</span>
        <span className="inline-flex items-center gap-1.5"><Tile letter="" mark="miss" small /> not in the word</span>
      </p>

      {s.finished ? (
        <section aria-live="polite" className="glass mt-5 rounded-[24px] p-5 text-center">
          <p className="display text-[1.8rem] leading-tight">{s.solved ? (s.guesses.length <= 2 ? "Ọ̀rọ̀ master." : "Got it.") : "Not today."}</p>
          <p className="mt-1 font-semibold">
            The word was <span className="uppercase tracking-wide">{s.answer}</span>
            {s.naija && s.hint ? ` (${s.hint.toLowerCase()})` : ""}.
          </p>
          {s.partner ? (
            <div className="mt-4 rounded-[16px] bg-sunk p-3">
              <p className="text-[0.88rem] font-bold">You and {s.partner.name} today</p>
              <div className="mt-2 flex justify-center gap-6">
                {[{ who: "You", marks: s.marks, solved: s.solved }, { who: s.partner.name, marks: s.partner.marks, solved: s.partner.solved }].map((p) => (
                  <div key={p.who} className="flex flex-col items-center gap-1">
                    <div className="flex flex-col gap-0.5" aria-label={`${p.who}: ${p.solved ? `${p.marks.length} guesses` : "not solved"}`}>
                      {p.marks.map((m, i) => (
                        <div key={i} className="flex gap-0.5">
                          {m.map((x, j) => (
                            <Tile key={j} letter="" mark={x} small />
                          ))}
                        </div>
                      ))}
                    </div>
                    <span className="text-[0.8rem] font-semibold">{p.who}: {p.solved ? `${p.marks.length}/6` : "X/6"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[0.85rem] text-muted">Come back tomorrow for a new word. Your streak is waiting.</p>
          )}
          <Button size="lg" variant="outline" className="mt-4 w-full" onClick={() => void share()}>
            Share
          </Button>
        </section>
      ) : (
        <div data-tour="oro-keys" className="mt-5 flex flex-col gap-1.5" aria-label="Keyboard">
          {KEYS.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {i === 2 ? (
                <button type="button" onClick={() => press("enter")} disabled={busy} className="h-12 rounded-[8px] bg-[#1c1416] px-2.5 text-[0.78rem] font-bold text-[#f6efe6]">
                  Enter
                </button>
              ) : null}
              {[...row].map((k) => {
                const m = keyMark(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    aria-label={`${k.toUpperCase()}${m ? `, ${MARK_LABEL[m]}` : ""}`}
                    className={cn(
                      "relative h-12 min-w-0 flex-1 rounded-[8px] text-[0.95rem] font-bold uppercase",
                      m === "hit" ? "bg-[#24305e] text-[#f6efe6]" : m === "near" ? "bg-[#e9b13c]" : m === "miss" ? "bg-[#8a7d74]/60 text-[#f6efe6]" : "bg-[rgba(28,20,22,.1)]",
                    )}
                  >
                    {k}
                  </button>
                );
              })}
              {i === 2 ? (
                <button type="button" onClick={() => press("back")} aria-label="Delete" className="h-12 rounded-[8px] bg-[rgba(28,20,22,.1)] px-2.5 text-[0.95rem] font-bold">
                  ⌫
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {touring ? <SoloTour gameId="oro" onDone={endTour} /> : null}
    </div>
  );
}
