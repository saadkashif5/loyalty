import { Business, LoyaltyProgram, NfcDevice } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { BUSINESS_STATUS, DEVICE_STATUS, PROGRAM_STATUS } from "@taptapsell/constants";

const PUBLIC_BUSINESS_FIELDS = "name slug description logo category contact.address";

export async function searchBusinesses(options: {
  query?: string;
  category?: string;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = { status: BUSINESS_STATUS.ACTIVE };

  if (options.category) filter.category = options.category;
  if (options.query) {
    // Escaped so a customer's search text cannot be injected as a regex.
    const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: escaped, $options: "i" };
  }

  const [items, total] = await Promise.all([
    Business.find(filter)
      .select(PUBLIC_BUSINESS_FIELDS)
      .sort({ name: 1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    Business.countDocuments(filter),
  ]);

  return { items, total };
}

export async function getPublicBusiness(businessId: string) {
  const business = await Business.findOne({
    _id: businessId,
    status: BUSINESS_STATUS.ACTIVE,
  }).select(PUBLIC_BUSINESS_FIELDS);

  if (!business) throw ApiError.notFound("Business not found");

  const now = new Date();
  const programs = await LoyaltyProgram.find({
    businessId,
    status: PROGRAM_STATUS.ACTIVE,
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gt: now } }],
  })
    .select("name description requiredStamps branding terms")
    .populate({ path: "rewards", match: { status: "ACTIVE" }, select: "name description type" });

  return { business, programs };
}

/**
 * Backs the QR landing URL printed on every stamper (§11). Returns only what an
 * unauthenticated visitor needs to decide whether to sign up and join — never
 * device secrets, and never anything that by itself authorises a stamp.
 */
export async function resolveStamperCode(deviceIdentifier: string) {
  const device = await NfcDevice.findOne({ deviceIdentifier }).select("businessId status");

  if (!device || device.status !== DEVICE_STATUS.ACTIVE || !device.businessId) {
    throw ApiError.notFound("This stamper is not recognised.");
  }

  return getPublicBusiness(device.businessId.toString());
}
