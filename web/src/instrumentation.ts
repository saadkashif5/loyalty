import * as Sentry from "@sentry/nextjs";

// Server and edge error tracking. Without SENTRY_DSN nothing is sent.
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Cookies hold the session tokens; they must never reach an error report.
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
