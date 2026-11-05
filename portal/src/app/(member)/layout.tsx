import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Pwa } from "@/components/Pwa";
import { getT, pick } from "@/lib/i18n";

const TABS = [
  { href: "/cards", label: "nav.cards", icon: "🎟️" },
  { href: "/rewards", label: "nav.rewards", icon: "🎁" },
  { href: "/profile", label: "nav.me", icon: "👤" },
] as const;

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const { unread } = await apiFetch<{ unread: number }>("/notifications/summary").catch(() => ({
    unread: 0,
  }));

  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <Link href="/cards" className="text-xl font-bold text-brand-600">
          TapTapSell
        </Link>
        <Link
          href="/notifications"
          className="relative rounded-full p-2 text-xl"
          aria-label={unread ? t("nav.notificationsNew", { n: unread }) : t("nav.notifications")}
        >
          <span aria-hidden>🔔</span>
          {unread ? (
            <span className="absolute right-0 top-0 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
      </header>
      <Pwa
        messages={pick(t, [
          "pwa.offline",
          "pwa.installAndroid",
          "pwa.installIos",
          "pwa.add",
          "pwa.notNow",
        ])}
      />
      <main className="space-y-4 px-5">{children}</main>

      {/* Thumb-reachable navigation on phones. */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-slate-600"
            >
              <span className="text-lg" aria-hidden>
                {tab.icon}
              </span>
              {t(tab.label)}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
