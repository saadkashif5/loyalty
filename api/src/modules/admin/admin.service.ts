import { afterCursor, sortFor, toPage, type CursorRequest } from "@/utils/cursor";
import {
  AuditLog,
  Branch,
  Business,
  BusinessMember,
  LoyaltyCard,
  NfcDevice,
  Redemption,
  Stamp,
  Subscription,
  User,
} from "@/models";
import { isValidObjectId } from "mongoose";
import { env } from "@/config/env";
import { listSupportViews } from "@/modules/support/support.service";
import { listInvitations } from "@/modules/invitations/invitations.service";
import { applyBusinessStatus } from "@/modules/businesses/businesses.service";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { revokeAllUserSessions } from "@/modules/auth/token.service";
import { BUSINESS_STATUS, DEVICE_STATUS, USER_STATUS } from "@taptapsell/constants";
import type { AddTeamMemberInput, UpdateTeamMemberInput } from "@taptapsell/validation";

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listBusinesses(options: {
  status?: string;
  query?: string;
  /** Plan code, e.g. "GROWTH". */
  plan?: string;
  city?: string;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;
  if (options.query) {
    // Escaped so search text cannot be injected as a regex.
    const pattern = { $regex: escapeRegex(options.query), $options: "i" };
    filter.$or = [{ name: pattern }, { slug: pattern }, { "contact.phone": pattern }];
  }
  if (options.city) {
    filter["contact.city"] = { $regex: `^${escapeRegex(options.city.trim())}$`, $options: "i" };
  }
  if (options.plan) {
    filter._id = {
      $in: await Subscription.distinct("businessId", { "plan.code": options.plan.toUpperCase() }),
    };
  }

  const [businesses, total] = await Promise.all([
    Business.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    Business.countDocuments(filter),
  ]);

  const subscriptions = await Subscription.find({
    businessId: { $in: businesses.map((b) => b._id) },
  }).select("businessId plan.code plan.name status");
  const planOf = new Map(subscriptions.map((s) => [String(s.businessId), s]));
  const items = businesses.map((b) => {
    const sub = planOf.get(b.id);
    return {
      ...b.toObject(),
      plan: sub ? { code: sub.plan.code, name: sub.plan.name, status: sub.status } : null,
    };
  });

  return { items, total };
}

/** Distinct cities on file, for the console's filter list. */
export async function listBusinessCities(): Promise<string[]> {
  const cities = (await Business.distinct("contact.city")) as Array<string | null>;
  const seen = new Map<string, string>();
  for (const city of cities) {
    if (city && !seen.has(city.toLowerCase())) seen.set(city.toLowerCase(), city);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export async function setBusinessStatus(
  businessId: string,
  actorUserId: string,
  status: "ACTIVE" | "SUSPENDED",
  reason?: string,
) {
  const business = await applyBusinessStatus(businessId, status, { kind: "ADMIN", reason });

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

export async function listCustomers(options: { query?: string } & CursorRequest) {
  const filter: Record<string, unknown> = {};
  if (options.query) {
    const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const rows = await User.find(afterCursor(filter, "createdAt", options.cursor))
    .sort(sortFor("createdAt"))
    .limit(options.limit + 1);
  return toPage(rows, options.limit, "createdAt");
}

export async function setUserStatus(
  userId: string,
  actorUserId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  if (userId === actorUserId) throw ApiError.forbidden("You cannot change your own account status");

  const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
  if (!user) throw ApiError.notFound("User not found");

  // A suspended user is refused on every request already; ending their
  // sessions also stops them refreshing once suspension is lifted.
  if (status === USER_STATUS.SUSPENDED) await revokeAllUserSessions(userId);

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

export interface AuditFilters {
  businessId?: string;
  /** An exact action ("device.revoked") or a family ending in a dot ("device."). */
  action?: string;
  /** Email of the person who acted. */
  actor?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(options: AuditFilters & CursorRequest) {
  const filter: Record<string, unknown> = {};
  if (options.businessId) {
    if (!isValidObjectId(options.businessId)) throw ApiError.badRequest("Invalid business id");
    filter.businessId = options.businessId;
  }
  if (options.action) {
    filter.action = options.action.endsWith(".")
      ? { $regex: `^${escapeRegex(options.action)}` }
      : options.action;
  }
  if (options.actor) {
    const actor = await User.findOne({ email: options.actor.trim().toLowerCase() }).select("_id");
    // An unknown email matches nothing rather than everything.
    if (!actor) return { items: [], nextCursor: null };
    filter.actorUserId = actor._id;
  }
  if (options.from || options.to) {
    filter.createdAt = {
      ...(options.from ? { $gte: options.from } : {}),
      ...(options.to ? { $lt: options.to } : {}),
    };
  }

  const rows = await AuditLog.find(afterCursor(filter, "createdAt", options.cursor))
    .sort(sortFor("createdAt"))
    .limit(options.limit + 1)
    .populate("actorUserId", "name email");
  return toPage(rows, options.limit, "createdAt");
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

/** Ends every session a user has, e.g. after a lost phone or a suspected compromise. */
export async function signOutUser(actorUserId: string, userId: string) {
  if (!(await User.exists({ _id: userId }))) throw ApiError.notFound("User not found");
  await revokeAllUserSessions(userId);

  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.USER_SIGNED_OUT,
    resourceType: "User",
    resourceId: userId,
  });
}

// ---- Platform team ---------------------------------------------------------

export async function listTeam() {
  const users = await User.find({ platformRole: { $ne: null } })
    .select("name email platformRole status mfa.enabled createdAt")
    .sort({ createdAt: 1 });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    platformRole: u.platformRole,
    status: u.status,
    mfaEnabled: Boolean(u.mfa?.enabled),
    createdAt: u.createdAt,
  }));
}

export async function addTeamMember(actorUserId: string, input: AddTeamMemberInput) {
  const user = await User.findOne({ email: input.email });
  if (!user)
    throw ApiError.notFound("No account exists with that email. Ask them to sign up first.");
  if (user.platformRole) throw ApiError.conflict("This person is already on the platform team");

  user.platformRole = input.platformRole;
  await user.save();

  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.PLATFORM_ROLE_CHANGED,
    resourceType: "User",
    resourceId: user._id,
    metadata: { from: null, to: input.platformRole },
  });

  return { id: user.id, email: user.email, platformRole: user.platformRole };
}

export async function updateTeamMember(
  actorUserId: string,
  userId: string,
  input: UpdateTeamMemberInput,
) {
  // Prevents a Super Admin from locking themselves (and possibly everyone) out.
  if (userId === actorUserId) throw ApiError.forbidden("You cannot change your own platform role");

  const user = await User.findOne({ _id: userId, platformRole: { $ne: null } });
  if (!user) throw ApiError.notFound("Team member not found");

  const from = user.platformRole;
  user.platformRole = input.platformRole;
  await user.save();

  // Removing someone from the team ends their sessions straight away.
  if (input.platformRole === null) await revokeAllUserSessions(userId);

  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.PLATFORM_ROLE_CHANGED,
    resourceType: "User",
    resourceId: userId,
    metadata: { from, to: input.platformRole },
  });

  return { id: user.id, email: user.email, platformRole: user.platformRole };
}

/** Everything the platform team needs on one business page. */
export async function getBusinessDetail(businessId: string) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound("Business not found");

  const [members, branches, devices, invitations, customers, stamps, redemptions] =
    await Promise.all([
      BusinessMember.find({ businessId }).populate("userId", "name email phone status"),
      Branch.find({ businessId }).sort({ createdAt: 1 }),
      NfcDevice.find({ businessId }).populate("branchId", "name").sort({ createdAt: -1 }),
      listInvitations(businessId),
      LoyaltyCard.countDocuments({ businessId }),
      Stamp.countDocuments({ businessId }),
      Redemption.countDocuments({ businessId }),
    ]);
  const supportViews = await listSupportViews(businessId);

  return {
    business,
    members,
    branches,
    devices,
    invitations,
    supportViews,
    dashboardUrl: `${env.DASHBOARD_URL}/b/${businessId}`,
    counts: { customers, stamps, redemptions },
  };
}

/** The whole stamper fleet, including stampers not yet assigned to anyone. */
export async function listDevices(options: {
  status?: string;
  businessId?: string;
  query?: string;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;
  if (options.businessId) filter.businessId = options.businessId;
  if (options.query)
    filter.deviceIdentifier = { $regex: escapeRegex(options.query), $options: "i" };

  const [items, total] = await Promise.all([
    NfcDevice.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate("businessId", "name")
      .populate("branchId", "name"),
    NfcDevice.countDocuments(filter),
  ]);

  return { items, total };
}

/**
 * Forgets the chip a stamper is bound to and its last tap counter, after the
 * tag is re-written or swapped for a new one. The next verified tap binds the
 * new chip. Until then any chip carrying this stamper's link would be
 * accepted once, so this is done just before the new tag goes in.
 */
export async function resetDeviceTag(actorUserId: string, deviceId: string, reason: string) {
  if (!isValidObjectId(deviceId)) throw ApiError.notFound("Stamper not found");
  const device = await NfcDevice.findById(deviceId);
  if (!device) throw ApiError.notFound("Stamper not found");
  if (device.status === DEVICE_STATUS.REVOKED || device.status === DEVICE_STATUS.REPLACED) {
    throw ApiError.badRequest("This stamper is retired. Use a new stamper instead.");
  }

  const previous = { tagUid: device.tagUid, lastTapCounter: device.lastTapCounter };
  device.tagUid = null;
  device.lastTapCounter = null;
  await device.save();

  await recordAudit({
    actorUserId,
    businessId: device.businessId ?? undefined,
    action: AUDIT_ACTIONS.DEVICE_TAG_RESET,
    resourceType: "NfcDevice",
    resourceId: device._id,
    metadata: { reason, ...previous },
  });

  return device;
}
