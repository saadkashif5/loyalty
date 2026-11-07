import { afterCursor, sortFor, toPage, type CursorRequest } from "@/utils/cursor";
import { LoyaltyCard, Redemption, Stamp, User } from "@/models";
import { ApiError } from "@/utils/ApiError";

// Businesses see their customers' names, but contact details are masked by
// default (ROADMAP D2): enough to recognise someone at the counter, not enough
// to export a marketing list.
export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  return phone.length > 7 ? `${phone.slice(0, 4)}•••••${phone.slice(-4)}` : "•••••";
}

export function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 1)}•••@${domain}` : "•••";
}

interface PopulatedCustomer {
  _id: { toString(): string };
  name: string;
  phone?: string | null;
  email?: string | null;
}

function toCustomerView(customer: PopulatedCustomer | null) {
  if (!customer) return null;
  return {
    id: customer._id.toString(),
    name: customer.name,
    phone: maskPhone(customer.phone),
    email: maskEmail(customer.email),
  };
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One row per loyalty card at this business, most recently active first. */
export async function listBusinessCustomers(
  businessId: string,
  options: { query?: string } & CursorRequest,
) {
  const filter: Record<string, unknown> = { businessId };

  if (options.query) {
    // Search by name, or by the last digits of a phone number typed at the counter.
    // Only the last four digits are matched: those are already shown in the
    // masked number, so trying longer suffixes cannot reveal the hidden digits.
    const digits = options.query.replace(/\D/g, "");
    const phoneTail = digits.slice(-4);
    const matches = await User.find({
      $or: [
        { name: { $regex: escapeRegex(options.query), $options: "i" } },
        ...(phoneTail.length >= 3 ? [{ phone: { $regex: `${phoneTail}$` } }] : []),
      ],
    })
      .select("_id")
      .limit(500);
    filter.customerId = { $in: matches.map((u) => u._id) };
  }

  const rows = await LoyaltyCard.find(afterCursor(filter, "lastStampAt", options.cursor))
    .sort(sortFor("lastStampAt"))
    .limit(options.limit + 1)
    .populate<{ customerId: PopulatedCustomer | null }>("customerId", "name phone email")
    .populate<{ programId: { _id: unknown; name: string; requiredStamps: number } | null }>(
      "programId",
      "name requiredStamps",
    );
  const { items: cards, nextCursor } = toPage(rows, options.limit, "lastStampAt");

  const items = cards.map((card) => ({
    cardId: card._id.toString(),
    customer: toCustomerView(card.customerId),
    program: card.programId
      ? { name: card.programId.name, requiredStamps: card.programId.requiredStamps }
      : null,
    stampCount: card.stampCount,
    status: card.status,
    joinedAt: card.joinedAt,
    lastStampAt: card.lastStampAt ?? null,
  }));

  return { items, nextCursor };
}

/** A customer's history at this business only; nothing from other businesses. */
export async function getBusinessCustomer(businessId: string, customerId: string) {
  const cards = await LoyaltyCard.find({ businessId, customerId }).populate<{
    programId: { name: string; requiredStamps: number } | null;
  }>("programId", "name requiredStamps");
  // Without a card here, the customer does not exist as far as this business is concerned.
  if (cards.length === 0) throw ApiError.notFound("Customer not found");

  const [customer, stamps, redemptions] = await Promise.all([
    User.findById(customerId).select("name phone email"),
    Stamp.find({ businessId, customerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("branchId", "name"),
    Redemption.find({ businessId, customerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("rewardId", "name"),
  ]);

  return {
    customer: toCustomerView(customer as PopulatedCustomer | null),
    cards: cards.map((card) => ({
      cardId: card._id.toString(),
      program: card.programId
        ? { name: card.programId.name, requiredStamps: card.programId.requiredStamps }
        : null,
      stampCount: card.stampCount,
      status: card.status,
      joinedAt: card.joinedAt,
      lastStampAt: card.lastStampAt ?? null,
    })),
    stamps,
    redemptions,
  };
}
