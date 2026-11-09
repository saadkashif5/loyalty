import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";
import { Card, Notice, StampDots, formatDate } from "@/components/ui";
import { CounterCodePanel } from "@/components/CounterCodePanel";
import { getT, type MessageKey } from "@/lib/i18n";

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

const RESULT_TONE: Record<string, "success" | "info"> = {
  stamped: "success",
  unlocked: "success",
  joined: "info",
};

// Why a tap did not give a stamp, in the customer's terms.
const ERROR_CODES = new Set([
  "STAMP_COOLDOWN",
  "DAILY_STAMP_LIMIT",
  "TAP_EXPIRED",
  "TAP_ALREADY_USED",
  "NOT_ENROLLED",
]);

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ result?: string; error?: string }>;
}) {
  const { cardId } = await params;
  const { result, error } = await searchParams;
  const t = await getT();
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
      {result && RESULT_TONE[result] ? (
        <Notice tone={RESULT_TONE[result]}>{t(`card.result.${result}` as MessageKey)}</Notice>
      ) : null}
      {error ? (
        <Notice tone="warning">
          {ERROR_CODES.has(error) ? t(`card.error.${error}` as MessageKey) : t("card.errorGeneric")}
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
              {t("card.stamps", { n: card.stampCount, m: card.programId.requiredStamps })}
            </p>
            {card.stampsExpireAt ? (
              <p className="text-xs text-slate-500">
                {t("card.expiry", {
                  days: card.stampExpiryDays ?? "",
                  date: formatDate(card.stampsExpireAt),
                })}
              </p>
            ) : null}
            {card.stampCount === 0 && card.lastExpiry?.stamps ? (
              <p className="text-xs text-amber-700">
                {t("card.expired", {
                  n: card.lastExpiry.stamps,
                  date: formatDate(card.lastExpiry.at),
                })}
              </p>
            ) : null}
          </>
        ) : null}
      </Card>

      {card.status === "ACTIVE" ? <CounterCodePanel cardId={card._id} /> : null}

      {rewards.map((reward) => (
        <Card key={reward._id} className="space-y-3 border-brand-500 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">
            {t("card.yourReward")}
          </p>
          <p className="text-lg font-semibold">{reward.rewardId?.name ?? "Reward"}</p>
          {/* A data URL generated on the server; next/image adds nothing here. */}
          <img src={reward.qr} alt="" width={160} height={160} className="mx-auto" />
          <p className="font-mono text-2xl tracking-[0.3em]">{reward.redemptionCode}</p>
          <p className="text-xs text-slate-500">
            {t("card.showCode")}
            {reward.expiresAt ? ` ${t("card.useBy", { date: formatDate(reward.expiresAt) })}` : ""}
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
