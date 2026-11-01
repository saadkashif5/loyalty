import { isTest } from "@/config/env";
import { logger } from "@/config/logger";
import { OutboxMessage } from "@/models";
import { OUTBOX_STATUS } from "@/models/OutboxMessage";
import { sendEmail, type EmailMessage } from "@/services/email.service";
import { scrubText } from "@/utils/scrub";

const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 30_000;
/** A worker that died mid-send leaves a claim behind; another picks it up after this. */
const CLAIM_TIMEOUT_MS = 5 * 60_000;

/**
 * Queues an email for the worker, so a slow or failing mail server never holds
 * up a request. Delivery is at least once: a crash after sending and before
 * marking sent repeats the email. Sign-in codes do not use this; the person is
 * waiting for them, and an emailed code that arrives late is useless.
 */
export async function queueEmail(message: EmailMessage): Promise<void> {
  // Tests read the mail straight after the action that sent it.
  if (isTest) {
    await sendEmail(message);
    return;
  }
  await OutboxMessage.create({ kind: "EMAIL", payload: message });
}

async function claimNext(now: Date) {
  return OutboxMessage.findOneAndUpdate(
    {
      $or: [
        { status: OUTBOX_STATUS.PENDING, nextAttemptAt: { $lte: now } },
        {
          status: OUTBOX_STATUS.SENDING,
          claimedAt: { $lte: new Date(now.getTime() - CLAIM_TIMEOUT_MS) },
        },
      ],
    },
    { $set: { status: OUTBOX_STATUS.SENDING, claimedAt: now }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, new: true },
  );
}

/** Sends everything due. Safe with several workers: each message is claimed atomically. */
export async function processOutbox(now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (;;) {
    const message = await claimNext(now);
    if (!message) return sent;

    try {
      await sendEmail(message.payload as EmailMessage);
      await OutboxMessage.updateOne(
        { _id: message._id },
        { $set: { status: OUTBOX_STATUS.SENT, sentAt: new Date(), claimedAt: null } },
      );
      sent += 1;
    } catch (err) {
      const giveUp = message.attempts >= MAX_ATTEMPTS;
      logger.error(
        { err, id: String(message._id), attempts: message.attempts },
        "Outbox send failed",
      );
      await OutboxMessage.updateOne(
        { _id: message._id },
        {
          $set: {
            status: giveUp ? OUTBOX_STATUS.DEAD : OUTBOX_STATUS.PENDING,
            claimedAt: null,
            nextAttemptAt: new Date(now.getTime() + BASE_DELAY_MS * 2 ** message.attempts),
            lastError: scrubText(String(err)).slice(0, 500),
          },
        },
      );
    }
  }
}
