import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { href: "", label: "Overview" },
  { href: "/programs", label: "Programs" },
  { href: "/rewards", label: "Rewards" },
  { href: "/devices", label: "Stampers" },
  { href: "/branches", label: "Branches" },
  { href: "/activity", label: "Activity" },
  { href: "/staff", label: "Staff" },
  { href: "/redeem", label: "Redeem" },
];

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const base = `/b/${businessId}`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/businesses" className="text-sm font-semibold">
            TapTapSell Loyalty
          </Link>
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
          {NAV.map((item) => (
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

      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
