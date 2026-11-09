import {
  BusinessMember,
  LoyaltyCard,
  Notification,
  OtpChallenge,
  PasswordReset,
  Redemption,
  Stamp,
  User,
} from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { sendEmail } from "@/services/email.service";
import { revokeAllUserSessions } from "@/modules/auth/token.service";
import { runAcrossTenants } from "@/models/tenantGuard";
import { MEMBER_STATUS, REDEMPTION_STATUS, USER_STATUS } from "@taptapsell/constants";
import { BRAND } from "@taptapsell/brand";

/** Everything the platform holds about a customer, in one file they can keep. */
export async function exportAccount(userId: string) {
  return runAcrossTenants(async () => {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    const [cards, stamps, redemptions, notifications] = await Promise.all([
      LoyaltyCard.find({ customerId: userId })
        .populate("businessId", "name")
        .populate("programId", "name requiredStamps"),
      Stamp.find({ customerId: userId }).sort({ createdAt: -1 }).populate("businessId", "name"),
      Redemption.find({ customerId: userId })
        .sort({ createdAt: -1 })
        .populate("businessId", "name")
        .populate("rewardId", "name"),
      Notification.find({ userId }).sort({ createdAt: -1 }),
    ]);

    const name = (ref: unknown) => (ref as { name?: string } | null)?.name ?? null;
    return {
      exportedAt: new Date().toISOString(),
      account: {
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        createdAt: user.createdAt,
        notificationPreferences: user.notificationPreferences,
      },
      cards: cards.map((c) => ({
        business: name(c.businessId),
        program: name(c.programId),
        stampCount: c.stampCount,
        status: c.status,
        joinedAt: c.createdAt,
        lastStampAt: c.lastStampAt ?? null,
      })),
      stamps: stamps.map((s) => ({
        business: name(s.businessId),
        at: s.createdAt,
        source: s.source,
      })),
      rewards: redemptions.map((r) => ({
        business: name(r.businessId),
        reward: name(r.rewardId),
        status: r.status,
        at: r.createdAt,
      })),
      notifications: notifications.map((n) => ({ title: n.title, body: n.body, at: n.createdAt })),
    };
  });
}

/**
 * Deletes a customer account. The person's details are erased and they are
 * signed out everywhere. Their stamps stay, unnamed, because they are part of
 * each business's records and statistics; a card shows as "Deleted account".
 * Team members and business staff must be removed from those roles first.
 */
export async function deleteAccount(userId: string) {
  const user = await User.findById(userId).select("email name platformRole status");
  if (!user || user.status === USER_STATUS.DELETED) throw ApiError.notFound("User not found");
  if (user.platformRole) {
    throw ApiError.badRequest("Platform team accounts are removed by a Super Admin.");
  }
  const staff = await runAcrossTenants(() =>
    BusinessMember.exists({ userId, status: { $ne: MEMBER_STATUS.DISABLED } }),
  );
  if (staff) {
    throw ApiError.badRequest(
      "This account works at a business. Ask the owner to remove you first, then delete it.",
    );
  }

  const { email, name } = user;
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        status: USER_STATUS.DELETED,
        name: "Deleted account",
        email: `deleted-${userId}@deleted.invalid`,
        "mfa.enabled": false,
      },
      $unset: {
        phone: "",
        passwordHash: "",
        avatar: "",
        emailVerifiedAt: "",
        "mfa.secret": "",
        "mfa.pendingSecret": "",
        "mfa.recoveryCodeHashes": "",
      },
    },
  );
  await revokeAllUserSessions(userId);
  await runAcrossTenants(() =>
    Promise.all([
      Redemption.updateMany(
        { customerId: userId, status: REDEMPTION_STATUS.PENDING },
        { $set: { status: REDEMPTION_STATUS.CANCELLED } },
      ),
      Notification.deleteMany({ userId }),
      OtpChallenge.deleteMany({ email }),
      PasswordReset.deleteMany({ userId }),
    ]),
  );

  await recordAudit({
    actorUserId: userId,
    action: AUDIT_ACTIONS.USER_DELETED,
    resourceType: "User",
    resourceId: userId,
  });
  await sendEmail({
    to: email,
    subject: `Your ${BRAND.name} account was deleted`,
    text: [
      `Hi ${name},`,
      "",
      `Your ${BRAND.name} account and your loyalty cards have been deleted, as you asked.`,
      "You can join again any time by tapping a stamper.",
    ].join("\n"),
  }).catch(() => undefined);
}
