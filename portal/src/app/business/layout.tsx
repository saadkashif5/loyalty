import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@taptapsell/brand";
import { Byline } from "@taptapsell/brand/byline";
import { Logo } from "@taptapsell/brand/logo";

export const metadata: Metadata = {
  title: `${BRAND.name} for businesses`,
  description: BRAND.description,
};

export default function BusinessSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/business" aria-label={`${BRAND.name} for businesses`}>
            <Logo />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/business/pricing" className="text-slate-600 hover:text-slate-900">
              Pricing
            </Link>
            <Link
              href="/business/request-access"
              className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white transition hover:bg-brand-700"
            >
              Request access
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 px-5 py-6 text-sm text-slate-500">
          <p>
            <Byline linkClassName="underline-offset-2 hover:text-slate-900 hover:underline" /> ·
            Made in Pakistan
          </p>
          <Link href="/" className="hover:text-slate-900">
            I am a customer →
          </Link>
        </div>
      </footer>
    </div>
  );
}
