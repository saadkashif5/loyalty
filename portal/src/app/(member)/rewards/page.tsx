import Link from "next/link";
import { getT } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { Card, formatDate } from "@/components/ui";

interface Redemption {
  _id: string;
  status: string;
  redemptionCode: string;
  createdAt: string;
  redeemedAt?: string;
  expiresAt?: string | null;
  loyaltyCardId: string;
  rewardId: { name: string } | null;
  businessId: { name: string } | null;
}

export default async function RewardsPage() {
  const redemptions = await apiFetch<Redemption[]>("/redemptions/me");
  const now = Date.now();
  const t = await getT();
  const usable = (r: Redemption) =>
    r.status === "PENDING" && (!r.expiresAt || new Date(r.expiresAt).getTime() > now);
  const ready = redemptions.filter(usable);
  const used = redemptions.filter((r) => !usable(r));

  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
        {t("rewards.title")}
      </h1>

      {ready.length === 0 ? (
        <Card className="text-center text-sm text-ink-600">{t("rewards.none")}</Card>
      ) : (
        ready.map((r) => (
          <Link key={r._id} href={`/cards/${r.loyaltyCardId}`} className="block">
            <Card className="flex items-center justify-between gap-4 border-brand-500">
              <div>
                <p className="font-semibold">{r.rewardId?.name ?? "Reward"}</p>
                <p className="text-sm text-ink-500">
                  {r.businessId?.name}
                  {r.expiresAt ? ` · use by ${formatDate(r.expiresAt)}` : ""}
                </p>
              </div>
              <span className="font-mono text-lg tracking-widest">{r.redemptionCode}</span>
            </Card>
          </Link>
        ))
      )}

      {used.length > 0 ? (
        <Card>
          <p className="mb-2 font-semibold">{t("rewards.used")}</p>
          <ul className="divide-y divide-ink-100 text-sm">
            {used.map((r) => (
              <li key={r._id} className="flex justify-between gap-4 py-2">
                <span>
                  {r.rewardId?.name} · {r.businessId?.name}
                </span>
                <span className="text-ink-500">{formatDate(r.redeemedAt ?? r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
