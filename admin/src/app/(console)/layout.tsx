import Link from "next/link";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "@taptapsell/constants";
import { logoutAction } from "@/app/actions";
import { can, getMe } from "@/lib/me";

const NAV: Array<{ href: string; label: string; permission?: PlatformPermission }> = [
  { href: "/", label: "Overview", permission: PLATFORM_PERMISSIONS.ANALYTICS_VIEW },
  { href: "/businesses", label: "Businesses", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
  { href: "/leads", label: "Leads", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
  { href: "/devices", label: "Stampers", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
  { href: "/alerts", label: "Alerts", permission: PLATFORM_PERMISSIONS.BUSINESS_VIEW },
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
      <aside className="border-b border-slate-200 bg-slate-900 text-slate-200 md:w-56 md:border-b-0 md:border-r">
        <div className="px-5 py-4">
          <p className="font-semibold text-white">TapTapSell Admin</p>
          <p className="mt-1 truncate text-xs text-slate-400">
            {me.name} · {me.platformRole.replace("_", " ").toLowerCase()}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button className="w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
              Sign out
            </button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
