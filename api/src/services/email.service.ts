import nodemailer, { type Transporter } from "nodemailer";
import { env, isTest } from "@/config/env";
import { logger } from "@/config/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Messages "sent" with the log transport, so tests can read sign-in codes.
const outbox: EmailMessage[] = [];

export function testOutbox(): EmailMessage[] {
  return outbox;
}

let transporter: Transporter | null = null;

/**
 * The one place email leaves the platform. SMTP works with any provider;
 * the log transport is for development and tests only — staging and
 * production refuse to start without SMTP (config/env.ts).
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.EMAIL_TRANSPORT === "smtp" && env.SMTP_URL) {
    transporter ??= nodemailer.createTransport(env.SMTP_URL);
    await transporter.sendMail({ from: env.EMAIL_FROM, ...message });
    return;
  }

  outbox.push(message);
  if (outbox.length > 100) outbox.shift();
  if (!isTest) {
    logger.info(
      { to: message.to, subject: message.subject },
      `Email not sent (development):\n${message.text}`,
    );
  }
}
