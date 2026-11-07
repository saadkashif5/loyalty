import { Redemption, User } from "@/models";
import { logger } from "@/config/logger";
import { queueNotification } from "@/services/notification.service";
import { queueEmail } from "@/services/outbox.service";
import { REDEMPTION_STATUS } from "@taptapsell/constants";
import { BRAND } from "@taptapsell/brand";

const REMIND_WITHIN_MS = 3 * 86_400_000;
const BATCH = 500;

interface PopulatedRedemption {
  _id: unknown;
  customerId: unknown;
  expiresAt: Date;
  rewardId: { name: string } | null;
  businessId: { name: string } | null;
}

/**
 * Marks unused rewards past their date as expired, and reminds customers once
 * when a reward has three days or less left. Safe to run as often as wanted
 * (e.g. hourly from a scheduler): each reminder is claimed atomically, so it
 * is sent at most once even if two runs overlap.
 */
export async function runRewardExpiryJob(now: Date = new Date()) {
  const expired = await Redemption.updateMany(
    { status: REDEMPTION_STATUS.PENDING, expiresAt: { $ne: null, $lte: now } },
    { $set: { status: REDEMPTION_STATUS.EXPIRED } },
  );

  const due = await Redemption.find({
    status: REDEMPTION_STATUS.PENDING,
    reminderSentAt: null,
    expiresAt: { $gt: now, $lte: new Date(now.getTime() + REMIND_WITHIN_MS) },
  })
    .limit(BATCH)
    .populate<{ rewardId: { name: string } | null }>("rewardId", "name")
    .populate<{ businessId: { name: string } | null }>("businessId", "name");

  let reminded = 0;
  for (const redemption of due as unknown as PopulatedRedemption[]) {
    const claimed = await Redemption.updateOne(
      { _id: redemption._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } },
    );
    if (claimed.modifiedCount !== 1) continue;

    const reward = redemption.rewardId?.name ?? "Your reward";
    const shop = redemption.businessId?.name ?? "the shop";
    const date = redemption.expiresAt.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" });

    await queueNotification({
      userId: String(redemption.customerId),
      type: "REWARD_EXPIRING",
      title: "Your reward expires soon",
      body: `${reward} at ${shop} can be used until ${date}.`,
      data: { redemptionId: String(redemption._id) },
    });

    const customer = await User.findById(redemption.customerId).select("email status");
    if (customer?.email && customer.status === "ACTIVE") {
      try {
        await queueEmail({
          to: customer.email,
          subject: `Use your reward at ${shop} by ${date}`,
          text: `${reward} at ${shop} is waiting for you. Show the code in your ${BRAND.name} card before ${date}.`,
        });
      } catch (err) {
        // The in-app notification is already queued; email is best effort.
        logger.warn({ err }, "Reward reminder email failed");
      }
    }
    reminded += 1;
  }

  return { expired: expired.modifiedCount, reminded };
}
