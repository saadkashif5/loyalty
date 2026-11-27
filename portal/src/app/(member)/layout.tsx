import Link from "next/link";
import { Logo } from "@taptapsell/brand/logo";
import { apiFetch } from "@/lib/api";
import { Pwa } from "@/components/Pwa";
import { NavLink } from "@/components/NavLink";
import { BellIcon, CardsIcon, GiftIcon, UserIcon } from "@/components/landing/icons";
import { getT, pick } from "@/lib/i18n";

const TABS = [
  { href: "/cards", label: "nav.cards", Icon: CardsIcon },
  { href: "/rewards", label: "nav.rewards", Icon: GiftIcon },
  { href: "/profile", label: "nav.me", Icon: UserIcon },
] as const;

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const { unread } = await apiFetch<{ unread: number }>("/notifications/summary").catch(() => ({
    unread: 0,
  }));

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-crema/85 px-5 pb-3 pt-5 backdrop-blur-md">
        <Link href="/cards" aria-label="Cards">
          <Logo size="sm" />
        </Link>
        <Link
          href="/notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm ring-1 ring-ink/5 transition hover:ring-ink/15"
          aria-label={unread ? t("nav.notificationsNew", { n: unread }) : t("nav.notifications")}
        >
          <BellIcon className="h-5 w-5" />
          {unread ? (
            <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-brand-500 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white ring-2 ring-crema">
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
      <main className="space-y-4 px-5 pt-2">{children}</main>

      {/* Thumb-reachable navigation on phones: a floating Midnight Ink bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md gap-1 rounded-full bg-ink p-1.5 shadow-[0_20px_40px_-16px_rgb(var(--ink-900)/0.6)]">
          {TABS.map(({ href, label, Icon }) => (
            <NavLink
              key={href}
              href={href}
              className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition"
              activeClassName="bg-brand-500 text-ink"
              inactiveClassName="text-ink-200 hover:text-crema"
            >
              <Icon className="h-5 w-5" />
              {t(label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
