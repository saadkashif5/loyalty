// First: the tenant guard must be registered before any model is compiled.
import "@/models";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger, logSerializers } from "@/config/logger";
import { requestId } from "@/middleware/requestId";
import { clientIp } from "@/middleware/clientIp";
import { globalRateLimiter } from "@/middleware/rateLimit";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import apiRoutes from "@/routes";
import { jsonReplacer } from "@/models/serialize";

export function createApp(): Express {
  const app = express();

  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  // Strips secret and internal field names from every JSON response (models/serialize.ts).
  app.set("json replacer", jsonReplacer);

  // Not includeSubDomains: other services may share the parent domain.
  app.use(helmet({ strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: false } }));
  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(requestId);
  app.use(clientIp);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).correlationId,
      serializers: logSerializers,
      autoLogging: { ignore: (req) => req.url === "/health" },
    }),
  );
  app.use(globalRateLimiter);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1", apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
