import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Error reports must not carry personal data (see the Privacy Policy): no emails, no IPs, no
 * request bodies, no message text, and no one-time tokens that appear in URLs.
 */
const TOKEN_PARAMS = /([?&](?:t|token|token_hash|code|access_token|refresh_token)=)[^&#\s]*/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const scrubText = (s: string) => s.replace(TOKEN_PARAMS, "$1[filtered]").replace(EMAIL, "[email]");

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) event.request.headers = { "user-agent": event.request.headers["user-agent"] ?? "" };
    if (event.request.url) event.request.url = scrubText(event.request.url);
    if (event.request.query_string) event.request.query_string = "[filtered]";
  }
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrubText(ex.value);
  event.breadcrumbs = event.breadcrumbs
    // Typed input and console output can contain anything someone wrote: drop them.
    ?.filter((b) => b.category !== "ui.input" && b.category !== "console")
    .map((b) => ({ ...b, message: b.message ? scrubText(b.message) : b.message, data: b.data?.url ? { ...b.data, url: scrubText(String(b.data.url)) } : undefined }));
  return event;
}

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
export const baseOptions = {
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  environment: process.env.AMAH_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
  sendDefaultPii: false,
  // Errors only: no performance tracing or session replay (keeps it free-tier friendly and light).
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
};
