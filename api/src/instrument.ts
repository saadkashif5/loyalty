import * as Sentry from "@sentry/node";
import { env } from "@/config/env";
import { scrubText, scrubUrl } from "@/utils/scrub";

// Imported first by server.ts so Sentry can hook modules as they load.
// Without SENTRY_DSN (development, tests) nothing is sent anywhere.
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Requests carry tokens, cookies and customer phone numbers; none of
    // them may leave the platform in an error report (§30, §45).
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
        delete event.request.query_string;
        if (event.request.url) event.request.url = scrubUrl(event.request.url);
      }
      delete event.user;
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubText(exception.value);
      }
      return event;
    },
  });
}
