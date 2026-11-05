import Link from "next/link";
import { BUSINESS_PERMISSIONS, type BusinessPermission } from "@taptapsell/constants";
import { logoutAction } from "@/app/actions/auth";
import { can, getMembership } from "@/lib/membership";
import { apiFetch } from "@/lib/api";

interface BillingStatus {
  subscription: { status: string; trialEndsAt: string | null; graceEndsAt: string | null } | null;
}

const DAY = 86_400_000;

/** A one-line nudge for owners when the trial is ending or payment is due. */
function billingNotice(billing: BillingStatus | null): string | null {
  const sub = billing?.subscription;
  if (!sub) return null;
  const daysLeft = (iso: string | null) =>
    iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY)) : null;

  if (sub.status === "TRIALING") {
    const left = daysLeft(sub.trialEndsAt);
    return left !== null && left <= 7
      ? `Your free trial ends in ${left} day${left === 1 ? "" : "s"}.`
      : null;
  }
  if (sub.status === "PAST_DUE") {
    const left = daysLeft(sub.graceEndsAt);
    return `Payment is overdue. Stamping stops in ${left ?? 0} day${left === 1 ? "" : "s"} unless you pay.`;
  }
  return null;
}

const P = BUSINESS_PERMISSIONS;

// Each entry lists the permissions that unlock it (any one is enough).
const NAV: Array<{ href: string; label: string; permissions: BusinessPermission[] }> = [
  { href: "", label: "Overview", permissions: [P.CUSTOMER_VIEW] },
  { href: "/redeem", label: "Redeem", permissions: [P.REDEMPTION_VALIDATE] },
  { href: "/counter", label: "Add stamp", permissions: [P.STAMP_ISSUE_COUNTER] },
  { href: "/customers", label: "Customers", permissions: [P.CUSTOMER_VIEW] },
  { href: "/programs", label: "Programs", permissions: [P.PROGRAM_VIEW] },
  { href: "/rewards", label: "Rewards", permissions: [P.REWARD_MANAGE] },
  { href: "/devices", label: "Stampers", permissions: [P.DEVICE_MANAGE, P.DEVICE_REPORT_PROBLEM] },
  { href: "/branches", label: "Branches", permissions: [P.BRANCH_MANAGE] },
  { href: "/activity", label: "Activity", permissions: [P.STAMP_VIEW] },
  { href: "/approvals", label: "Approvals", permissions: [P.STAMP_ISSUE_MANUAL] },
  { href: "/alerts", label: "Alerts", permissions: [P.FRAUD_REVIEW] },
  { href: "/staff", label: "Staff", permissions: [P.MEMBER_VIEW] },
  { href: "/billing", label: "Billing", permissions: [P.BUSINESS_MANAGE_BILLING] },
  { href: "/settings", label: "Settings", permissions: [P.BUSINESS_MANAGE_PROFILE] },
];

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { role, business, supportView } = await getMembership(businessId);
  const base = `/b/${businessId}`;
  const features = await apiFetch<{ counterMode: boolean }>(
    `/businesses/${businessId}/features`,
  ).catch(() => ({ counterMode: true }));
  const items = NAV.filter(
    (item) =>
      item.permissions.some((p) => can(role, p)) &&
      // Counter mode is a plan feature.
      (item.href !== "/counter" || features.counterMode),
  );
  const billing = can(role, P.BUSINESS_MANAGE_BILLING)
    ? await apiFetch<BillingStatus>(`/businesses/${businessId}/billing`).catch(() => null)
    : null;
  const notice = billingNotice(billing);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <Link href="/businesses" className="text-sm font-semibold">
              {business.name}
            </Link>
            <span className="ml-2 text-xs text-slate-400">
              {supportView ? "support view" : role.toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/account/security" className="text-sm text-slate-500 hover:text-slate-900">
              Security
            </Link>
            <form action={logoutAction}>
              <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-px">
          {items.map((item) => (
            <Link
              key={item.href}
              href={`${base}${item.href}`}
              className="whitespace-nowrap rounded-t-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {supportView ? (
        <div className="border-b border-violet-200 bg-violet-50">
          <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-violet-900">
            <strong>Support view, read-only.</strong> You are seeing this business as its owner
            does. Nothing can be changed, and every page you open is recorded. Ends at{" "}
            {new Date(supportView.expiresAt).toLocaleTimeString("en-PK", {
              timeZone: "Asia/Karachi",
              hour: "numeric",
              minute: "2-digit",
            })}
            . Reason: {supportView.reason}
          </p>
        </div>
      ) : null}

      {business.status === "SUSPENDED" ? (
        <div className="border-b border-red-200 bg-red-50">
          {business.suspension?.kind === "BILLING" ? (
            <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-red-800">
              <strong>Stamping is paused because payment has not arrived.</strong> Customers can
              still redeem rewards they already earned. Paying switches everything back on straight
              away.{" "}
              {can(role, P.BUSINESS_MANAGE_BILLING) ? (
                <Link href={`${base}/billing`} className="font-medium underline">
                  See billing
                </Link>
              ) : null}
            </p>
          ) : (
            <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-red-800">
              <strong>This business is suspended.</strong>{" "}
              {business.suspension?.reason ? `Reason: ${business.suspension.reason}. ` : ""}
              Customers cannot collect stamps and nothing can be changed until TapTapSell restores
              it. Your data is safe and still visible.
            </p>
          )}
        </div>
      ) : null}

      {notice ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-amber-900">
            {notice}{" "}
            <Link href={`${base}/billing`} className="font-medium underline">
              See billing
            </Link>
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
