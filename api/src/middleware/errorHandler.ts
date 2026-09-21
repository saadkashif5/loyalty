import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const apiError =
    err instanceof ApiError
      ? err
      : err instanceof ZodError
        ? ApiError.badRequest("Validation failed", err.flatten())
        : ApiError.internal();

  if (apiError.statusCode >= 500) {
    logger.error({ err, correlationId: req.correlationId, path: req.path }, "Unhandled error");
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
