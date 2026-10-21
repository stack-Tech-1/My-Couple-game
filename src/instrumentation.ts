import type { Instrumentation } from "next";
import { SENTRY_ON } from "@/lib/monitoring/config";

/**
 * Server-side error tracking (Sentry). Live site only (see lib/monitoring/config), and the SDK is
 * only loaded then.
 */
export async function register() {
  if (!SENTRY_ON) return;
  const Sentry = await import("@sentry/nextjs");
  const { baseOptions } = await import("@/lib/monitoring/scrub");
  Sentry.init(baseOptions);
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!SENTRY_ON) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
