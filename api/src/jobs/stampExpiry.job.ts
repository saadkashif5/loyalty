import { LoyaltyCard, LoyaltyProgram, User } from "@/models";
import { logger } from "@/config/logger";
import { queueNotification } from "@/services/notification.service";
import { queueEmail } from "@/services/outbox.service";
import { DAY_MS, expireCardIfLapsed, stampExpiryDays } from "@/modules/loyalty/stampExpiry";

/** Customers are warned this many days before their stamps expire. */
const WARN_DAYS = 7;
const BATCH = 500;

function day(d: Date) {
  return d.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" });
}

async function tell(
  customerId: unknown,
  notification: {
    type: "STAMPS_EXPIRING" | "STAMPS_EXPIRED";
    title: string;
    body: string;
    data: Record<string, string>;
  },
  email: { subject: string; text: string },
) {
  await queueNotification({ userId: String(customerId), ...notification });
  const customer = await User.findById(customerId).select("email status notificationPreferences");
  if (customer?.status !== "ACTIVE" || customer.notificationPreferences?.email === false) return;
  try {
    await queueEmail({ to: customer.email, ...email });
  } catch (err) {
    // The in-app notification is already queued; email is best effort.
    logger.warn({ err }, "Stamp expiry email failed");
  }
}

/**
 * For programs whose stamps expire after a spell without visits: warns each
 * customer once, a week before, and empties cards that have lapsed. Safe to
 * run as often as wanted: the warning is claimed per card and per last
 * stamp, and the expiry is a conditional update.
 */
export async function runStampExpiryJob(now: Date = new Date()) {
  const programs = await LoyaltyProgram.find({ "settings.stampExpiryDays": { $gt: 0 } })
    .select("name settings businessId")
    .populate<{ businessId: { name: string } | null }>("businessId", "name");

  let warned = 0;
  let expired = 0;
  for (const program of programs) {
    const days = stampExpiryDays(program)!;
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const shop = program.businessId?.name ?? "the shop";

    const lapsed = await LoyaltyCard.find({
      programId: program._id,
      stampCount: { $gt: 0 },
      lastStampAt: { $lte: cutoff },
    })
      .select("_id customerId")
      .limit(BATCH);
    for (const card of lapsed) {
      const lost = await expireCardIfLapsed(card._id, program, now);
      if (!lost) continue;
      expired += 1;
      await tell(
        card.customerId,
        {
          type: "STAMPS_EXPIRED",
          title: "Your stamps expired",
          body: `${lost} stamp${lost === 1 ? "" : "s"} at ${shop} expired after ${days} days without a visit. Your next visit starts a new card.`,
          data: { loyaltyCardId: String(card._id) },
        },
        {
          subject: `Your stamps at ${shop} expired`,
          text: `${lost} stamp${lost === 1 ? "" : "s"} on your ${program.name} at ${shop} expired after ${days} days without a visit. Your next visit starts a new card.`,
        },
      );
    }

    const warnFrom = new Date(cutoff.getTime() + WARN_DAYS * DAY_MS);
    const soon = await LoyaltyCard.find({
      programId: program._id,
      stampCount: { $gt: 0 },
      lastStampAt: { $gt: cutoff, $lte: warnFrom },
    })
      .select("_id customerId stampCount lastStampAt expiryWarnedFor")
      .limit(BATCH);
    for (const card of soon) {
      const claimed = await LoyaltyCard.updateOne(
        {
          _id: card._id,
          lastStampAt: card.lastStampAt,
          expiryWarnedFor: { $ne: card.lastStampAt },
        },
        { $set: { expiryWarnedFor: card.lastStampAt } },
      );
      if (claimed.modifiedCount !== 1) continue;
      warned += 1;
      const expiresOn = day(new Date(card.lastStampAt!.getTime() + days * DAY_MS));
      await tell(
        card.customerId,
        {
          type: "STAMPS_EXPIRING",
          title: "Your stamps expire soon",
          body: `Your ${card.stampCount} stamp${card.stampCount === 1 ? "" : "s"} at ${shop} expire on ${expiresOn}. Visit before then to keep them.`,
          data: { loyaltyCardId: String(card._id) },
        },
        {
          subject: `Your stamps at ${shop} expire on ${expiresOn}`,
          text: `You have ${card.stampCount} stamp${card.stampCount === 1 ? "" : "s"} on your ${program.name} at ${shop}. Collect a stamp before ${expiresOn} to keep them.`,
        },
      );
    }
  }

  return { warned, expired };
}
