import { Notification } from "@/models";
import { logger } from "@/config/logger";
import { NOTIFICATION_STATUS } from "@taptapsell/constants";

interface NotificationPayload {
  userId: string;
  type:
    | "STAMP_ADDED"
    | "REWARD_UNLOCKED"
    | "REWARD_EXPIRING"
    | "REWARD_REDEEMED"
    | "LOYALTY_MILESTONE"
    | "BUSINESS_ANNOUNCEMENT";
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Channel-agnostic entry point (§22). Persists the notification now; delivery is
 * handled by the push worker. Adding email/SMS/WhatsApp later means adding a
 * sender here, not changing every call site.
 */
export async function queueNotification(payload: NotificationPayload): Promise<void> {
  try {
    await Notification.create({ ...payload, status: NOTIFICATION_STATUS.PENDING });
  } catch (err) {
    // Never fail the business operation because a notification could not be queued.
    logger.error({ err, type: payload.type }, "Failed to queue notification");
  }
}
