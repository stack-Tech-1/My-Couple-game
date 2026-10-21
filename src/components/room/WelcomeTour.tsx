"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/design/Button";
import { finishTour } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";

/** One stop on the tour: the element marked data-tour="<target>" and what to say about it. */
type Step = { target: string; title: string; body: string };

function stepsFor(kind: "couple" | "friends", ctx: { alone: boolean; owner: boolean; partner: string }): Step[] {
  if (kind === "friends") {
    return [
      { target: "room", title: "This is your friend room", body: "Everything in here is shared with the people in this room. If you're in more than one room, tap the name to switch." },
      ...(ctx.owner ? [{ target: "invite", title: "Bring your people", body: "Share this code or link. Up to eight people can join, and you can make a new code any time." }] : []),
      { target: "people", title: "Who's here", body: "Everyone in the room, and once you start playing, who's winning." },
      { target: "library", title: "The games", body: "Pick a game, then pick who you're playing. Only the friends you choose get the invite." },
      { target: "chat", title: "The group chat", body: "Messages, voice notes and stickers for the whole room. It follows you into every game." },
      { target: "settings", title: "Settings", body: "Light or dark, sounds, notifications, and the room's people. You can replay this tour from here too." },
    ];
  }
  return [
    { target: "room", title: "This is your room", body: "A private space for the two of you. Your games, notes and history all live here." },
    ...(ctx.alone ? [{ target: "invite", title: "Invite your person", body: "Send this link or read out the code. As soon as they join, the room locks to the two of you." }] : []),
    { target: "library", title: "Pick a game", body: `Choose any game and ${ctx.alone ? "your partner" : ctx.partner} gets an invite on their phone. You each play on your own screen, live.` },
    { target: "chat", title: "Your chat", body: "Messages, voice notes and stickers. It follows you into every game." },
    { target: "settings", title: "Settings", body: "Light or dark, sounds, notifications, and how After Dark works. You can replay this tour from here too." },
  ];
}

const PAD = 8;

/**
 * The welcome tour, on the room home only (never mid-game). New people see it once, automatically;
 * people who were already here are asked first. It waits for any open dialog (like the Terms prompt)
 * to close, and finishing, skipping or declining all mark it done on the account.
 */
export function WelcomeTour() {
  const { bundle } = useRoom();
  const router = useRouter();
  const params = useSearchParams();
  const replay = params.get("tour") === "1";
  const state = bundle.me.profile.tour ?? "done";
  const kind = bundle.room.kind;
  const steps = stepsFor(kind, {
    alone: kind === "couple" ? !bundle.partner : bundle.members.length === 1,
    owner: bundle.room.owner_id === bundle.me.profile.id,
    partner: bundle.partner?.profile.display_name ?? "your partner",
  });

  const [phase, setPhase] = useState<"waiting" | "ask" | "touring" | "done">(replay || state !== "done" ? "waiting" : "done");
  const [i, setI] = useState(0);
  // The steps whose target is on screen, worked out once when the tour starts.
  const [live, setLive] = useState<Step[] | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Wait until nothing else is on top (the Terms prompt, an invite modal), then begin.
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(() => {
      if (document.querySelector("dialog[open]")) return;
      clearInterval(t);
      setPhase(replay || state === "auto" ? "touring" : "ask");
    }, 700);
    return () => clearInterval(t);
  }, [phase, replay, state]);

  const finish = useCallback(() => {
    setPhase("done");
    if (state !== "done") void finishTour();
    if (replay) router.replace(window.location.pathname, { scroll: false });
  }, [state, replay, router]);

  useEffect(() => {
    if (phase === "touring" && !live) setLive(steps.filter((s) => document.querySelector(`[data-tour="${s.target}"]`)));
  }, [phase, live, steps]);
  const step = live?.[i];
  const target = step?.target;

  // Follow the target as the page scrolls or resizes (only re-measures when it actually moved).
  useLayoutEffect(() => {
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    let raf = 0;
    let last = "";
    const track = () => {
      const r = el.getBoundingClientRect();
      const sig = `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}`;
      if (sig !== last) {
        last = sig;
        setRect(r);
      }
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [target]);

  useEffect(() => {
    if (target) nextRef.current?.focus();
  }, [target]);

  // Nothing (left) to point at: close.
  useEffect(() => {
    if (phase === "touring" && live && !step) finish();
  }, [phase, live, step, finish]);

  useEffect(() => {
    if (phase !== "touring") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  if (phase === "done" || phase === "waiting") return null;

  if (phase === "ask") {
    return createPortal(
      <div role="dialog" aria-labelledby="tour-ask" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[95] mx-auto max-w-md rounded-[18px] border-[1.5px] border-line-strong bg-bg p-4 shadow-[0_18px_40px_-20px_rgba(28,20,22,.55)]">
        <p id="tour-ask" className="font-semibold">Want a 30-second tour?</p>
        <p className="mt-1 text-[0.9rem] text-muted">New things have arrived, like friend rooms and group games. We&apos;ll show you around.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="accent" onClick={() => setPhase("touring")}>Show me</Button>
          <Button size="sm" variant="ghost" onClick={finish}>No thanks</Button>
        </div>
      </div>,
      document.body,
    );
  }

  if (!step) return null;

  const vw = typeof window === "undefined" ? 390 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const below = !rect || rect.bottom + 200 < vh || rect.top < vh / 2;
  const cardTop = rect ? (below ? Math.min(rect.bottom + PAD + 10, vh - 210) : Math.max(rect.top - PAD - 10 - 190, 12)) : vh / 2 - 100;
  const total = live?.length ?? 0;
  const last = i === total - 1;

  return createPortal(
    <div className="fixed inset-0 z-[95]" aria-live="polite">
      {/* Dims everything except the spot being explained; tapping outside does nothing. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[16px] transition-[top,left,width,height] duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 3px var(--accent), 0 0 0 9999px rgba(18,12,14,.58)",
          }}
        />
      ) : null}
      <div
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute rounded-[18px] border-[1.5px] border-line-strong bg-bg p-5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)]"
        style={{ top: cardTop, left: 16, width: Math.min(vw - 32, 380), ...(vw > 412 && rect ? { left: Math.min(Math.max(rect.left, 16), vw - 396) } : {}) }}
      >
        <p className="eyebrow tabular text-muted">
          {i + 1} of {total}
        </p>
        <h2 id="tour-title" className="display mt-1.5 text-[1.5rem] leading-tight">{step.title}</h2>
        <p id="tour-body" className="mt-2 text-[0.92rem] leading-relaxed text-muted">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={finish}>Skip tour</Button>
          <span className="flex gap-2">
            {i > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setI(i - 1)}>Back</Button>
            ) : null}
            <Button ref={nextRef} size="sm" variant="accent" onClick={() => (last ? finish() : setI(i + 1))}>
              {last ? "Done" : "Next"}
            </Button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
