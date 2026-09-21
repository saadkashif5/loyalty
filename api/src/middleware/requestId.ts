import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

declare module "express-serve-static-core" {
  interface Request {
    correlationId: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-correlation-id");
  req.correlationId = incoming && incoming.length <= 100 ? incoming : uuidv4();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}
