import type { Instrumentation } from "next";

/**
 * Server-side error tracking (Sentry). Off until NEXT_PUBLIC_SENTRY_DSN is set, and only loaded
 * then, so a build without it carries none of the SDK.
 */
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  const { baseOptions } = await import("@/lib/monitoring/scrub");
  Sentry.init(baseOptions);
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
