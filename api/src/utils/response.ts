import type { Response } from "express";
import type { ApiSuccess } from "@taptapsell/types";

interface SendOptions {
  status?: number;
  meta?: ApiSuccess<unknown>["meta"];
}

export function sendSuccess<T>(res: Response, data: T, options: SendOptions = {}): void {
  const body: ApiSuccess<T> = { success: true, data };
  if (options.meta) body.meta = options.meta;
  res.status(options.status ?? 200).json(body);
}
