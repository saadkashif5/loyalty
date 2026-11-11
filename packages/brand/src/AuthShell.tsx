import type { ReactNode } from "react";
import { BRAND } from "./index";
import { Byline } from "./Byline";
import { Logo } from "./Logo";

/** A loyalty card's worth of stamps, the brand's motif. */
function StampGrid() {
  return (
    <div aria-hidden className="grid w-fit grid-cols-5 gap-3">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`h-11 w-11 rounded-full border-2 ${
            i < 7 ? "border-white/80 bg-white/90" : "border-dashed border-white/40"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * The frame around every sign-in, sign-up and password page in every app:
 * a brand panel on wide screens, the form on its own on phones.
 */
export function AuthShell({
  title,
  subtitle,
  area,
  headline = "Every visit counts.",
  blurb = BRAND.tagline,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Which app this is, shown after the name: "Business", "Admin". */
  area?: string;
  headline?: string;
  blurb?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl"
        />
        <Logo tone="light" suffix={area} />
        <div className="relative space-y-8">
          <StampGrid />
          <div>
            <p className="text-4xl font-semibold tracking-tight">{headline}</p>
            <p className="mt-3 max-w-sm text-lg text-brand-100">{blurb}</p>
          </div>
        </div>
        <p className="text-sm text-brand-200">
          <Byline linkClassName="underline-offset-2 hover:text-white hover:underline" />
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo suffix={area} />
          </div>
          <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900 lg:text-start">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-center text-sm text-slate-500 lg:text-start">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 space-y-2 text-center text-sm">{footer}</div> : null}
          <p className="mt-10 text-center text-xs text-slate-400 lg:hidden">
            <Byline linkClassName="underline-offset-2 hover:text-slate-600 hover:underline" />
          </p>
        </div>
      </main>
    </div>
  );
}
