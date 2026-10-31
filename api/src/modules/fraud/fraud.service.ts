import { FraudFlag } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import type { ReviewFraudFlagInput } from "@taptapsell/validation";

/** Alerts for one business, or (without businessId) the whole platform. */
export async function listFlags(options: { businessId?: string; status?: string; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (options.businessId) filter.businessId = options.businessId;
  if (options.status && options.status !== "ALL") filter.status = options.status;

  return FraudFlag.find(filter)
    .sort({ lastSeenAt: -1 })
    .limit(options.limit ?? 100)
    .populate("deviceId", "deviceIdentifier")
    .populate("staffUserId", "name email")
    .populate("businessId", "name");
}

export async function reviewFlag(
  businessId: string,
  flagId: string,
  actorUserId: string,
  input: ReviewFraudFlagInput,
) {
  const flag = await FraudFlag.findOneAndUpdate(
    { _id: flagId, businessId },
    {
      $set: {
        status: input.status,
        reviewedBy: actorUserId,
        reviewedAt: new Date(),
        reviewNote: input.note,
      },
    },
    { new: true },
  );
  if (!flag) throw ApiError.notFound("Alert not found");

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.FRAUD_FLAG_REVIEWED,
    resourceType: "FraudFlag",
    resourceId: flagId,
    metadata: { type: flag.type, status: input.status },
  });

  return flag;
}
