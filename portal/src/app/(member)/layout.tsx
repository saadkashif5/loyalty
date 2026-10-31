import Link from "next/link";

const TABS = [
  { href: "/cards", label: "Cards", icon: "🎟️" },
  { href: "/rewards", label: "Rewards", icon: "🎁" },
  { href: "/profile", label: "Me", icon: "👤" },
];

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      <header className="px-5 pb-2 pt-5">
        <Link href="/cards" className="text-xl font-bold text-brand-600">
          TapTapSell
        </Link>
      </header>
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
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
