import { mongo } from "mongoose";
import { Business, CustomerConsent, LoyaltyCard, User } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { toPublicUser } from "@/modules/auth/auth.serializer";
import type { UpdateProfileInput } from "@taptapsell/validation";

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.phone === "") unset.phone = "";
  else if (input.phone !== undefined) set.phone = input.phone;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true, runValidators: true },
    );
    if (!user) throw ApiError.notFound("User not found");
    // Without a number, no business can message the customer on WhatsApp.
    if (input.phone === "") {
      await CustomerConsent.updateMany(
        { customerId: userId, whatsapp: true },
        { $set: { whatsapp: false, withdrawnAt: new Date() } },
      );
    }
    return toPublicUser(user);
  } catch (err) {
    if (err instanceof mongo.MongoServerError && err.code === 11000) {
      throw ApiError.conflict("That mobile number is already on another account.");
    }
    throw err;
  }
}

/** Every business the customer holds a card at, and whether each may use WhatsApp. */
export async function listConsents(customerId: string) {
  const [businessIds, consents] = await Promise.all([
    LoyaltyCard.distinct("businessId", { customerId }),
    CustomerConsent.find({ customerId }),
  ]);
  const businesses = await Business.find({ _id: { $in: businessIds } }).select("name");
  const byBusiness = new Map(consents.map((c) => [String(c.businessId), c]));
  return businesses.map((b) => ({
    businessId: b.id as string,
    business: b.name,
    whatsapp: byBusiness.get(b.id)?.whatsapp ?? false,
  }));
}

export async function setWhatsappConsent(customerId: string, businessId: string, allow: boolean) {
  if (!(await LoyaltyCard.exists({ customerId, businessId }))) {
    throw ApiError.notFound("You do not have a card at this business");
  }
  if (allow) {
    const user = await User.findById(customerId).select("phone");
    if (!user?.phone) throw ApiError.badRequest("Add your mobile number first.");
  }
  const now = new Date();
  const consent = await CustomerConsent.findOneAndUpdate(
    { customerId, businessId },
    {
      $set: allow
        ? { whatsapp: true, grantedAt: now, withdrawnAt: null }
        : { whatsapp: false, withdrawnAt: now },
    },
    { upsert: true, new: true },
  );
  return { businessId, whatsapp: consent.whatsapp };
}

/** How many customers of a business agreed to WhatsApp messages. */
export async function countWhatsappConsents(businessId: string) {
  return CustomerConsent.countDocuments({ businessId, whatsapp: true });
}
