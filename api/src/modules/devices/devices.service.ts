import { Types } from "mongoose";
import { Branch, Business, NfcDevice } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { cached } from "@/services/cache.service";
import { assertWithinPlan } from "@/modules/billing/entitlements.service";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { generateActivationCode, generateDeviceIdentifier } from "@/utils/codes";
import { BUSINESS_STATUS, DEVICE_STATUS, type TagType } from "@taptapsell/constants";
import type {
  ReportDeviceProblemInput,
  ActivateDeviceInput,
  AssignDeviceInput,
  RegisterDeviceInput,
} from "@taptapsell/validation";

// Platform-side: mint blank stampers before they are shipped to a business.
export async function registerDevices(actorUserId: string, input: RegisterDeviceInput) {
  const devices = [];

  for (let i = 0; i < input.quantity; i += 1) {
    const device = await NfcDevice.create({
      deviceIdentifier: generateDeviceIdentifier(),
      activationCode: generateActivationCode(),
      deviceType: input.deviceType,
      tagType: input.tagType,
      metadata: input.metadata ?? {},
      status: DEVICE_STATUS.UNASSIGNED,
    });
    devices.push(device);

    await recordAudit({
      actorUserId,
      action: AUDIT_ACTIONS.DEVICE_REGISTERED,
      resourceType: "NfcDevice",
      resourceId: device._id,
    });
  }

  // Activation codes are returned only here, at mint time, so they can be
  // printed/shipped with the hardware. They are never readable again.
  return NfcDevice.find({ _id: { $in: devices.map((d) => d._id) } }).select("+activationCode");
}

export async function assignDevice(
  deviceId: string,
  actorUserId: string,
  input: AssignDeviceInput,
) {
  const device = await NfcDevice.findById(deviceId);
  if (!device) throw ApiError.notFound("Device not found");

  if (device.status === DEVICE_STATUS.REVOKED || device.status === DEVICE_STATUS.REPLACED) {
    throw ApiError.badRequest("A revoked or replaced device cannot be reassigned");
  }

  const branch = await Branch.findOne({ _id: input.branchId, businessId: input.businessId });
  if (!branch) throw ApiError.badRequest("Branch does not belong to the specified business");

  device.businessId = branch.businessId;
  device.branchId = branch._id;
  device.status = DEVICE_STATUS.ASSIGNED;
  await device.save();

  await recordAudit({
    actorUserId,
    businessId: input.businessId,
    action: AUDIT_ACTIONS.DEVICE_ASSIGNED,
    resourceType: "NfcDevice",
    resourceId: device._id,
    metadata: { branchId: input.branchId },
  });

  return device;
}

// Business-side: the owner activates the physical stamper once it arrives,
// using the code printed with it. Moves ASSIGNED -> ACTIVE (§39).
export async function activateDevice(
  businessId: string,
  actorUserId: string,
  input: ActivateDeviceInput,
) {
  const device = await NfcDevice.findOne({
    deviceIdentifier: input.deviceIdentifier,
  }).select("+activationCode");

  if (!device || device.activationCode !== input.activationCode) {
    throw ApiError.badRequest("Invalid device identifier or activation code");
  }

  // A device assigned to another business must never be activatable here.
  if (device.businessId && device.businessId.toString() !== businessId) {
    throw ApiError.forbidden("This device is assigned to a different business");
  }
  if (device.status === DEVICE_STATUS.REVOKED || device.status === DEVICE_STATUS.REPLACED) {
    throw ApiError.badRequest("This device has been revoked and cannot be activated");
  }

  const branch = await Branch.findOne({ _id: input.branchId, businessId });
  if (!branch) throw ApiError.badRequest("Branch does not belong to your business");

  if (device.status !== DEVICE_STATUS.ACTIVE) await assertWithinPlan(businessId, "stampers");

  device.businessId = branch.businessId;
  device.branchId = branch._id;
  device.status = DEVICE_STATUS.ACTIVE;
  device.activationCode = undefined;
  await device.save();

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.DEVICE_ACTIVATED,
    resourceType: "NfcDevice",
    resourceId: device._id,
    metadata: { branchId: input.branchId },
  });

  return device;
}

export async function listDevices(businessId: string, branchIds: string[] = []) {
  const filter: Record<string, unknown> = { businessId };
  if (branchIds.length) filter.branchId = { $in: branchIds };
  return NfcDevice.find(filter).populate("branchId", "name").sort({ createdAt: -1 });
}

export async function revokeDevice(
  businessId: string,
  deviceId: string,
  actorUserId: string,
  reason?: string,
) {
  const device = await NfcDevice.findOne({ _id: deviceId, businessId });
  if (!device) throw ApiError.notFound("Device not found");

  device.status = DEVICE_STATUS.REVOKED;
  device.revokedAt = new Date();
  await device.save();

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.DEVICE_REVOKED,
    resourceType: "NfcDevice",
    resourceId: deviceId,
    metadata: { reason },
  });

  return device;
}

// Replacement keeps loyalty history intact: the old device stops issuing stamps
// but its past stamps remain attributed to it (§61).
export async function replaceDevice(businessId: string, oldDeviceId: string, actorUserId: string) {
  const oldDevice = await NfcDevice.findOne({ _id: oldDeviceId, businessId });
  if (!oldDevice) throw ApiError.notFound("Device not found");

  const newDevice = await NfcDevice.create({
    deviceIdentifier: generateDeviceIdentifier(),
    activationCode: generateActivationCode(),
    deviceType: oldDevice.deviceType,
    tagType: oldDevice.tagType,
    businessId: oldDevice.businessId,
    branchId: oldDevice.branchId,
    status: DEVICE_STATUS.ASSIGNED,
  });

  oldDevice.status = DEVICE_STATUS.REPLACED;
  oldDevice.replacedByDeviceId = newDevice._id;
  oldDevice.revokedAt = new Date();
  await oldDevice.save();

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.DEVICE_REPLACED,
    resourceType: "NfcDevice",
    resourceId: oldDeviceId,
    metadata: { replacedByDeviceId: newDevice._id.toString() },
  });

  return NfcDevice.findById(newDevice._id).select("+activationCode");
}

interface ResolvedDevice {
  deviceId: string;
  businessId: string;
  branchId: string;
  tagType: TagType;
  tagUid: string | null;
}

// Short, as a backstop: revocations clear these entries as they happen (see NfcDevice).
const DEVICE_CACHE_SECONDS = 30;

// Called on every stamp attempt. The tag identifier alone proves nothing —
// this is where device status, business status, and branch binding are checked
// server-side before any stamp can be written (§10.3, §13.1).
export async function resolveDeviceForStamping(deviceIdentifier: string): Promise<ResolvedDevice> {
  const device = await cached(`device:${deviceIdentifier}`, DEVICE_CACHE_SECONDS, async () => {
    const found = await NfcDevice.findOne({ deviceIdentifier }).select(
      "status businessId branchId tagType tagUid",
    );
    return (
      found && {
        deviceId: found._id.toString(),
        status: found.status,
        businessId: found.businessId?.toString() ?? null,
        branchId: found.branchId?.toString() ?? null,
        tagType: found.tagType as TagType,
        tagUid: found.tagUid ?? null,
      }
    );
  });

  if (!device) {
    throw ApiError.notFound("This stamper is not recognised.");
  }
  if (device.status !== DEVICE_STATUS.ACTIVE) {
    throw ApiError.badRequest("This stamper is currently inactive. Please contact the business.");
  }
  if (!device.businessId || !device.branchId) {
    throw ApiError.badRequest("This stamper is not yet set up. Please contact the business.");
  }

  const businessStatus = await cached(
    `business-status:${device.businessId}`,
    DEVICE_CACHE_SECONDS,
    async () => (await Business.findById(device.businessId).select("status"))?.status ?? null,
  );
  if (businessStatus !== BUSINESS_STATUS.ACTIVE) {
    throw ApiError.badRequest("This business is not currently accepting stamps.");
  }

  return {
    deviceId: device.deviceId,
    businessId: device.businessId,
    branchId: device.branchId,
    tagType: device.tagType,
    tagUid: device.tagUid,
  };
}

/**
 * Any staff member can report a stamper problem. A lost stamper is revoked
 * immediately (someone else may be holding it); damage or faults are recorded
 * for the owner or manager to act on.
 */
export async function reportDeviceProblem(
  businessId: string,
  deviceId: string,
  actorUserId: string,
  input: ReportDeviceProblemInput,
  branchScope: string[] = [],
) {
  const filter: Record<string, unknown> = { _id: deviceId, businessId };
  if (branchScope.length) filter.branchId = { $in: branchScope };

  const device = await NfcDevice.findOne(filter);
  if (!device) throw ApiError.notFound("Device not found");

  device.lastProblem = {
    reason: input.reason,
    note: input.note,
    reportedBy: new Types.ObjectId(actorUserId),
    at: new Date(),
  };
  if (input.reason === "LOST" && device.status !== DEVICE_STATUS.REPLACED) {
    device.status = DEVICE_STATUS.REVOKED;
    device.revokedAt = new Date();
  }
  await device.save();

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.DEVICE_PROBLEM_REPORTED,
    resourceType: "NfcDevice",
    resourceId: device._id,
    metadata: { reason: input.reason, note: input.note, revoked: input.reason === "LOST" },
  });

  return device;
}
