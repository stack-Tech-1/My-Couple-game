"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { setPin, verifyPin } from "@/lib/afterdark/actions";

const UNLOCK_KEY = "twain-ad-until";
const UNLOCK_MS = 30 * 60_000;

const readUnlocked = () => {
  try {
    return Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
};
const extend = () => {
  try {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_MS));
  } catch {
    // storage unavailable: the PIN will simply be asked for again
  }
};
const lock = () => {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // ignore
  }
};

/** Leave instantly for a neutral screen, replacing history so Back doesn't return here. */
export function quickExit(roomId: string) {
  lock();
  document.documentElement.dataset.theme = "";
  window.location.replace(`/room/${roomId}`);
}

/**
 * Everything After Dark renders inside this: the lights dim, a per-person PIN guards entry
 * (re-asked after 30 idle minutes, per browser tab), the screen blurs whenever the tab loses
 * focus, and a quick-exit is always one tap (or Esc twice) away.
 */
export function AfterDarkShell({ hasPin, requirePin = true, children }: { hasPin: boolean; requirePin?: boolean; children: ReactNode }) {
  const { bundle, setThemeOverride, setWhere } = useRoom();
  const roomId = bundle.room.id;
  // `passed` means this person actually entered their PIN. It is the ONLY thing that may extend
  // the unlock window: pages that don't require a PIN (the consent screen) must never mint one.
  const [passed, setPassed] = useState<boolean | null>(null);
  const unlocked = passed === null ? null : !requirePin || passed;
  const [hidden, setHidden] = useState(false);
  const lastEsc = useRef(0);

  useEffect(() => {
    setThemeOverride("afterdark");
    setWhere({ where: "afterdark" });
    return () => {
      setThemeOverride(null);
      setWhere({ where: "home" });
    };
  }, [setThemeOverride, setWhere]);

  useEffect(() => setPassed(readUnlocked()), [requirePin]);

  // Discreet mode: blur the moment the tab or window loses focus.
  useEffect(() => {
    const hide = () => setHidden(true);
    const show = () => setHidden(document.visibilityState !== "visible");
    const onVis = () => setHidden(document.visibilityState !== "visible");
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Activity keeps the unlock alive; Esc twice exits.
  useEffect(() => {
    const onActivity = () => requirePin && passed && extend();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      if (now - lastEsc.current < 600) quickExit(roomId);
      lastEsc.current = now;
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onKey);
    };
  }, [requirePin, passed, roomId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => quickExit(roomId)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[85] flex items-center gap-2 rounded-full border border-line bg-raised px-4 py-2.5 text-[0.88rem] font-semibold shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)]"
        aria-label="Quick exit to the room (or press Escape twice)"
      >
        <Icon name="exit" size={16} /> Exit
      </button>

      <div className={cn("transition-[filter] duration-100", hidden && "discreet-blur")} aria-hidden={hidden || undefined}>
        {unlocked === null ? null : unlocked ? (
          children
        ) : (
          <PinGate
            hasPin={hasPin}
            onUnlock={() => {
              extend();
              setPassed(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

function PinGate({ hasPin, onUnlock }: { hasPin: boolean; onUnlock: () => void }) {
  const [pin, setPinValue] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const creating = !hasPin;

  const submit = useCallback(() => {
    if (pin.length < 4) return;
    setError(null);
    if (creating && first === null) {
      setFirst(pin);
      setPinValue("");
      return;
    }
    start(async () => {
      if (creating) {
        if (pin !== first) {
          setFirst(null);
          setPinValue("");
          return setError("Those didn't match. Start again.");
        }
        const r = await setPin(pin);
        if (!r.ok) return setError(r.error);
        return onUnlock();
      }
      const r = await verifyPin(pin);
      if (!r.ok) return setError(r.error);
      if (!r.data) {
        setPinValue("");
        return setError("Not that one.");
      }
      onUnlock();
    });
  }, [pin, first, creating, onUnlock]);

  useEffect(() => {
    if (pin.length === (creating ? 8 : 8)) submit();
  }, [pin, creating, submit]);

  const press = (d: string) => setPinValue((p) => (p.length < 8 ? p + d : p));

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 pt-16 text-center">
      <Icon name="lock" size={28} className="text-accent-ink" />
      <h1 className="display mt-4 text-[2.4rem]">{creating ? (first === null ? "Set your PIN" : "Once more") : "Your PIN"}</h1>
      <p className="mt-2 text-muted">{creating ? "Just yours. Your partner sets their own." : "After dark stays behind your own PIN."}</p>
      <div className="mt-8 flex h-6 items-center gap-3" aria-label={`${pin.length} digits entered`} role="status">
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <motion.span key={i} className={cn("h-3.5 w-3.5 rounded-full border-[1.5px] border-line-strong", i < pin.length && "bg-fg")} animate={error ? { x: [0, -6, 6, -3, 0] } : {}} />
        ))}
      </div>
      <AnimatePresence>{error ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 font-semibold text-accent-ink" role="alert">{error}</motion.p> : null}</AnimatePresence>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-6 w-full"
      >
        <label htmlFor="ad-pin" className="sr-only">
          PIN
        </label>
        <input id="ad-pin" inputMode="numeric" autoComplete="off" pattern="[0-9]*" value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 8))} className="sr-only" autoFocus />
        <div className="grid grid-cols-3 gap-3" aria-hidden>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" tabIndex={-1} onClick={() => press(d)} className="display h-16 rounded-full bg-raised text-[1.6rem] active:scale-95">
              {d}
            </button>
          ))}
          <button type="button" tabIndex={-1} onClick={() => setPinValue((p) => p.slice(0, -1))} className="flex h-16 items-center justify-center rounded-full text-muted">
            <Icon name="arrowLeft" size={20} />
          </button>
          <button type="button" tabIndex={-1} onClick={() => press("0")} className="display h-16 rounded-full bg-raised text-[1.6rem] active:scale-95">
            0
          </button>
          <span />
        </div>
        <Button type="submit" size="lg" variant="accent" className="mt-6 w-full" loading={pending} disabled={pin.length < 4}>
          {creating && first === null ? "Next" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
