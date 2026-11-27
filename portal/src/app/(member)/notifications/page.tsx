import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, formatDate } from "@/components/ui";
import { MarkAllRead } from "./MarkAllRead";
import { getT } from "@/lib/i18n";

interface Item {
  _id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  data?: { loyaltyCardId?: string; redemptionId?: string };
}

export default async function NotificationsPage() {
  const [items, t] = await Promise.all([apiFetch<Item[]>("/notifications?limit=50"), getT()]);
  const unread = items.some((n) => n.status !== "READ");

  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
        {t("notifications.title")}
      </h1>
      {unread ? <MarkAllRead /> : null}
      {items.length === 0 ? (
        <Card className="text-center text-sm text-ink-500">{t("notifications.empty")}</Card>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const href = n.data?.loyaltyCardId
              ? `/cards/${n.data.loyaltyCardId}`
              : n.data?.redemptionId
                ? "/rewards"
                : null;
            const body = (
              <Card className={n.status === "READ" ? "" : "border-brand-500"}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{n.title}</p>
                  {n.status === "READ" ? null : (
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600"
                      aria-label="New"
                    />
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-600">{n.body}</p>
                <p className="mt-1 text-xs text-ink-400">{formatDate(n.createdAt)}</p>
              </Card>
            );
            return (
              <li key={n._id}>
                {href ? (
                  <Link href={href} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
