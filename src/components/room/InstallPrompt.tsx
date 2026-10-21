"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Mode = "android" | "ios" | null;

const KEY = "amah:install-dismissed";
const SNOOZE_DAYS = 14;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0);
    return Date.now() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad Safari: no install event, so we explain Share → Add to Home Screen instead. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/**
 * Invites people to add Amah to their home screen: it opens full-screen like an app, works offline,
 * and (on iPhone) it's the only way notifications can reach them. Snoozes for two weeks on "Not now".
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    if (standalone() || snoozed()) return;
    const pick = () => setMode((window as Window & { __amahInstall?: Event }).__amahInstall ? "android" : isIosSafari() ? "ios" : null);
    pick();
    const installed = () => setMode(null);
    window.addEventListener("amah:installable", pick);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("amah:installable", pick);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  function later() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // storage blocked: it'll ask again next visit
    }
    setMode(null);
  }

  async function install() {
    const e = (window as Window & { __amahInstall?: InstallEvent }).__amahInstall;
    if (!e) return setMode(null);
    await e.prompt();
    const { outcome } = await e.userChoice;
    (window as Window & { __amahInstall?: Event }).__amahInstall = undefined;
    if (outcome === "dismissed") later();
    else setMode(null);
  }

  return (
    <AnimatePresence>
      {mode ? (
        <motion.section
          aria-label="Install Amah"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="mt-6 flex flex-wrap items-center gap-4 rounded-[18px] border-[1.5px] border-line-strong bg-raised p-4 sm:flex-nowrap"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-accent text-on-accent">
            <Icon name="heart" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Put Amah on your home screen</p>
            {mode === "android" ? (
              <p className="text-[0.88rem] text-muted">It opens like an app, loads faster and can let you know when it&apos;s your turn.</p>
            ) : (
              <p className="text-[0.88rem] text-muted">
                Tap <span className="font-semibold text-fg">Share</span>{" "}
                <svg aria-label="(the square with an arrow)" role="img" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -translate-y-[2px]">
                  <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                </svg>{" "}
                at the bottom of Safari, then <span className="font-semibold text-fg">Add to Home Screen</span>. On iPhone, that&apos;s also how notifications work.
              </p>
            )}
          </div>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button variant="ghost" size="sm" onClick={later}>
              {mode === "ios" ? "Got it" : "Not now"}
            </Button>
            {mode === "android" ? (
              <Button size="sm" onClick={() => void install()}>
                Install
              </Button>
            ) : null}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
