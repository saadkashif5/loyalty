import Link from "next/link";
import { BUSINESS_PERMISSIONS, type BusinessPermission } from "@taptapsell/constants";
import { BRAND } from "@taptapsell/brand";
import { Logo } from "@taptapsell/brand/logo";
import { NavLink } from "@/components/NavLink";
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
      <header className="sticky top-0 z-40 bg-ink text-crema shadow-[0_10px_30px_-20px_rgb(var(--ink-900)/0.8)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/businesses" className="shrink-0" aria-label="Your businesses">
              <Logo size="sm" tone="light" />
            </Link>
            <span aria-hidden className="h-5 w-px shrink-0 bg-white/15" />
            <Link
              href="/businesses"
              className="truncate font-display text-sm font-semibold text-crema hover:text-white"
            >
              {business.name}
            </Link>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-200">
              {supportView ? "support view" : role.toLowerCase()}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-sm">
            <Link
              href="/account/security"
              className="hidden rounded-full px-3 py-1.5 text-ink-200 transition hover:bg-white/10 hover:text-white sm:block"
            >
              Security
            </Link>
            <form action={logoutAction}>
              <button className="rounded-full px-3 py-1.5 text-ink-200 transition hover:bg-white/10 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={`${base}${item.href}`}
              exact={item.href === ""}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
              activeClassName="bg-brand-500 text-ink"
              inactiveClassName="text-ink-200 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {supportView ? (
        <div className="border-b border-brand-200 bg-brand-50">
          <p className="mx-auto max-w-6xl px-5 py-3 text-sm text-brand-900">
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
            <p className="mx-auto max-w-6xl px-5 py-3 text-sm text-red-800">
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
            <p className="mx-auto max-w-6xl px-5 py-3 text-sm text-red-800">
              <strong>This business is suspended.</strong>{" "}
              {business.suspension?.reason ? `Reason: ${business.suspension.reason}. ` : ""}
              Customers cannot collect stamps and nothing can be changed until {BRAND.name} restores
              it. Your data is safe and still visible.
            </p>
          )}
        </div>
      ) : null}

      {notice ? (
        <div className="border-b border-accent-200 bg-accent-50">
          <p className="mx-auto max-w-6xl px-5 py-3 text-sm text-accent-900">
            {notice}{" "}
            <Link href={`${base}/billing`} className="font-medium underline">
              See billing
            </Link>
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
