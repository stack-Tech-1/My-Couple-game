"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Data saver. Data is expensive, so on a metered or slow connection Amah:
 *  - records voice notes at a lower bitrate (about a third of the size),
 *  - uploads smaller photos,
 *  - waits for a tap before loading stickers and photos in the chat and Memory Lane.
 *
 * "auto" follows the phone: on when the browser reports Data Saver / Lite mode or a 2G-class
 * connection. The choice is per device (a laptop on Wi-Fi and a phone on data differ), so it lives
 * in localStorage.
 */
export type DataSaverPref = "auto" | "on" | "off";
const KEY = "amah:data-saver";
const EVENT = "amah:data-saver";

type NetInfo = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };
const connection = (): NetInfo | undefined => (typeof navigator !== "undefined" ? (navigator as Navigator & { connection?: NetInfo }).connection : undefined);

export function readPref(): DataSaverPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function autoDetected(): boolean {
  const c = connection();
  return !!c && (c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
}

export const isDataSaverOn = (pref = readPref()) => (pref === "auto" ? autoDetected() : pref === "on");

export function useDataSaver() {
  // Off until mounted, so server and first client render agree.
  const [pref, setPrefState] = useState<DataSaverPref>("auto");
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      const p = readPref();
      setPrefState(p);
      setActive(isDataSaverOn(p));
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    const c = connection();
    c?.addEventListener?.("change", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      c?.removeEventListener?.("change", sync);
    };
  }, []);

  const setPref = useCallback((p: DataSaverPref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    setPrefState(p);
    setActive(isDataSaverOn(p));
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { pref, active, auto: autoDetected(), setPref };
}

/** Voice note bitrate: speech stays clear at 16 kbps Opus/AAC. */
export const voiceBitrate = (saver: boolean) => (saver ? 16_000 : 48_000);
/** Longest photo edge for uploads. */
export const photoEdge = (saver: boolean) => (saver ? 1080 : 1600);
