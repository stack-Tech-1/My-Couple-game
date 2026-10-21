/**
 * Sentry. A DSN only lets you send error reports in (it can't read anything), so it's fine to
 * ship in the code. Reporting is on for the live site only (Vercel production), so local, preview
 * and test builds never send anything. NEXT_PUBLIC_SENTRY_DSN overrides the project;
 * NEXT_PUBLIC_SENTRY_ENABLED=1 forces it on (e.g. to try it locally).
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "https://e231512e309452110feb443a5044e260@o4512293119328256.ingest.de.sentry.io/4512293546491984";
export const SENTRY_ON = process.env.NEXT_PUBLIC_SENTRY_ENABLED === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
