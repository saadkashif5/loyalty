import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";
import { Card, Notice, StampDots, formatDate } from "@/components/ui";
import { CounterCodePanel } from "@/components/CounterCodePanel";

interface CardDetail {
  card: {
    _id: string;
    stampCount: number;
    status: string;
    businessId: { name: string } | null;
    programId: { name: string; requiredStamps: number; terms?: string } | null;
    stampExpiryDays: number | null;
    stampsExpireAt: string | null;
    lastExpiry?: { at?: string; stamps?: number } | null;
  };
  recentStamps: Array<{ _id: string; createdAt: string; source: string }>;
  availableRewards: Array<{
    _id: string;
    redemptionCode: string;
    createdAt: string;
    expiresAt?: string | null;
    rewardId: { name: string; description?: string } | null;
  }>;
}

const RESULTS: Record<string, { tone: "success" | "info"; text: string }> = {
  stamped: { tone: "success", text: "Stamp added. Thank you for your visit!" },
  unlocked: { tone: "success", text: "You earned a reward! Show the code below at the counter." },
  joined: {
    tone: "info",
    text: "You are in! Tap the stamper again to collect your first stamp.",
  },
};

// Why a tap did not give a stamp, in the customer's terms.
const ERRORS: Record<string, string> = {
  STAMP_COOLDOWN: "You already got a stamp here a moment ago. One stamp per visit.",
  DAILY_STAMP_LIMIT: "You have collected today's stamps for this card. Come back tomorrow!",
  TAP_EXPIRED: "That tap expired. Tap the stamper again to collect your stamp.",
  TAP_ALREADY_USED: "That tap was already used. Tap the stamper again.",
  NOT_ENROLLED: "Join this shop's card first, then tap again.",
};

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ result?: string; error?: string }>;
}) {
  const { cardId } = await params;
  const { result, error } = await searchParams;
  const { card, recentStamps, availableRewards } = await apiFetch<CardDetail>(
    `/loyalty-cards/${cardId}`,
  );

  const rewards = await Promise.all(
    availableRewards.map(async (r) => ({
      ...r,
      qr: await QRCode.toDataURL(r.redemptionCode, { margin: 1, width: 160 }),
    })),
  );

  return (
    <>
      {result && RESULTS[result] ? (
        <Notice tone={RESULTS[result].tone}>{RESULTS[result].text}</Notice>
      ) : null}
      {error ? (
        <Notice tone="warning">
          {ERRORS[error] ?? "That stamp did not go through. Please tap the stamper again."}
        </Notice>
      ) : null}

      <Card className="space-y-4">
        <div>
          <p className="text-lg font-semibold">{card.businessId?.name}</p>
          <p className="text-sm text-slate-500">{card.programId?.name}</p>
        </div>
        {card.programId ? (
          <>
            <StampDots count={card.stampCount} required={card.programId.requiredStamps} />
            <p className="text-sm text-slate-600">
              {card.stampCount} of {card.programId.requiredStamps} stamps
            </p>
            {card.stampsExpireAt ? (
              <p className="text-xs text-slate-500">
                Stamps expire after {card.stampExpiryDays} days without a visit. Visit by{" "}
                {formatDate(card.stampsExpireAt)} to keep them.
              </p>
            ) : null}
            {card.stampCount === 0 && card.lastExpiry?.stamps ? (
              <p className="text-xs text-amber-700">
                {card.lastExpiry.stamps} stamp{card.lastExpiry.stamps === 1 ? "" : "s"} expired on{" "}
                {formatDate(card.lastExpiry.at)}. Your next visit starts a new card.
              </p>
            ) : null}
          </>
        ) : null}
      </Card>

      {card.status === "ACTIVE" ? <CounterCodePanel cardId={card._id} /> : null}

      {rewards.map((reward) => (
        <Card key={reward._id} className="space-y-3 border-brand-500 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Your reward</p>
          <p className="text-lg font-semibold">{reward.rewardId?.name ?? "Reward"}</p>
          {/* A data URL generated on the server; next/image adds nothing here. */}
          <img src={reward.qr} alt="" width={160} height={160} className="mx-auto" />
          <p className="font-mono text-2xl tracking-[0.3em]">{reward.redemptionCode}</p>
          <p className="text-xs text-slate-500">
            Show this code to the staff to redeem.
            {reward.expiresAt ? ` Use by ${formatDate(reward.expiresAt)}.` : ""}
          </p>
        </Card>
      ))}

      <Card>
        <p className="mb-2 font-semibold">Recent stamps</p>
        {recentStamps.length === 0 ? (
          <p className="text-sm text-slate-500">No stamps yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recentStamps.map((stamp) => (
              <li key={stamp._id} className="py-2 text-slate-600">
                {formatDate(stamp.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {card.programId?.terms ? (
        <p className="px-1 text-xs text-slate-500">{card.programId.terms}</p>
      ) : null}
    </>
  );
}
