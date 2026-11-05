import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, formatDate } from "@/components/ui";
import { MarkAllRead } from "./MarkAllRead";

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
  const items = await apiFetch<Item[]>("/notifications?limit=50");
  const unread = items.some((n) => n.status !== "READ");

  return (
    <>
      <h1 className="text-lg font-semibold">Notifications</h1>
      {unread ? <MarkAllRead /> : null}
      {items.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          Nothing yet. Stamps, rewards and reminders show up here.
        </Card>
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
                <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(n.createdAt)}</p>
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
