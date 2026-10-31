import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    correlationId: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-correlation-id");
  req.correlationId = incoming && incoming.length <= 100 ? incoming : randomUUID();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}
