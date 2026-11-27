import { PLATFORM_PERMISSIONS, type PlatformPermission } from "@taptapsell/constants";
import { Logo } from "@taptapsell/brand/logo";
import { logoutAction } from "@/app/actions";
import { can, getMe } from "@/lib/me";
import { NavLink } from "@/components/NavLink";

const NAV: Array<{ href: string; label: string; permission?: PlatformPermission }> = [
  { href: "/", label: "Overview", permission: PLATFORM_PERMISSIONS.ANALYTICS_VIEW },
  { href: "/businesses", label: "Businesses", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
  { href: "/pilot", label: "Pilot", permission: PLATFORM_PERMISSIONS.ANALYTICS_VIEW },
  { href: "/leads", label: "Leads", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
  { href: "/devices", label: "Stampers", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
  { href: "/alerts", label: "Alerts", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
  { href: "/finance", label: "Finance", permission: PLATFORM_PERMISSIONS.BILLING_VIEW },
  { href: "/payments", label: "Receipts", permission: PLATFORM_PERMISSIONS.BILLING_VIEW },
  { href: "/plans", label: "Plans", permission: PLATFORM_PERMISSIONS.BILLING_VIEW },
  { href: "/coupons", label: "Coupons", permission: PLATFORM_PERMISSIONS.BILLING_VIEW },
  {
    href: "/billing-settings",
    label: "Billing settings",
    permission: PLATFORM_PERMISSIONS.BILLING_VIEW,
  },
  { href: "/users", label: "Users", permission: PLATFORM_PERMISSIONS.USER_VIEW },
  { href: "/audit", label: "Audit log", permission: PLATFORM_PERMISSIONS.AUDIT_VIEW },
  { href: "/team", label: "Team", permission: PLATFORM_PERMISSIONS.TEAM_MANAGE },
  { href: "/security", label: "My security" },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const items = NAV.filter((item) => !item.permission || can(me.platformRole, item.permission));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="relative overflow-hidden bg-ink text-ink-200 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl"
        />
        <div className="relative px-5 pb-4 pt-5">
          <Logo size="sm" tone="light" suffix="Admin" />
          <p className="mt-3 truncate text-xs text-ink-300">
            {me.name} · {me.platformRole.replace("_", " ").toLowerCase()}
          </p>
        </div>
        <nav className="relative flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] md:flex-col md:overflow-y-auto md:pb-6">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.href === "/"}
              className="whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition md:rounded-xl"
              activeClassName="bg-brand-500 text-ink"
              inactiveClassName="hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </NavLink>
          ))}
          <form action={logoutAction} className="md:mt-4 md:border-t md:border-white/10 md:pt-4">
            <button className="w-full whitespace-nowrap rounded-full px-3.5 py-2 text-start text-sm text-ink-300 transition hover:bg-white/10 hover:text-white md:rounded-xl">
              Sign out
            </button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
