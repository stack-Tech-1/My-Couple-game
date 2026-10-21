"use client";

/**
 * Browser error tracking. The SDK is fetched only after the page has loaded, and only on the live
 * site, so nobody downloads it on the landing page's critical path.
 */
import { SENTRY_ON } from "./config";

type SentryModule = typeof import("@sentry/nextjs");
let ready: Promise<SentryModule | null> | null = null;

export function loadSentry(): Promise<SentryModule | null> {
  if (!SENTRY_ON) return Promise.resolve(null);
  ready ??= Promise.all([import("@sentry/nextjs"), import("./scrub")])
    .then(([Sentry, { baseOptions }]) => {
      Sentry.init(baseOptions);
      return Sentry;
    })
    .catch(() => null);
  return ready;
}

/** Report an error caught by an error boundary (or anywhere else). Never throws. */
export function reportError(error: unknown) {
  void loadSentry().then((S) => S?.captureException(error));
}
