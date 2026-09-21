import type { Types } from "mongoose";
import { AuditLog } from "@/models";
import { logger } from "@/config/logger";

export const AUDIT_ACTIONS = {
  BUSINESS_CREATED: "business.created",
  BUSINESS_UPDATED: "business.updated",
  BUSINESS_SUSPENDED: "business.suspended",
  BUSINESS_RESTORED: "business.restored",
  USER_SUSPENDED: "user.suspended",
  USER_RESTORED: "user.restored",
  BRANCH_CREATED: "branch.created",
  BRANCH_UPDATED: "branch.updated",
  MEMBER_INVITED: "member.invited",
  MEMBER_ROLE_CHANGED: "member.role_changed",
  MEMBER_DISABLED: "member.disabled",
  PROGRAM_CREATED: "program.created",
  PROGRAM_UPDATED: "program.updated",
  DEVICE_REGISTERED: "device.registered",
  DEVICE_ASSIGNED: "device.assigned",
  DEVICE_ACTIVATED: "device.activated",
  DEVICE_REVOKED: "device.revoked",
  DEVICE_REPLACED: "device.replaced",
  REWARD_CREATED: "reward.created",
  REWARD_UPDATED: "reward.updated",
  REDEMPTION_CREATED: "redemption.created",
  REDEMPTION_COMPLETED: "redemption.completed",
  STAMP_ISSUED_MANUAL: "stamp.issued_manual",
  SUSPICIOUS_STAMP_ATTEMPT: "stamp.suspicious_attempt",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

interface AuditEntry {
  actorUserId?: string | Types.ObjectId;
  actorRole?: string | null;
  businessId?: string | Types.ObjectId | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | Types.ObjectId;
  metadata?: Record<string, unknown>;
}

// Audit writes must never break the operation they are recording — a failed
// log is logged and swallowed rather than rolled back into the caller (§37).
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    logger.error({ err, action: entry.action }, "Failed to write audit log");
  }
}
