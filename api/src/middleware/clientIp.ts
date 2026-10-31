import crypto from "node:crypto";
import { isIP } from "node:net";
import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env";

declare module "express-serve-static-core" {
  interface Request {
    /** The end user's IP address, used for rate limits and session records. */
    clientIp: string;
    /** The end user's browser, for session records. */
    clientUserAgent?: string;
  }
}

function secretMatches(provided: string | undefined): boolean {
  if (!env.INTERNAL_API_SECRET || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(env.INTERNAL_API_SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The dashboard and admin console call the API from their own servers, so
 * req.ip is the server's address for every user — every owner would share
 * one rate-limit bucket. Those servers pass the user's address in
 * X-Client-IP together with a shared secret; anyone else's X-Client-IP is
 * ignored, so a client calling the API directly cannot pick its own address.
 */
export function clientIp(req: Request, _res: Response, next: NextFunction): void {
  const trusted = secretMatches(req.header("x-internal-secret"));
  const forwarded = req.header("x-client-ip")?.trim();

  req.clientIp = trusted && forwarded && isIP(forwarded) ? forwarded : (req.ip ?? "unknown");
  req.clientUserAgent = trusted
    ? (req.header("x-client-user-agent")?.slice(0, 300) ?? req.header("user-agent"))
    : req.header("user-agent");
  next();
}
