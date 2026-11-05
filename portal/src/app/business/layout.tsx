import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TapTapSell for businesses",
  description:
    "Digital stamp cards for Pakistani shops. Customers tap their phone on a stamper at the counter: no app, no paper cards.",
};

export default function BusinessSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/business" className="text-xl font-bold text-brand-600">
            TapTapSell
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/business/pricing" className="text-slate-600 hover:text-slate-900">
              Pricing
            </Link>
            <Link
              href="/business/request-access"
              className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white"
            >
              Request access
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 px-5 py-6 text-sm text-slate-500">
          <p>TapTapSell Loyalty · Made in Pakistan</p>
          <Link href="/" className="hover:text-slate-900">
            I am a customer →
          </Link>
        </div>
      </footer>
    </div>
  );
}
