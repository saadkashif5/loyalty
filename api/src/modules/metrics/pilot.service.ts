import { Business, DailyStat, LoyaltyCard, Stamp } from "@/models";
import { pakistanDay } from "@/services/stats.service";

const DAY_MS = 86_400_000;

function rate(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1000) / 10;
}

interface Totals {
  tapsVerified: number;
  tapsRejected: number;
  stamps: number;
  newCards: number;
  rewardsUnlocked: number;
  rewardsRedeemed: number;
}

const ZERO: Totals = {
  tapsVerified: 0,
  tapsRejected: 0,
  stamps: 0,
  newCards: 0,
  rewardsUnlocked: 0,
  rewardsRedeemed: 0,
};

/**
 * What the pilot is judged on, over the last `days` days: do taps work, do
 * people come back, do they use their rewards. Taps and counts come from the
 * daily counters; repeat visits from the stamps themselves.
 */
export async function getPilotMetrics(days: number, now: Date = new Date()) {
  const from = new Date(now.getTime() - days * DAY_MS);
  const fromDay = pakistanDay(from);

  const [rows, repeat, businesses] = await Promise.all([
    DailyStat.aggregate<Totals & { _id: unknown }>([
      { $match: { day: { $gte: fromDay } } },
      {
        $group: {
          _id: "$businessId",
          tapsVerified: { $sum: "$tapsVerified" },
          tapsRejected: { $sum: "$tapsRejected" },
          stamps: { $sum: "$stamps" },
          newCards: { $sum: "$newCards" },
          rewardsUnlocked: { $sum: "$rewardsUnlocked" },
          rewardsRedeemed: { $sum: "$rewardsRedeemed" },
        },
      },
    ]),
    // Cards stamped in the window, and how many of them on two or more days.
    Stamp.aggregate<{ _id: unknown; cards: number; returning: number }>([
      { $match: { createdAt: { $gte: from }, source: { $ne: "WELCOME" } } },
      {
        $group: {
          _id: {
            card: "$loyaltyCardId",
            business: "$businessId",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:00" } },
          },
        },
      },
      { $group: { _id: { card: "$_id.card", business: "$_id.business" }, days: { $sum: 1 } } },
      {
        $group: {
          _id: "$_id.business",
          cards: { $sum: 1 },
          returning: { $sum: { $cond: [{ $gte: ["$days", 2] }, 1, 0] } },
        },
      },
    ]),
    Business.find({ status: { $in: ["ACTIVE", "SUSPENDED"] } }).select("name contact.city"),
  ]);

  const statsOf = new Map(rows.map((r) => [String(r._id), r]));
  const repeatOf = new Map(repeat.map((r) => [String(r._id), r]));
  const total: Totals & { cards: number; returning: number } = { ...ZERO, cards: 0, returning: 0 };

  const perBusiness = businesses.map((b) => {
    const s = statsOf.get(b.id) ?? ZERO;
    const r = repeatOf.get(b.id) ?? { cards: 0, returning: 0 };
    for (const key of Object.keys(ZERO) as Array<keyof Totals>) total[key] += s[key];
    total.cards += r.cards;
    total.returning += r.returning;
    return {
      businessId: b.id as string,
      name: b.name,
      city: b.contact?.city ?? null,
      stamps: s.stamps,
      newCards: s.newCards,
      tapSuccessPercent: rate(s.tapsVerified, s.tapsVerified + s.tapsRejected),
      repeatPercent: rate(r.returning, r.cards),
      redemptionPercent: rate(s.rewardsRedeemed, s.rewardsUnlocked),
    };
  });

  const [cardsEver, activeCards] = await Promise.all([
    LoyaltyCard.estimatedDocumentCount(),
    LoyaltyCard.countDocuments({ lastStampAt: { $gte: from } }),
  ]);

  return {
    days,
    from,
    totals: {
      ...total,
      tapSuccessPercent: rate(total.tapsVerified, total.tapsVerified + total.tapsRejected),
      repeatPercent: rate(total.returning, total.cards),
      redemptionPercent: rate(total.rewardsRedeemed, total.rewardsUnlocked),
      cardsEver,
      activeCards,
    },
    businesses: perBusiness.sort((a, b) => b.stamps - a.stamps),
  };
}
