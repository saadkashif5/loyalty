import { AuditLog, Business, LoyaltyCard, NfcDevice, Stamp, User } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { BUSINESS_STATUS, DEVICE_STATUS, USER_STATUS } from "@taptapsell/constants";

export async function listBusinesses(options: { status?: string; page: number; limit: number }) {
  const filter = options.status ? { status: options.status } : {};

  const [items, total] = await Promise.all([
    Business.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    Business.countDocuments(filter),
  ]);

  return { items, total };
}

export async function setBusinessStatus(
  businessId: string,
  actorUserId: string,
  status: "ACTIVE" | "SUSPENDED",
  reason?: string,
) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound("Business not found");

  business.status = status;
  await business.save();

  // Suspension must also stop the hardware: an active stamper at a suspended
  // business would otherwise keep issuing valid stamps (§60).
  if (status === BUSINESS_STATUS.SUSPENDED) {
    await NfcDevice.updateMany(
      { businessId, status: DEVICE_STATUS.ACTIVE },
      { status: DEVICE_STATUS.SUSPENDED },
    );
  } else {
    await NfcDevice.updateMany(
      { businessId, status: DEVICE_STATUS.SUSPENDED },
      { status: DEVICE_STATUS.ACTIVE },
    );
  }

  await recordAudit({
    actorUserId,
    businessId,
    action:
      status === BUSINESS_STATUS.SUSPENDED
        ? AUDIT_ACTIONS.BUSINESS_SUSPENDED
        : AUDIT_ACTIONS.BUSINESS_RESTORED,
    resourceType: "Business",
    resourceId: businessId,
    metadata: { reason },
  });

  return business;
}

export async function listCustomers(options: { query?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (options.query) {
    const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    User.countDocuments(filter),
  ]);

  return { items, total };
}

export async function setUserStatus(
  userId: string,
  actorUserId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
  if (!user) throw ApiError.notFound("User not found");

  await recordAudit({
    actorUserId,
    action:
      status === USER_STATUS.SUSPENDED ? AUDIT_ACTIONS.USER_SUSPENDED : AUDIT_ACTIONS.USER_RESTORED,
    resourceType: "User",
    resourceId: userId,
    metadata: { status },
  });

  return user;
}

export async function listAuditLogs(options: { businessId?: string; page: number; limit: number }) {
  const filter = options.businessId ? { businessId: options.businessId } : {};

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate("actorUserId", "name email"),
    AuditLog.countDocuments(filter),
  ]);

  return { items, total };
}

export async function getPlatformOverview() {
  const [businesses, activeBusinesses, customers, devices, activeDevices, stamps, cards] =
    await Promise.all([
      Business.countDocuments(),
      Business.countDocuments({ status: BUSINESS_STATUS.ACTIVE }),
      User.countDocuments(),
      NfcDevice.countDocuments(),
      NfcDevice.countDocuments({ status: DEVICE_STATUS.ACTIVE }),
      Stamp.countDocuments(),
      LoyaltyCard.countDocuments(),
    ]);

  return { businesses, activeBusinesses, customers, devices, activeDevices, stamps, cards };
}
