import * as Sentry from "@sentry/node";
import type { NextFunction, Request, Response } from "express";
import { Error as MongooseError } from "mongoose";
import { ZodError, z } from "zod";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";
import type { ApiError as ApiErrorBody } from "@taptapsell/types";

// Must be registered last. Ensures no stack trace / DB error ever reaches the client (§30, §62).
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    success: false,
    error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.originalUrl}` },
    correlationId: req.correlationId,
  };
  res.status(404).json(body);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const apiError =
    err instanceof ApiError
      ? err
      : err instanceof ZodError
        ? ApiError.badRequest("Validation failed", z.flattenError(err))
        : err instanceof MongooseError.CastError
          ? ApiError.badRequest("Invalid id")
          : ApiError.internal();

  if (apiError.statusCode >= 500) {
    logger.error({ err, correlationId: req.correlationId, path: req.path }, "Unhandled error");
    // No-op unless Sentry was initialised (SENTRY_DSN set).
    Sentry.captureException(err, { tags: { correlationId: req.correlationId, path: req.path } });
  } else {
    logger.warn(
      { code: apiError.code, correlationId: req.correlationId, path: req.path },
      apiError.message,
    );
  }

  const body: ApiErrorBody = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
    correlationId: req.correlationId,
  };

  res.status(apiError.statusCode).json(body);
}
