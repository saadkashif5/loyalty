import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { Span } from "@opentelemetry/api";
import { env } from "@/config/env";
import { scrubUrl } from "@/utils/scrub";

// Request tracing (OpenTelemetry): where time goes in a request, across
// Express, MongoDB and Redis. Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set;
// any OTLP/HTTP collector works (Grafana Tempo, Honeycomb, Jaeger, Datadog).
// Spans never carry query strings, invitation tokens or database values.

const URL_ATTRIBUTES = ["http.target", "http.url", "url.full", "url.path", "url.query"];

/** The same scrubbing as the logs: no query string, no token in the path. */
function scrubSpan(span: Span, url: string | undefined) {
  if (!url) return;
  const clean = scrubUrl(url);
  for (const name of URL_ATTRIBUTES) span.setAttribute(name, name === "url.query" ? "" : clean);
}

export const tracingEnabled = Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT);

export function startTracing(serviceName: string): void {
  if (!tracingEnabled) return;
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: `${env.OTEL_SERVICE_NAME}-${serviceName}`,
      "deployment.environment.name": env.NODE_ENV,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT!.replace(/\/$/, "")}/v1/traces`,
    }),
    instrumentations: [
      new HttpInstrumentation({
        // Health checks would drown out real traffic.
        ignoreIncomingRequestHook: (req) => req.url === "/health",
        requestHook: (span, req) => {
          scrubSpan(span, "url" in req ? req.url : (req as { path?: string }).path);
        },
        headersToSpanAttributes: { client: { requestHeaders: [] }, server: { requestHeaders: [] } },
      }),
      new ExpressInstrumentation(),
      // Statements are recorded with their values replaced, never the values themselves.
      new MongoDBInstrumentation({ enhancedDatabaseReporting: false }),
      new IORedisInstrumentation({ dbStatementSerializer: (command) => command }),
    ],
  });
  sdk.start();
  const stop = () => {
    void sdk.shutdown().catch(() => undefined);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
