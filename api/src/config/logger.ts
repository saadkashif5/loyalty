import pino from "pino";
import { env, isProduction } from "./env";
import { scrubText, scrubUrl } from "@/utils/scrub";

interface LoggedRequest {
  id?: unknown;
  method?: string;
  url?: string;
}

// An allow-list, so a new header or field stays out of the logs until someone
// decides it belongs there. IP addresses and user agents are personal data.
export const logSerializers = {
  req: (req: LoggedRequest) => ({ id: req.id, method: req.method, url: scrubUrl(req.url ?? "") }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  err: (err: Error) => {
    const line = pino.stdSerializers.err(err);
    return { ...line, message: scrubText(line.message), stack: scrubText(line.stack) };
  },
};

// Structured logging (PRD §30, §45) — never log tokens, passwords, or full request bodies.
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : isProduction ? "info" : "debug",
  serializers: logSerializers,
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.code",
      "*.otp",
      "*.secret",
      "*.phone",
      "*.email",
    ],
    censor: "[REDACTED]",
  },
  transport: isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
