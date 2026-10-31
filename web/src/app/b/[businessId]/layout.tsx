import Link from "next/link";
import { BUSINESS_PERMISSIONS, type BusinessPermission } from "@taptapsell/constants";
import { logoutAction } from "@/app/actions/auth";
import { can, getMembership } from "@/lib/membership";

const P = BUSINESS_PERMISSIONS;

// Each entry lists the permissions that unlock it (any one is enough).
const NAV: Array<{ href: string; label: string; permissions: BusinessPermission[] }> = [
  { href: "", label: "Overview", permissions: [P.CUSTOMER_VIEW] },
  { href: "/redeem", label: "Redeem", permissions: [P.REDEMPTION_VALIDATE] },
  { href: "/customers", label: "Customers", permissions: [P.CUSTOMER_VIEW] },
  { href: "/programs", label: "Programs", permissions: [P.PROGRAM_VIEW] },
  { href: "/rewards", label: "Rewards", permissions: [P.REWARD_MANAGE] },
  { href: "/devices", label: "Stampers", permissions: [P.DEVICE_MANAGE, P.DEVICE_REPORT_PROBLEM] },
  { href: "/branches", label: "Branches", permissions: [P.BRANCH_MANAGE] },
  { href: "/activity", label: "Activity", permissions: [P.STAMP_VIEW] },
  { href: "/staff", label: "Staff", permissions: [P.MEMBER_VIEW] },
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
  const { role, business } = await getMembership(businessId);
  const base = `/b/${businessId}`;
  const items = NAV.filter((item) => item.permissions.some((p) => can(role, p)));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <Link href="/businesses" className="text-sm font-semibold">
              {business.name}
            </Link>
            <span className="ml-2 text-xs text-slate-400">{role.toLowerCase()}</span>
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

      {business.status === "SUSPENDED" ? (
        <div className="border-b border-red-200 bg-red-50">
          <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-red-800">
            <strong>This business is suspended.</strong>{" "}
            {business.suspension?.reason ? `Reason: ${business.suspension.reason}. ` : ""}
            Customers cannot collect stamps and nothing can be changed until TapTapSell restores it.
            Your data is safe and still visible.
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
