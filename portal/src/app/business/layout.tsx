import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@taptapsell/brand";
import { Byline } from "@taptapsell/brand/byline";
import { Logo } from "@taptapsell/brand/logo";
import { BUTTON } from "@/components/landing/parts";

export const metadata: Metadata = {
  title: `${BRAND.name} for businesses`,
  description: BRAND.description,
};

export default function BusinessSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-crema text-ink">
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-crema/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link
            href="/business"
            aria-label={`${BRAND.name} for businesses`}
            className="flex items-center gap-2.5"
          >
            <Logo />
            <span className="hidden rounded-full bg-ink px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-crema sm:inline">
              Business
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-6">
            <Link
              href="/business#how"
              className="hidden font-medium text-ink-600 transition hover:text-ink md:block"
            >
              How it works
            </Link>
            <Link
              href="/business/pricing"
              className="font-medium text-ink-600 transition hover:text-ink"
            >
              Pricing
            </Link>
            <Link href="/business/request-access" className={BUTTON.ink}>
              Request access
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 py-8 text-sm text-ink-500 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo size="sm" />
            <p>
              <Byline linkClassName="font-medium text-ink-700 underline-offset-2 hover:text-ink hover:underline" />{" "}
              · Made in Pakistan
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/business/pricing" className="hover:text-ink">
              Pricing
            </Link>
            <Link href="/" className="font-medium text-ink-700 hover:text-ink">
              I am a customer →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
