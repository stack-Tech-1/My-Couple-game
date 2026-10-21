"use client";

/**
 * Browser error tracking. The SDK is fetched only after the page has loaded, and only when a DSN
 * is configured, so nobody downloads it on the landing page's critical path.
 */
type SentryModule = typeof import("@sentry/nextjs");
let ready: Promise<SentryModule | null> | null = null;

export function loadSentry(): Promise<SentryModule | null> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return Promise.resolve(null);
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
