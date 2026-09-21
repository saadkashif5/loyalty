import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";

declare module "express-serve-static-core" {
  interface Request {
    idempotencyKey?: string;
  }
}

// Required on sensitive writes (§57). The client generates one key per user
// intent, so a network retry replays the same key and cannot double-stamp.
export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction): void {
  const key = req.header("idempotency-key");

  if (!key || key.length < 8 || key.length > 128) {
    next(ApiError.badRequest("A valid Idempotency-Key header is required for this request"));
    return;
  }

  req.idempotencyKey = key;
  next();
}
