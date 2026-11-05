import { Business, SupportAccess } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";

/** How long one support view lasts before it has to be started again. */
export const SUPPORT_VIEW_MINUTES = 30;
/** Pages kept per support view; enough for a session, bounded for the document. */
const MAX_VIEWS = 500;

const activeFilter = () => ({ endedAt: null, expiresAt: { $gt: new Date() } });

/**
 * Opens a read-only view of a business's dashboard for a platform team
 * member. Any view they already had open on it is ended first.
 */
export async function startSupportView(actorUserId: string, businessId: string, reason: string) {
  const business = await Business.findById(businessId).select("name");
  if (!business) throw ApiError.notFound("Business not found");

  await SupportAccess.updateMany(
    { userId: actorUserId, businessId, ...activeFilter() },
    { $set: { endedAt: new Date() } },
  );
  const grant = await SupportAccess.create({
    userId: actorUserId,
    businessId,
    reason,
    expiresAt: new Date(Date.now() + SUPPORT_VIEW_MINUTES * 60_000),
  });

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUPPORT_VIEW_STARTED,
    resourceType: "Business",
    resourceId: businessId,
    metadata: { reason, expiresAt: grant.expiresAt, grantId: grant.id },
  });

  return {
    id: grant.id,
    expiresAt: grant.expiresAt,
    dashboardUrl: `${env.DASHBOARD_URL}/b/${businessId}`,
  };
}

export async function endSupportView(actorUserId: string, businessId: string) {
  const grants = await SupportAccess.find({ userId: actorUserId, businessId, ...activeFilter() });
  if (grants.length === 0) return { ended: false };

  await SupportAccess.updateMany(
    { _id: { $in: grants.map((g) => g._id) } },
    { $set: { endedAt: new Date() } },
  );
  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUPPORT_VIEW_ENDED,
    resourceType: "Business",
    resourceId: businessId,
    metadata: { pagesViewed: grants.reduce((n, g) => n + g.views.length, 0) },
  });
  return { ended: true };
}

/** The open support view this person has on this business, if any. */
export function findActiveGrant(userId: string, businessId: string) {
  return SupportAccess.findOne({ userId, businessId, ...activeFilter() }).select(
    "_id expiresAt reason",
  );
}

/** Every business this person is currently viewing for support. */
export function listActiveGrants(userId: string) {
  return SupportAccess.find({ userId, ...activeFilter() })
    .select("businessId expiresAt reason")
    .populate("businessId");
}

/** Records one request made under a support view. Never fails the request. */
export function recordSupportView(grantId: unknown, method: string, path: string) {
  SupportAccess.updateOne(
    { _id: grantId },
    { $push: { views: { $each: [{ method, path, at: new Date() }], $slice: -MAX_VIEWS } } },
  ).catch(() => undefined);
}

/** Recent support views of a business, for its page in the console. */
export async function listSupportViews(businessId: string) {
  const grants = await SupportAccess.find({ businessId })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("userId", "name email");
  return grants.map((g) => ({
    id: g.id,
    by: g.userId,
    reason: g.reason,
    startedAt: g.createdAt,
    expiresAt: g.expiresAt,
    endedAt: g.endedAt,
    active: !g.endedAt && g.expiresAt > new Date(),
    pagesViewed: g.views.length,
  }));
}
