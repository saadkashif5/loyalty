import * as Sentry from "@sentry/nextjs";

// Browser error tracking. Without NEXT_PUBLIC_SENTRY_DSN nothing is sent.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}
