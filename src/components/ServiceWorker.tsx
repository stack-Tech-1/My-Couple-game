"use client";

import { useEffect } from "react";
import { loadSentry } from "@/lib/monitoring/client";
import { SENTRY_ON } from "@/lib/monitoring/config";

/** Registers the service worker in production builds only (dev caching would just get in the way). */
export function ServiceWorker() {
  // Chrome/Android announce installability once, often before any component that wants it has
  // mounted, so it's caught here (on every page) and kept for the install prompt.
  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault();
      (window as Window & { __amahInstall?: Event }).__amahInstall = e;
      window.dispatchEvent(new Event("amah:installable"));
    };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);

  // Error tracking starts once the page is idle (and only if configured), off the critical path.
  useEffect(() => {
    if (!SENTRY_ON) return;
    const start = () => void loadSentry();
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (ric) ric(start);
    else setTimeout(start, 2000);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}