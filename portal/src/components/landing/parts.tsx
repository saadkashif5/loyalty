import type { ReactNode } from "react";
import { CheckIcon, Flower } from "./icons";

// Building blocks shared by the customer home page (/) and the business site
// (/business), so both read as one brand.

/**
 * Button styles. White on Stamp Orange is 3:1, which passes only for large
 * bold type, so the orange button is set at 19px bold; smaller buttons are ink.
 */
export const BUTTON = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 font-display text-[19px] font-bold text-white shadow-[0_14px_30px_-12px_rgb(var(--brand-600)/0.8)] transition hover:bg-brand-600 active:translate-y-px active:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-white/70 px-7 py-3.5 font-display text-[17px] font-semibold text-ink ring-1 ring-ink/15 transition hover:bg-white hover:ring-ink/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/20",
  ink: "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-crema transition hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/25",
  onDark:
    "inline-flex items-center justify-center gap-2 rounded-full bg-crema px-7 py-3.5 font-display text-[17px] font-bold text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-crema/40",
} as const;

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-white/80 py-1.5 pe-4 ps-1.5 text-sm font-medium text-ink-700 shadow-sm ring-1 ring-ink/5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
        <Flower className="h-4 w-4" />
      </span>
      {children}
    </p>
  );
}

export function SectionHeading({
  kicker,
  title,
  body,
  align = "center",
  tone = "dark",
}: {
  kicker?: string;
  title: string;
  body?: string;
  align?: "center" | "start";
  tone?: "dark" | "light";
}) {
  const centred = align === "center";
  return (
    <div className={centred ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      {kicker ? (
        <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-brand-600">
          {kicker}
        </p>
      ) : null}
      <h2
        className={`mt-2 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl ${tone === "light" ? "text-crema" : "text-ink"}`}
      >
        {title}
      </h2>
      {body ? (
        <p className={`mt-4 text-lg ${tone === "light" ? "text-ink-200" : "text-ink-600"}`}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

/** Short reassurances under a call to action, each with a Mint tick. */
export function Assurances({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-600">
      {items.map((item) => (
        <li key={item} className="inline-flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/20 text-mint-700">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** An endless ticker of the kinds of shops that use Stamply, on Midnight Ink. */
export function Ticker({ label, items }: { label: string; items: string[] }) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-6 whitespace-nowrap pe-6 font-display text-2xl font-semibold text-crema sm:text-3xl"
        >
          {item}
          <Flower className="h-5 w-5 text-brand-500" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label={label} className="relative overflow-hidden bg-ink py-6">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5">
        <p className="hidden shrink-0 rounded-full bg-brand-500 px-3 py-1 font-display text-xs font-bold uppercase tracking-[0.16em] text-ink sm:block">
          {label}
        </p>
        <div
          dir="ltr"
          className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          {/* Two copies side by side, sliding left by one copy's width, loop seamlessly. */}
          <div className="animate-marquee flex w-max">
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </section>
  );
}

export type Step = { title: string; body: string; icon: ReactNode };

/** The three-step "how it works" row, joined by a dashed line on wide screens. */
export function StepCards({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
      <span
        aria-hidden
        className="absolute inset-x-[16%] top-12 hidden border-t-2 border-dashed border-brand-500/35 md:block"
      />
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="relative rounded-[2rem] bg-white p-7 shadow-[0_20px_50px_-30px_rgb(var(--ink-900)/0.35)] ring-1 ring-ink/5"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-[0_10px_24px_-10px_rgb(var(--brand-600)/0.9)]">
              {step.icon}
            </span>
            <span className="font-display text-5xl font-extrabold text-ink/[0.07]">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
          <p className="mt-6 font-display text-2xl font-bold text-ink">{step.title}</p>
          <p className="mt-2 text-ink-600">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** A dotted backdrop, like the grain of a stamp pad. */
export function DotGrid({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(var(--ink-900)/0.09)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] ${className}`}
    />
  );
}
